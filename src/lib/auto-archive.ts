import { computed, reactive, readonly, watch, type DeepReadonly, type WatchStopHandle } from 'vue';
import { GM_log, unsafeWindow } from '$';
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
import { createLease, createOutbox, packRecords, type OutboxRecord } from './outbox';
import { gmOutboxKv } from './outbox-gm';
import {
  RemoteDbHttpError,
  RemoteDbTimeoutError,
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
 *
 * Durability: every queued record is also kept in the outbox (GM storage, see outbox.ts) until the server
 * acknowledges it, so a reload, a tab close or `autoClearOnNavigate` never loses captured data. What the next page
 * (or another tab) finds there is sent after the live queue. One tab sends at a time (storage lease).
 */

export type AutoArchivePhase =
  | 'off' | 'paused' | 'unavailable' | 'needs-login' | 'forbidden' | 'standby' | 'backoff' | 'submitting' | 'idle';

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
  /** Persisted, not yet acknowledged records; `dropped` counts records the size cap discarded (oldest first); `resumed` those sent from an earlier page or tab. */
  outbox: { records: number; dropped: number; resumed: number };
}

const MAX_POSTS_PER_BATCH = 100;
/**
 * Per request: at most this many records (posts + users + media) and bytes. The server stores them one transaction
 * at a time (about 10 ms each), so 400 records stay far below the 55 s client timeout, the server's 60 s write
 * timeout and Cloudflare's ~100 s. A timeout halves the limit; successes grow it back.
 */
const MAX_REQUEST_RECORDS = 400;
const MIN_REQUEST_RECORDS = 25;
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const STANDBY_RETRY_MS = 10_000;
const ORPHAN_SCAN_MS = 60_000;
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
const flags = reactive({ paused: false, forbidden: false, inFlight: false, standby: false });

