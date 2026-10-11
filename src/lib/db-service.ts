import { reactive, computed, watch } from 'vue';
import type { Media, Post, User } from '../archive/model';
import { mergeCapturedArchiveRecord } from '../archive/merge';
import {
  buildArchiveBatch,
  compareArchiveBatch,
  getRemoteDbClientState,
  isRemoteDbReady,
  queryRemoteDbArchive,
  toArchiveQuery,
  type ArchiveRecordSource,
  type RemoteRecordStatus,
} from './remote-db';

interface Db {
  posts: Map<string, Post>;
  users: Map<string, User>;
  media: Map<string, Media>;
}

type RecordKind = 'post' | 'user' | 'media';

const REMOTE_STATUS_BATCH_SIZE = 50;
const REMOTE_SYNC_RETRY_INITIAL_MS = 1000;
const REMOTE_SYNC_RETRY_MAX_MS = 60_000;

const db = reactive<Db>({
  posts: new Map(),
  users: new Map(),
  media: new Map(),
});

/** Change counters per record, kept outside the records because records are submitted verbatim. */
const recordVersions = new Map<string, number>();
const changeCounter = reactive({ value: 0 });
const remoteDbState = getRemoteDbClientState();
const remoteSyncStatuses = reactive<Record<string, RemoteRecordStatus | undefined>>({});
const remoteSyncPendingPostIds = new Set<string>();
/** Bumped when a submit confirms a post, so a status query already in flight cannot overwrite it. */
const remoteSyncConfirmations = new Map<string, number>();
let batchDepth = 0;
let batchDirty = false;
let remoteSyncScheduled = false;
let remoteSyncRunning = false;
let remoteSyncEpoch = 0;
let remoteSyncRetryDelayMs = REMOTE_SYNC_RETRY_INITIAL_MS;

function bump() {
  changeCounter.value += 1;
}

function markDirty() {
  if (batchDepth > 0) {
    batchDirty = true;
    return;
  }
  bump();
}

function upsertRecord<T extends { id: string }>(kind: RecordKind, map: Map<string, T>, record: T): boolean {
  const existing = map.get(record.id);
  if (existing) {
    if (!mergeCapturedArchiveRecord(existing as Record<string, unknown>, record as Record<string, unknown>)) return false;
  } else {
    map.set(record.id, record);
  }

  const key = `${kind}:${record.id}`;
  recordVersions.set(key, (recordVersions.get(key) ?? 0) + 1);
  markDirty();
  return true;
}

export function runDbBatch(fn: () => void): void {
  batchDepth += 1;
  try {
    fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0 && batchDirty) {
      batchDirty = false;
      bump();
    }
  }
}

export function upsertPost(post: Post): void {
  if (upsertRecord('post', db.posts, post)) enqueueRemoteSyncStatusRefresh(getPostsDependingOn('post', post.id));
}

export function upsertUser(user: User): void {
  if (upsertRecord('user', db.users, user)) enqueueRemoteSyncStatusRefresh(getPostsDependingOn('user', user.id));
}

export function upsertMedia(media: Media): void {
  if (upsertRecord('media', db.media, media)) enqueueRemoteSyncStatusRefresh(getPostsDependingOn('media', media.id));
}

const dbClearedListeners = new Set<() => void>();

/** Calls `listener` after every `clearDb`; returns the unsubscribe function. */
export function onDbCleared(listener: () => void): () => void {
  dbClearedListeners.add(listener);
  return () => dbClearedListeners.delete(listener);
}

export function clearDb(): void {
  db.posts.clear();
  db.users.clear();
  db.media.clear();
  recordVersions.clear();
  clearRemoteSyncStatuses();
  bump();
  for (const listener of dbClearedListeners) listener();
}

export const dbVersion = computed(() => changeCounter.value);

export function getDbPost(id: string): Post | undefined {
  return db.posts.get(id);
}

export function getDbUser(id: string): User | undefined {
  return db.users.get(id);
}

export function getDbMedia(id: string): Media | undefined {
  return db.media.get(id);
}

export function getAllPosts(): Post[] {
  return Array.from(db.posts.values());
}

export function getPostCount(): number {
  return db.posts.size;
}

/** The post whose content is shown for `post`: the original for a pure repost. */
export function getDisplayPost(post: Post): Post {
  return (post.repostOf && db.posts.get(post.repostOf)) || post;
}

export function getMediaForPost(post: Post): Media[] {
  return (post.mediaIds ?? []).map((id) => db.media.get(id)).filter((item): item is Media => !!item);
}

export function getParentChain(postId: string): Post[] {
  const chain: Post[] = [];
  const seen = new Set([postId]);
  let parentId = db.posts.get(postId)?.replyTo?.postId;

  while (parentId && !seen.has(parentId)) {
    const parent = db.posts.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    chain.unshift(parent);
    parentId = parent.replyTo?.postId;
  }

  return chain;
}

export function getReplies(postId: string): Post[] {
  return getAllPosts().filter((post) => post.replyTo?.postId === postId);
}

export const archiveRecords: ArchiveRecordSource = {
  getPost: (id) => db.posts.get(id),
  getUser: (id) => db.users.get(id),
  getMedia: (id) => db.media.get(id),
};

/** Posts whose submission batch contains the given record. */
function getPostsDependingOn(kind: RecordKind, id: string): string[] {
  const direct = getAllPosts().filter((post) => {
    if (kind === 'post') return post.id === id || post.repostOf === id || post.quote?.postId === id;
    if (kind === 'user') return post.authorId === id;
    return post.mediaIds?.includes(id) || post.article?.coverMediaId === id || post.article?.mediaIds?.includes(id);
  }).map((post) => post.id);
  const reposts = getAllPosts().filter((post) => post.repostOf && direct.includes(post.repostOf)).map((post) => post.id);
  return [...new Set([...direct, ...reposts])];
}

