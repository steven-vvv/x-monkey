import { computed, reactive, readonly, watch, type DeepReadonly, type WatchStopHandle } from 'vue';
import { getConfig } from './config-service';
import {
  archiveRecords,
  batchSignature,
  enqueueRemoteSyncStatusRefresh,
  getAllPosts,
  getDbPost,
  getDbUser,
  getRecordVersion,
  getRemoteSyncStatus,
  markRemoteSyncInSync,
  onDbCleared,
} from './db-service';
import { getTimelineNamespace } from './endpoint-support';
import {
  RemoteDbHttpError,
  buildArchiveBatch,
  getRemoteDbClientState,
  isRemoteDbReady,
  submitRemoteDbArchive,
  type RemoteDbSubmission,
  type RemoteDbSubmitResponse,
  type RemoteDbSubmitResult,
  type RemoteDbSubmitStatus,
} from './remote-db';
import { collectTimelinePostIds } from './timeline-store';

/**
 * Continuous archive: submits every captured post (and profile-only user) to the remote database while
 * browsing. See SPEC section 11. Only the new UI starts it (`startAutoArchive` on mount).
 */

export type AutoArchivePhase =
  | 'off' | 'paused' | 'unavailable' | 'needs-login' | 'forbidden' | 'backoff' | 'submitting' | 'idle';

export interface ArchiveCaptureEvent {
  /** Timeline namespace, `tweet-detail` or `user`. */
  source: string;
  postIds: string[];
  userIds: string[];
}

export interface AutoArchiveState {
  phase: AutoArchivePhase;
  /** Posts plus users waiting to be submitted. */
  queued: number;
  /** ms epoch of the next retry while in `backoff`. */
  retryAt: number | null;
  /** Posts by their worst record status; users counts profile-only submissions. */
  stats: { requests: number; accepted: number; unchanged: number; partial: number; failed: number; users: number };
  lastSubmittedAt: number | null;
  /** The latest error; kept after recovery, compare `at` with `lastSubmittedAt`. `status` is 0 without an HTTP response. */
  lastError: { message: string; status: number; at: number } | null;
  /** Newest last, at most `MAX_FAILURES`; user entries have ids like `user:123`. */
  failures: Array<{ id: string; reason: string }>;
  /** Increments each time the phase enters `needs-login`. */
  needsLoginEpoch: number;
}

const MAX_POSTS_PER_BATCH = 200;
const MAX_FAILURES = 50;
const DEBOUNCE_MS = 1500;
const MAX_WAIT_MS = 5000;
const BACKOFF_INITIAL_MS = 2000;
const BACKOFF_MAX_MS = 60_000;
const FOR_YOU_NAMESPACE = getTimelineNamespace('HomeTimeline');
const STATUS_RANK: Record<RemoteDbSubmitStatus, number> = { unchanged: 1, accepted: 1, partial: 2, failed: 3 };

const config = getConfig();
const remote = getRemoteDbClientState();
/** Engine-internal switches that feed `phase`. */
const flags = reactive({ paused: false, forbidden: false, inFlight: false });

const state: AutoArchiveState = reactive({
  phase: computed(derivePhase),
  queued: 0,
  retryAt: null as number | null,
  stats: { requests: 0, accepted: 0, unchanged: 0, partial: 0, failed: 0, users: 0 },
  lastSubmittedAt: null as number | null,
  lastError: null as AutoArchiveState['lastError'],
  failures: [] as AutoArchiveState['failures'],
  needsLoginEpoch: 0,
});

export const autoArchiveState: DeepReadonly<AutoArchiveState> = readonly(state);

/** Queue entries are `post:ID` / `user:ID` keys, so one Set dedups both and a batch can be halved by slicing. */
const queue = new Set<string>();
const lastSubmittedPosts = new Map<string, string>();
const lastSubmittedUsers = new Map<string, number>();
let started = false;
let backoffMs = BACKOFF_INITIAL_MS;
let debounceTimer: number | undefined;
let maxWaitTimer: number | undefined;
let retryTimer: number | undefined;
let stopHandles: WatchStopHandle[] = [];
let stopDbCleared: (() => void) | undefined;