const state: AutoArchiveState = reactive({
  phase: computed(derivePhase),
  queued: 0,
  retryAt: null as number | null,
  stats: { requests: 0, accepted: 0, unchanged: 0, partial: 0, failed: 0, users: 0 },
  lastSubmittedAt: null as number | null,
  lastError: null as AutoArchiveState['lastError'],
  failures: [] as AutoArchiveState['failures'],
  needsLoginEpoch: 0,
  outbox: { records: 0, dropped: 0, resumed: 0 },
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
let standbyTimer: number | undefined;
let orphanTimer: number | undefined;
let orphanHint = false;
let requestRecordLimit = MAX_REQUEST_RECORDS;
let stopListeners: Array<() => void> = [];

const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const outbox = createOutbox({
  kv: gmOutboxKv,
  tabId,
  onDrop: (count) => {
    state.outbox.dropped += count;
    GM_log(`[Auto Archive] outbox full, dropped the ${count} oldest unsent records`);
  },
});
const lease = createLease({ kv: gmOutboxKv, owner: tabId });

function derivePhase(): AutoArchivePhase {
  if (!config.autoArchive) return 'off';
  if (flags.paused) return 'paused';
  if (!remote.enabled || !remote.runtimeEnabled || !remote.baseUrl) return 'unavailable';
  if (remote.sessionState === 'anonymous' || remote.sessionState === 'pending_registration') return 'needs-login';
  if (!isRemoteDbReady()) return 'unavailable';
  if (flags.forbidden) return 'forbidden';
  if (flags.standby) return 'standby';
  if (state.retryAt !== null) return 'backoff';
  return flags.inFlight ? 'submitting' : 'idle';
}

// --- queue -----------------------------------------------------------------

const postKey = (id: string) => `post:${id}`;
const userKey = (id: string) => `user:${id}`;

function syncQueued(): void {
  state.queued = queue.size;
}

function syncOutbox(): void {
  state.outbox.records = outbox.count();
}

/** Queued entries, unacknowledged outbox records, or a segment of an earlier page or tab waiting to be adopted. */
function hasWork(): boolean {
  return queue.size > 0 || outbox.count() > 0 || orphanHint;
}

const kindOfKey = (key: string): 'post' | 'user' | 'media' => key.slice(0, key.indexOf(':')) as 'post' | 'user' | 'media';

/** Copies the records of the given queue keys (a post with its author, media, quote...) into the outbox. */
function stage(keys: string[]): void {
  const postIds = keys.filter((key) => key.startsWith('post:')).map((key) => key.slice(5));
  const { batch } = buildArchiveBatch(postIds, archiveRecords);
  const users = [...batch.users];
  for (const key of keys) {
    if (!key.startsWith('user:')) continue;
    const user = getDbUser(key.slice(5));
    if (user) users.push(user);
  }
  for (const post of batch.posts) outbox.put(postKey(post.id), getRecordVersion('post', post.id), post);
  for (const user of users) outbox.put(userKey(user.id), getRecordVersion('user', user.id), user);
  for (const item of batch.media) outbox.put(`media:${item.id}`, getRecordVersion('media', item.id), item);
  syncOutbox();
}

/** Adds keys to the queue and the outbox. */
function enqueue(keys: string[]): void {
  const added = keys.filter((key) => !queue.has(key));
  for (const key of added) queue.add(key);
  if (added.length > 0) stage(added);
  syncQueued();
}

function clearTimers(): void {
  window.clearTimeout(debounceTimer);
  window.clearTimeout(maxWaitTimer);
  window.clearTimeout(retryTimer);
  window.clearTimeout(standbyTimer);
  debounceTimer = maxWaitTimer = retryTimer = standbyTimer = undefined;
}

/** Forgets the in-memory queue; the outbox keeps what was not acknowledged. */
function resetQueue(): void {
  queue.clear();
  clearTimers();
  flags.standby = false;
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
  if (!started || !hasWork()) return;
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
  const pending: string[] = [];
  for (const post of getAllPosts()) {
    if (skipped.has(post.id) || getRemoteSyncStatus(post.id) === 'in_sync') continue;
    if (postNeedsSubmit(post.id)) pending.push(postKey(post.id));
  }
  enqueue(pending);
  scheduleFlush();
}

/** Called by the fetch interceptor after each supported response was stored. Cheap while the engine is off. */
export function noteArchiveCapture(event: ArchiveCaptureEvent): void {
  if (!started || !config.autoArchive || flags.paused) return;
  if (config.autoArchiveSkipForYou && event.source === FOR_YOU_NAMESPACE) return;

  const pending: string[] = [];
  const queuedAgain: string[] = [];
  for (const id of event.postIds) {
    if (postNeedsSubmit(id)) pending.push(postKey(id));
    else if (queue.has(postKey(id))) queuedAgain.push(postKey(id));
  }
  // Users of a response with posts travel in those posts' batches; only profile-only responses add users.
  if (event.postIds.length === 0) {
    for (const id of event.userIds) {
      if (userNeedsSubmit(id)) pending.push(userKey(id));
    }
  }
  enqueue(pending);
  // A queued post that was captured again: keep the persisted copy as new as the in-memory one.
  if (queuedAgain.length > 0) stage(queuedAgain);
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
  /** Every record of the batch with the version it was built from, acknowledged in the outbox on success. */
  records: Array<{ key: string; rev: number }>;
}

const recordCount = (batch: RemoteDbSubmission): number => batch.posts.length + batch.users.length + batch.media.length;

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
  const records = recordKeysOf(batch).map((key) => ({ key, rev: getRecordVersion(kindOfKey(key), key.slice(key.indexOf(':') + 1)) }));
  return { batch, plans, userOnlyIds: userOnly.map((user) => user.id), userVersions, records };
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

  outbox.ackRevs(request.records);
  syncOutbox();
  noteSuccess();
}

function noteSuccess(): void {
  state.lastSubmittedAt = Date.now();
  backoffMs = BACKOFF_INITIAL_MS;
  requestRecordLimit = Math.min(MAX_REQUEST_RECORDS, Math.ceil(requestRecordLimit * 1.25));
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
  // The server rejected it for good, so it must not come back from the outbox either.
  const rejected = buildRequest([key]);
  outbox.ackRevs(rejected.records);
  if (key.startsWith('post:')) {
    const id = key.slice(5);
    if (getDbPost(id)) lastSubmittedPosts.set(id, batchSignature(id));
    state.stats.failed += 1;
    recordFailure(id, reason);
  } else {
    lastSubmittedUsers.set(key.slice(5), getRecordVersion('user', key.slice(5)));
    recordFailure(key, reason);
  }
  syncOutbox();
  return 'ok';
}

/** Records the error and decides how the loop goes on. Returns the HTTP status (0 without a response). */
function noteTransportError(error: unknown, sentRecords: number): number {
  const status = error instanceof RemoteDbHttpError ? error.status : 0;
  state.lastError = { message: error instanceof Error ? error.message : String(error), status, at: Date.now() };
  // A timeout usually means the batch was too big for the server's pace: ask for smaller ones.
  if (error instanceof RemoteDbTimeoutError) {
    requestRecordLimit = Math.max(MIN_REQUEST_RECORDS, Math.floor(Math.min(sentRecords, requestRecordLimit) / 2));
  }
  return status;
}

/** Stops the loop after a failure that is not the batch's fault: forbidden, or a backoff before the retry. */
function stopAfter(status: number): 'stop' {
  if (status === 403) flags.forbidden = true;
  // After a 401 the client refreshed the session: if it dropped, `phase` becomes needs-login by itself.
  else if (status !== 401 || isRemoteDbReady()) startBackoff();
  return 'stop';
}

/** Returns 'stop' when the keys went back to the queue (or the attempt must pause the loop). */
async function handleSubmitError(error: unknown, keys: string[], sentRecords: number): Promise<'ok' | 'stop'> {
  const status = noteTransportError(error, sentRecords);

  if (status === 400 || status === 413) {
    if (keys.length === 1) return failSingle(keys[0], state.lastError!.message);
    return submitHalves(keys);
  }

  requeue(keys);
  return stopAfter(status);
}

/** Sends the two halves one after the other; the second half goes back to the queue if the first one stopped. */
async function submitHalves(keys: string[]): Promise<'ok' | 'stop'> {
  const half = Math.ceil(keys.length / 2);
  if (await submit(keys.slice(0, half)) === 'stop') {
    requeue(keys.slice(half));
    return 'stop';
  }
  return submit(keys.slice(half));
}

function exceedsLimits(batch: RemoteDbSubmission): boolean {
  return recordCount(batch) > requestRecordLimit || JSON.stringify(batch).length > MAX_REQUEST_BYTES;
}

async function submit(keys: string[]): Promise<'ok' | 'stop'> {
  const request = buildRequest(keys);
  if (request.plans.length === 0 && request.userOnlyIds.length === 0) return 'ok';
  if (keys.length > 1 && exceedsLimits(request.batch)) return submitHalves(keys);
  state.stats.requests += 1;
  let response: RemoteDbSubmitResponse;
  try {
    response = await submitRemoteDbArchive(request.batch);
  } catch (error) {
    return handleSubmitError(error, keys, recordCount(request.batch));
  }
  applyResponse(request, response);
  return 'ok';
}

/**
 * Sends the oldest outbox records that no live queue entry covers: leftovers of an earlier page or another tab
 * (adopted), and records whose db was cleared meanwhile. They go out exactly as stored.
 */
async function submitOutbox(): Promise<'ok' | 'stop'> {
  const { taken } = packRecords(outbox.list(), { records: requestRecordLimit, bytes: MAX_REQUEST_BYTES });
  return taken.length === 0 ? 'ok' : submitStored(taken);
}

async function submitStored(records: OutboxRecord[]): Promise<'ok' | 'stop'> {
  const { batch } = packRecords(records, { records: Infinity, bytes: Infinity });
  state.stats.requests += 1;
  let response: RemoteDbSubmitResponse;
  try {
    response = await submitRemoteDbArchive(batch as unknown as RemoteDbSubmission);
  } catch (error) {
    const status = noteTransportError(error, records.length);
    if (status !== 400 && status !== 413) return stopAfter(status);
    if (records.length === 1) {
      // Rejected for good: drop it and report it like any failed record.
      outbox.ackSeqs([records[0].seq]);
      syncOutbox();
      const [kind, id] = records[0].key.split(':');
      if (kind !== 'media') recordFailure(kind === 'user' ? records[0].key : id, state.lastError!.message);
      return 'ok';
    }
    const half = Math.ceil(records.length / 2);
    return (await submitStored(records.slice(0, half))) === 'stop' ? 'stop' : submitStored(records.slice(half));
  }
  for (const item of [...response.users.map((result) => ({ ...result, id: userKey(result.id) })), ...response.posts]) {
    if (item.status === 'failed') recordFailure(item.id, item.reason ?? 'failed');
  }
  outbox.ackSeqs(records.map((record) => record.seq));
  state.outbox.resumed += records.length;
  syncOutbox();
  noteSuccess();
  return 'ok';
}

const isPhase = (phase: AutoArchivePhase) => state.phase === phase;

/** Another tab holds the send lease: look again soon, or as soon as it lets go. */
function enterStandby(): void {
  flags.standby = true;
  window.clearTimeout(standbyTimer);
  standbyTimer = window.setTimeout(flush, STANDBY_RETRY_MS);
}

/**
 * One request at a time, in one tab at a time (lease). Sends the live queue first, then what the outbox still holds.
 * Keeps going while there is work and the engine stays idle/submitting.
 */
async function pump(): Promise<void> {
  if (flags.inFlight || !(isPhase('idle') || isPhase('standby')) || !hasWork()) return;
  flags.inFlight = true;
  flags.standby = false;
  try {
    if (!(await lease.acquire())) {
      enterStandby();
      return;
    }
    if (orphanHint) {
      orphanHint = false;
      await outbox.adoptOrphans();
      syncOutbox();
    }
    while (hasWork() && isPhase('submitting')) {
      if ((queue.size > 0 ? await submit(takeBatch()) : await submitOutbox()) === 'stop') break;
      if (hasWork() && !(await lease.acquire())) {
        enterStandby();
        break;
      }
    }
  } finally {
    flags.inFlight = false;
    void lease.release();
  }
}

async function scanOrphans(): Promise<void> {
  if (!started || !config.autoArchive || flags.paused || orphanHint) return;
  try {
    orphanHint = await outbox.hasOrphans();
  } catch {
    return;
  }
  if (orphanHint) scheduleFlush();
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
  const retry: string[] = [];
  for (const { id } of state.failures) {
    if (id.startsWith('user:')) {
      lastSubmittedUsers.delete(id.slice(5));
      retry.push(id);
    } else {
      lastSubmittedPosts.delete(id);
      if (getDbPost(id)) retry.push(postKey(id));
    }
  }
  state.failures.splice(0);
  enqueue(retry);
  scheduleFlush();
}

export function startAutoArchive(): void {
  if (started) return;
  started = true;

  // Clearing the capture (autoClearOnNavigate, the 清空 buttons) must not lose what was not sent yet: the queue is
  // only an index into the db, the outbox holds the records themselves and sends them from there.
  stopDbCleared = onDbCleared(() => {
    queue.clear();
    lastSubmittedPosts.clear();
    lastSubmittedUsers.clear();
    syncQueued();
    scheduleFlush();
  });
  stopHandles = [
    watch(() => config.autoArchive, (on) => {
      if (on) {
        flags.forbidden = false;
        backoffMs = BACKOFF_INITIAL_MS;
        void scanOrphans();
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
  void outbox.open();
  stopListeners = [lease.onChange(() => { if (flags.standby) flush(); }), ...listenForPageExit()];
  orphanTimer = window.setInterval(() => void scanOrphans(), ORPHAN_SCAN_MS);
  if (config.autoArchive) {
    void scanOrphans();
    backfill();
  }
}

/**
 * Leaving the page: write the outbox now and mark it adoptable (the next page or another tab sends it), and try to
 * send what is queued right away. Neither is guaranteed to finish before the page goes, so the outbox does not rely
 * on them: it is also written a second after every change.
 */
function listenForPageExit(): Array<() => void> {
  const win = unsafeWindow;
  const onHidden = () => {
    if (win.document.visibilityState !== 'hidden') return;
    void outbox.persistNow();
    flush();
  };
  const onPageHide = () => {
    void outbox.close();
    flush();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) void outbox.open();
  };
  win.document.addEventListener('visibilitychange', onHidden);
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('pageshow', onPageShow);
  return [
    () => win.document.removeEventListener('visibilitychange', onHidden),
    () => win.removeEventListener('pagehide', onPageHide),
    () => win.removeEventListener('pageshow', onPageShow),
  ];
}

/** Stops watching and drops the queue; an in-flight request finishes but its leftovers are not requeued. The outbox keeps unsent records for the next page or tab. */
export function stopAutoArchive(): void {
  if (!started) return;
  started = false;
  for (const stop of stopHandles) stop();
  stopHandles = [];
  stopDbCleared?.();
  stopDbCleared = undefined;
  for (const stop of stopListeners) stop();
  stopListeners = [];
  window.clearInterval(orphanTimer);
  orphanTimer = undefined;
  flags.forbidden = false;
  resetQueue();
  void outbox.close();
  void lease.release();
}