export function getRemoteSyncStatus(postId: string): RemoteRecordStatus | undefined {
  if (!isRemoteDbReady()) return undefined;
  return remoteSyncStatuses[postId];
}

export function enqueueRemoteSyncStatusRefresh(postIds: string[]): void {
  if (!isRemoteDbReady()) return;

  for (const postId of postIds) {
    if (db.posts.has(postId)) remoteSyncPendingPostIds.add(postId);
  }
  scheduleRemoteSyncStatusRefresh();
}

function clearRemoteSyncStatuses(): void {
  remoteSyncEpoch += 1;
  remoteSyncRetryDelayMs = REMOTE_SYNC_RETRY_INITIAL_MS;
  remoteSyncPendingPostIds.clear();
  remoteSyncConfirmations.clear();
  for (const postId of Object.keys(remoteSyncStatuses)) {
    delete remoteSyncStatuses[postId];
  }
}

/** Change counter of one record (0 if it was never stored); users are tracked for auto-archive dedup. */
export function getRecordVersion(kind: RecordKind, id: string): number {
  return recordVersions.get(`${kind}:${id}`) ?? 0;
}

/**
 * Marks a post as in sync after a successful submit of the batch with `signature`.
 * If the post changed since, its status is re-queried instead.
 */
export function markRemoteSyncInSync(postId: string, signature: string): void {
  if (!db.posts.has(postId)) return;
  if (batchSignature(postId) !== signature) {
    enqueueRemoteSyncStatusRefresh([postId]);
    return;
  }
  remoteSyncPendingPostIds.delete(postId);
  remoteSyncConfirmations.set(postId, (remoteSyncConfirmations.get(postId) ?? 0) + 1);
  remoteSyncStatuses[postId] = 'in_sync';
}

/** Identifies the exact record versions in a post's submission batch. */
export function batchSignature(postId: string): string {
  const { batch } = buildArchiveBatch([postId], archiveRecords);
  return [
    ...batch.posts.map((item) => `post:${item.id}`),
    ...batch.users.map((item) => `user:${item.id}`),
    ...batch.media.map((item) => `media:${item.id}`),
  ].map((key) => `${key}@${recordVersions.get(key) ?? 0}`).join(',');
}

function scheduleRemoteSyncStatusRefresh(delayMs = 0): void {
  if (remoteSyncScheduled || remoteSyncRunning || remoteSyncPendingPostIds.size === 0) return;

  remoteSyncScheduled = true;
  window.setTimeout(() => {
    remoteSyncScheduled = false;
    void processRemoteSyncQueue();
  }, delayMs);
}

async function processRemoteSyncQueue(): Promise<void> {
  if (remoteSyncRunning) return;

  remoteSyncRunning = true;
  try {
    while (remoteSyncPendingPostIds.size > 0 && isRemoteDbReady()) {
      const postIds = [...remoteSyncPendingPostIds].slice(0, REMOTE_STATUS_BATCH_SIZE)
        .filter((postId) => remoteSyncPendingPostIds.delete(postId) && db.posts.has(postId));
      if (postIds.length === 0) continue;

      const batches = postIds.map((postId) => ({
        postId,
        batch: buildArchiveBatch([postId], archiveRecords).batch,
        signature: batchSignature(postId),
        confirmation: remoteSyncConfirmations.get(postId),
      }));
      const query = toArchiveQuery(buildArchiveBatch(postIds, archiveRecords).batch);

      const epoch = remoteSyncEpoch;
      let response: Awaited<ReturnType<typeof queryRemoteDbArchive>>;
      try {
        response = await queryRemoteDbArchive(query);
      } catch {
        // Keep this batch pending: a transient network error, a 401 refresh or
        // a 5xx must not silently drop the status checks for these posts.
        for (const postId of postIds) remoteSyncPendingPostIds.add(postId);
        remoteSyncRetryDelayMs = Math.min(REMOTE_SYNC_RETRY_MAX_MS, remoteSyncRetryDelayMs * 2);
        return;
      }

      remoteSyncRetryDelayMs = REMOTE_SYNC_RETRY_INITIAL_MS;
      if (epoch !== remoteSyncEpoch) continue;

      for (const { postId, batch, signature, confirmation } of batches) {
        if (!db.posts.has(postId) || remoteSyncConfirmations.get(postId) !== confirmation) continue;
        if (batchSignature(postId) !== signature) {
          remoteSyncPendingPostIds.add(postId);
          continue;
        }
        remoteSyncStatuses[postId] = compareArchiveBatch(batch, response).status;
      }
    }
  } finally {
    remoteSyncRunning = false;
    if (remoteSyncPendingPostIds.size > 0 && isRemoteDbReady()) {
      scheduleRemoteSyncStatusRefresh(
        remoteSyncRetryDelayMs === REMOTE_SYNC_RETRY_INITIAL_MS ? 0 : remoteSyncRetryDelayMs,
      );
    }
  }
}

watch(
  () => [
    remoteDbState.baseUrl ?? '',
    remoteDbState.lifecycle,
    remoteDbState.sessionState,
    String(remoteDbState.runtimeEnabled),
  ] as const,
  () => {
    if (isRemoteDbReady()) enqueueRemoteSyncStatusRefresh([...db.posts.keys()]);
  },
  { immediate: true },
);