function derivePhase(): AutoArchivePhase {
  if (!config.autoArchive) return 'off';
  if (flags.paused) return 'paused';
  if (!remote.enabled || !remote.runtimeEnabled || !remote.baseUrl) return 'unavailable';
  if (remote.sessionState === 'anonymous' || remote.sessionState === 'pending_registration') return 'needs-login';
  if (!isRemoteDbReady()) return 'unavailable';
  if (flags.forbidden) return 'forbidden';
  if (state.retryAt !== null) return 'backoff';
  return flags.inFlight ? 'submitting' : 'idle';
}

// --- queue -----------------------------------------------------------------

const postKey = (id: string) => `post:${id}`;
const userKey = (id: string) => `user:${id}`;

function syncQueued(): void {
  state.queued = queue.size;
}

function clearTimers(): void {
  window.clearTimeout(debounceTimer);
  window.clearTimeout(maxWaitTimer);
  window.clearTimeout(retryTimer);
  debounceTimer = maxWaitTimer = retryTimer = undefined;
}

function resetQueue(): void {
  queue.clear();
  clearTimers();
  state.retryAt = null;
  backoffMs = BACKOFF_INITIAL_MS;
  syncQueued();
}

function postNeedsSubmit(id: string): boolean {
  return !!getDbPost(id) && !queue.has(postKey(id)) && lastSubmittedPosts.get(id) !== batchSignature(id);
}

function userNeedsSubmit(id: string): boolean {
  const version = getRecordVersion('user', id);
  return version > 0 && !queue.has(userKey(id)) && lastSubmittedUsers.get(id) !== version;
}

/** Debounced send: 1.5 s after the last event, at most 5 s after the queue became non-empty. */
function scheduleFlush(): void {
  if (!started || queue.size === 0) return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(flush, DEBOUNCE_MS);
  maxWaitTimer ??= window.setTimeout(flush, MAX_WAIT_MS);
}

function flush(): void {
  window.clearTimeout(debounceTimer);
  window.clearTimeout(maxWaitTimer);
  debounceTimer = maxWaitTimer = undefined;
  void pump();
}

/** Puts keys back after a failed attempt; nothing comes back once the engine is off or stopped. */
function requeue(keys: string[]): void {
  if (!started || !config.autoArchive) return;
  for (const key of keys) queue.add(key);
  syncQueued();
}

/** Queues every stored post the remote has not confirmed and that was not submitted at its current version. */
function backfill(): void {
  let skipped = new Set<string>();
  if (config.autoArchiveSkipForYou) {
    const others = collectTimelinePostIds((namespace) => namespace !== FOR_YOU_NAMESPACE);
    skipped = new Set([...collectTimelinePostIds((namespace) => namespace === FOR_YOU_NAMESPACE)].filter((id) => !others.has(id)));
  }
  for (const post of getAllPosts()) {
    if (skipped.has(post.id) || getRemoteSyncStatus(post.id) === 'in_sync') continue;
    if (postNeedsSubmit(post.id)) queue.add(postKey(post.id));
  }
  syncQueued();
  scheduleFlush();
}

/** Called by the fetch interceptor after each supported response was stored. Cheap while the engine is off. */
export function noteArchiveCapture(event: ArchiveCaptureEvent): void {
  if (!started || !config.autoArchive || flags.paused) return;
  if (config.autoArchiveSkipForYou && event.source === FOR_YOU_NAMESPACE) return;

  for (const id of event.postIds) {
    if (postNeedsSubmit(id)) queue.add(postKey(id));
  }
  // Users of a response with posts travel in those posts' batches; only profile-only responses add users.
  if (event.postIds.length === 0) {
    for (const id of event.userIds) {
      if (userNeedsSubmit(id)) queue.add(userKey(id));
    }
  }
  syncQueued();
  scheduleFlush();
}

// --- sending ---------------------------------------------------------------

interface PostPlan {
  id: string;
  signature: string;
  /** Record keys (`post:` / `user:` / `media:`) of this post's own batch. */
  recordKeys: string[];
}

interface SubmitRequest {
  batch: RemoteDbSubmission;
  plans: PostPlan[];
  userOnlyIds: string[];
  userVersions: Map<string, number>;
}

/** Takes up to one batch of entries (200 posts, 200 profile-only users) off the queue. */
function takeBatch(): string[] {
  const keys: string[] = [];
  let posts = 0;
  let users = 0;
  for (const key of queue) {
    const isPost = key.startsWith('post:');
    if (isPost ? posts >= MAX_POSTS_PER_BATCH : users >= MAX_POSTS_PER_BATCH) continue;
    if (isPost) posts += 1;
    else users += 1;
    keys.push(key);
  }
  for (const key of keys) queue.delete(key);
  syncQueued();
  return keys;
}

function recordKeysOf(batch: RemoteDbSubmission): string[] {
  return [
    ...batch.posts.map((item) => `post:${item.id}`),
    ...batch.users.map((item) => `user:${item.id}`),
    ...batch.media.map((item) => `media:${item.id}`),
  ];
}

/** Builds the submission now, so signatures match exactly what is sent. Posts gone from the db are dropped. */
function buildRequest(keys: string[]): SubmitRequest {
  const postIds = keys.filter((key) => key.startsWith('post:')).map((key) => key.slice(5));
  const userIds = keys.filter((key) => key.startsWith('user:')).map((key) => key.slice(5));
  const { batch, missingPostIds } = buildArchiveBatch(postIds, archiveRecords);
  const missing = new Set(missingPostIds);
  const plans = postIds.filter((id) => !missing.has(id)).map((id) => ({
    id,
    signature: batchSignature(id),
    recordKeys: recordKeysOf(buildArchiveBatch([id], archiveRecords).batch),
  }));

  const inBatch = new Set(batch.users.map((user) => user.id));
  const userOnly = userIds.filter((id) => !inBatch.has(id)).flatMap((id) => getDbUser(id) ?? []);
  batch.users.push(...userOnly);
  const userVersions = new Map(batch.users.map((user) => [user.id, getRecordVersion('user', user.id)]));
  return { batch, plans, userOnlyIds: userOnly.map((user) => user.id), userVersions };
}

function recordFailure(id: string, reason: string): void {
  const existing = state.failures.findIndex((item) => item.id === id);
  if (existing >= 0) state.failures.splice(existing, 1);
  state.failures.push({ id, reason });
  if (state.failures.length > MAX_FAILURES) state.failures.splice(0, state.failures.length - MAX_FAILURES);
}

/** The worst result among a post's batch records; on a tie the post's own result decides. */
function worstResult(plan: PostPlan, results: Map<string, RemoteDbSubmitResult>): { status: RemoteDbSubmitStatus; reason?: string } {
  const own = results.get(postKey(plan.id));
  let worst: { status: RemoteDbSubmitStatus; reason?: string } = { status: own?.status ?? 'unchanged', reason: own?.reason };
  for (const key of plan.recordKeys) {
    const result = results.get(key);
    if (!result || STATUS_RANK[result.status] <= STATUS_RANK[worst.status]) continue;
    worst = { status: result.status, reason: `${key}${result.reason ? `: ${result.reason}` : ''}` };
  }
  return worst;
}

function applyResponse(request: SubmitRequest, response: RemoteDbSubmitResponse): void {
  const results = new Map<string, RemoteDbSubmitResult>();
  for (const item of response.users) results.set(userKey(item.id), item);
  for (const item of response.posts) results.set(postKey(item.id), item);
  for (const item of response.media) results.set(`media:${item.id}`, item);

  for (const plan of request.plans) {
    const { status, reason } = worstResult(plan, results);
    lastSubmittedPosts.set(plan.id, plan.signature);
    state.stats[status] += 1;
    if (status === 'failed') recordFailure(plan.id, reason ?? 'failed');
    else if (status === 'partial') enqueueRemoteSyncStatusRefresh([plan.id]);
    else markRemoteSyncInSync(plan.id, plan.signature);
  }
  for (const [id, version] of request.userVersions) lastSubmittedUsers.set(id, version);
  for (const id of request.userOnlyIds) {
    const result = results.get(userKey(id));
    if (result?.status === 'failed') recordFailure(userKey(id), result.reason ?? 'failed');
    else state.stats.users += 1;
  }

  state.lastSubmittedAt = Date.now();
  backoffMs = BACKOFF_INITIAL_MS;
}

function startBackoff(): void {
  if (!started || !config.autoArchive) return;
  state.retryAt = Date.now() + backoffMs;
  retryTimer = window.setTimeout(() => {
    state.retryAt = null;
    flush();
  }, backoffMs);
  backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs * 2);
}

/** A lone entry the server rejects is a failure; it is not retried until it changes (or via `retryAutoArchiveFailures`). */
function failSingle(key: string, reason: string): 'ok' {
  if (key.startsWith('post:')) {
    const id = key.slice(5);
    if (getDbPost(id)) lastSubmittedPosts.set(id, batchSignature(id));
    state.stats.failed += 1;
    recordFailure(id, reason);
  } else {
    lastSubmittedUsers.set(key.slice(5), getRecordVersion('user', key.slice(5)));
    recordFailure(key, reason);
  }
  return 'ok';
}

/** Returns 'stop' when the keys went back to the queue (or the attempt must pause the loop). */
async function handleSubmitError(error: unknown, keys: string[]): Promise<'ok' | 'stop'> {
  const status = error instanceof RemoteDbHttpError ? error.status : 0;
  state.lastError = { message: error instanceof Error ? error.message : String(error), status, at: Date.now() };

  if (status === 400 || status === 413) {
    if (keys.length === 1) return failSingle(keys[0], state.lastError.message);
    const half = Math.ceil(keys.length / 2);
    if (await submit(keys.slice(0, half)) === 'stop') {
      requeue(keys.slice(half));
      return 'stop';
    }
    return submit(keys.slice(half));
  }

  requeue(keys);
  if (status === 403) flags.forbidden = true;
  // After a 401 the client refreshed the session: if it dropped, `phase` becomes needs-login by itself.
  else if (status !== 401 || isRemoteDbReady()) startBackoff();
  return 'stop';
}

async function submit(keys: string[]): Promise<'ok' | 'stop'> {
  const request = buildRequest(keys);
  if (request.plans.length === 0 && request.userOnlyIds.length === 0) return 'ok';
  state.stats.requests += 1;
  let response: RemoteDbSubmitResponse;
  try {
    response = await submitRemoteDbArchive(request.batch);
  } catch (error) {
    return handleSubmitError(error, keys);
  }
  applyResponse(request, response);
  return 'ok';
}

const isPhase = (phase: AutoArchivePhase) => state.phase === phase;

/** One request at a time; keeps sending while the queue has entries and the engine stays idle/submitting. */
async function pump(): Promise<void> {
  if (flags.inFlight || queue.size === 0 || !isPhase('idle')) return;
  flags.inFlight = true;
  try {
    while (queue.size > 0 && isPhase('submitting')) {
      if (await submit(takeBatch()) === 'stop') break;
    }
  } finally {
    flags.inFlight = false;
  }
}

// --- lifecycle -------------------------------------------------------------

/** Session pause: only this tab, not persisted. Events arriving meanwhile are dropped. */
export function pauseAutoArchive(): void {
  flags.paused = true;
}

export function resumeAutoArchive(): void {
  flags.paused = false;
}

/** Forgets that the failed records were submitted and queues them again. */
export function retryAutoArchiveFailures(): void {
  if (!started || !config.autoArchive) return;
  for (const { id } of state.failures) {
    if (id.startsWith('user:')) {
      lastSubmittedUsers.delete(id.slice(5));
      queue.add(id);
    } else {
      lastSubmittedPosts.delete(id);
      if (getDbPost(id)) queue.add(postKey(id));
    }
  }
  state.failures.splice(0);
  syncQueued();
  scheduleFlush();
}

export function startAutoArchive(): void {
  if (started) return;
  started = true;

  stopDbCleared = onDbCleared(() => {
    queue.clear();
    lastSubmittedPosts.clear();
    lastSubmittedUsers.clear();
    syncQueued();
  });
  stopHandles = [
    watch(() => config.autoArchive, (on) => {
      if (on) {
        flags.forbidden = false;
        backoffMs = BACKOFF_INITIAL_MS;
        backfill();
      } else {
        resetQueue();
      }
    }),
    // A new session or base URL gets another chance after a 403.
    watch(() => [remote.baseUrl, remote.sessionState] as const, () => {
      flags.forbidden = false;
    }),
    watch(() => state.phase, (phase, previous) => {
      if (phase === 'needs-login') state.needsLoginEpoch += 1;
      // Leaving a backoff is the retry timer's job; submit loops continue by themselves.
      if (phase === 'idle' && previous !== 'submitting' && previous !== 'backoff') scheduleFlush();
    }),
  ];
  if (config.autoArchive) backfill();
}

/** Stops watching and drops the queue; an in-flight request finishes but its leftovers are not requeued. */
export function stopAutoArchive(): void {
  if (!started) return;
  started = false;
  for (const stop of stopHandles) stop();
  stopHandles = [];
  stopDbCleared?.();
  stopDbCleared = undefined;
  flags.forbidden = false;
  resetQueue();
}
