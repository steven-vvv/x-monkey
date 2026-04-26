import { reactive, computed, watch } from 'vue';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from './types';
import { mergeEntity } from './entity-merge';
import { getTweetMediaIds, getTweetReplyToTweetId } from './tweet-selectors';
import {
  compareRemoteDbTweetBundle,
  getRemoteDbClientState,
  isRemoteDbTweetApiReady,
  queryRemoteDbTweetBundles,
  type RemoteDbStatusComparison,
  type RemoteDbTweetBundle,
} from './remote-db';

export interface DbTweet extends DbTweetRecord {
  _ts: number;
}

export interface DbUser extends DbUserRecord {
  _ts: number;
}

export interface DbMedia extends DbMediaRecord {
  _ts: number;
}

interface Db {
  tweets: Map<string, DbTweet>;
  users: Map<string, DbUser>;
  media: Map<string, DbMedia>;
}

interface RemoteSyncSnapshot {
  tweet: DbTweet;
  author: DbUser | undefined;
  media: DbMedia[];
  signature: string;
}

export type DbRemoteTweetSyncStatus = RemoteDbStatusComparison['overallStatus'];

const REMOTE_STATUS_BATCH_SIZE = 50;
const REMOTE_DB_MISSING_SELECTOR_RESULT_ERROR = 'Remote database response is missing this selector result';

const db = reactive<Db>({
  tweets: new Map(),
  users: new Map(),
  media: new Map(),
});

const changeCounter = reactive({ value: 0 });
const remoteDbState = getRemoteDbClientState();
const remoteTweetSyncStatuses = reactive<Record<string, DbRemoteTweetSyncStatus | undefined>>({});
const remoteSyncPendingTweetIds = new Set<string>();
let batchDepth = 0;
let batchDirty = false;
let remoteSyncScheduled = false;
let remoteSyncRunning = false;
let remoteSyncEpoch = 0;

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

function upsertEntity<T extends { id: string; _ts: number }>(
  map: Map<string, T>,
  entity: Omit<T, '_ts'>,
): void {
  const now = Date.now();
  const existing = map.get(entity.id);

  if (existing) {
    const previousTs = existing._ts;
    const changed = mergeEntity(existing as Record<string, unknown>, entity as Record<string, unknown>);
    existing._ts = now;
    if (changed || previousTs !== existing._ts) {
      markDirty();
    }
    return;
  }

  map.set(entity.id, { ...entity, _ts: now } as T);
  markDirty();
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

export function upsertTweet(tweet: DbTweetRecord): void {
  upsertEntity(db.tweets, tweet);
  enqueueRemoteTweetSyncStatusRefresh([tweet.id]);
}

export function upsertUser(user: DbUserRecord): void {
  upsertEntity(db.users, user);
  enqueueRemoteTweetSyncStatusRefresh(getTweetIdsForAuthor(user.id));
}

export function upsertMedia(media: DbMediaRecord): void {
  upsertEntity(db.media, media);
  enqueueRemoteTweetSyncStatusRefresh(getTweetIdsForMedia(media.id, media.origin?.tweetId));
}

export function clearDb(): void {
  db.tweets.clear();
  db.users.clear();
  db.media.clear();
  clearRemoteTweetSyncStatuses();
  bump();
}

export const dbVersion = computed(() => changeCounter.value);

export function getDbTweet(id: string): DbTweet | undefined {
  return db.tweets.get(id);
}

export function getDbUser(id: string): DbUser | undefined {
  return db.users.get(id);
}

export function getDbMedia(id: string): DbMedia | undefined {
  return db.media.get(id);
}

export function getAllTweets(): DbTweet[] {
  return Array.from(db.tweets.values());
}

export function getAllUsers(): DbUser[] {
  return Array.from(db.users.values());
}

export function getTweetCount(): number {
  return db.tweets.size;
}

export function getRemoteTweetSyncStatus(tweetId: string): DbRemoteTweetSyncStatus | undefined {
  if (!isRemoteDbTweetApiReady()) return undefined;
  return remoteTweetSyncStatuses[tweetId];
}

export function enqueueRemoteTweetSyncStatusRefresh(tweetIds: string[]): void {
  if (!isRemoteDbTweetApiReady()) return;

  for (const tweetId of tweetIds) {
    if (db.tweets.has(tweetId)) {
      remoteSyncPendingTweetIds.add(tweetId);
    }
  }

  scheduleRemoteTweetSyncStatusRefresh();
}

export function getParentChain(tweetId: string): DbTweet[] {
  const chain: DbTweet[] = [];
  let current = db.tweets.get(tweetId);

  while (current) {
    const replyToTweetId = getTweetReplyToTweetId(current);
    if (!replyToTweetId) break;

    const parent = db.tweets.get(replyToTweetId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }

  return chain;
}

export function getReplies(tweetId: string): DbTweet[] {
  const result: DbTweet[] = [];
  for (const tweet of db.tweets.values()) {
    if (getTweetReplyToTweetId(tweet) === tweetId) {
      result.push(tweet);
    }
  }
  return result;
}

export function getMediaForTweet(tweetId: string): DbMedia[] {
  const tweet = db.tweets.get(tweetId);
  if (!tweet) return [];
  return getTweetMediaIds(tweet).map((id) => db.media.get(id)).filter(Boolean) as DbMedia[];
}

function getTweetIdsForAuthor(authorId: string): string[] {
  const tweetIds: string[] = [];
  for (const tweet of db.tweets.values()) {
    if (tweet.authorId === authorId) {
      tweetIds.push(tweet.id);
    }
  }
  return tweetIds;
}

function getTweetIdsForMedia(mediaId: string, originTweetId?: string): string[] {
  const tweetIds = new Set<string>();
  if (originTweetId && db.tweets.has(originTweetId)) {
    tweetIds.add(originTweetId);
  }

  for (const tweet of db.tweets.values()) {
    if (getTweetMediaIds(tweet).includes(mediaId)) {
      tweetIds.add(tweet.id);
    }
  }

  return [...tweetIds];
}

function clearRemoteTweetSyncStatuses(): void {
  remoteSyncEpoch += 1;
  remoteSyncPendingTweetIds.clear();
  for (const tweetId of Object.keys(remoteTweetSyncStatuses)) {
    delete remoteTweetSyncStatuses[tweetId];
  }
}

function createRemoteSyncSignature(
  tweet: DbTweet,
  author: DbUser | undefined,
  media: DbMedia[],
): string {
  return [
    tweet.id,
    changeCounter.value,
    tweet._ts,
    author?._ts ?? 0,
    media.map((item) => `${item.id}:${item._ts}`).join(','),
  ].join('|');
}

function createRemoteSyncSnapshot(tweetId: string): RemoteSyncSnapshot | null {
  const tweet = db.tweets.get(tweetId);
  if (!tweet) return null;

  const author = db.users.get(tweet.authorId);
  const media = getTweetMediaIds(tweet)
    .map((id) => db.media.get(id))
    .filter(Boolean) as DbMedia[];

  return {
    tweet,
    author,
    media,
    signature: createRemoteSyncSignature(tweet, author, media),
  };
}

function hasRemoteTweetSelectorResult(bundle: RemoteDbTweetBundle): boolean {
  return bundle.tweet.status !== 'failed'
    || bundle.tweet.error !== REMOTE_DB_MISSING_SELECTOR_RESULT_ERROR;
}

function isRemoteSyncSnapshotCurrent(snapshot: RemoteSyncSnapshot): boolean {
  const current = createRemoteSyncSnapshot(snapshot.tweet.id);
  return current?.signature === snapshot.signature;
}

function scheduleRemoteTweetSyncStatusRefresh(): void {
  if (remoteSyncScheduled || remoteSyncRunning || remoteSyncPendingTweetIds.size === 0) {
    return;
  }

  remoteSyncScheduled = true;
  window.setTimeout(() => {
    remoteSyncScheduled = false;
    void processRemoteTweetSyncQueue();
  }, 0);
}

async function processRemoteTweetSyncQueue(): Promise<void> {
  if (remoteSyncRunning) return;

  remoteSyncRunning = true;
  try {
    while (remoteSyncPendingTweetIds.size > 0 && isRemoteDbTweetApiReady()) {
      const tweetIds = [...remoteSyncPendingTweetIds].slice(0, REMOTE_STATUS_BATCH_SIZE);
      for (const tweetId of tweetIds) {
        remoteSyncPendingTweetIds.delete(tweetId);
      }

      const snapshots = tweetIds
        .map((tweetId) => {
          const snapshot = createRemoteSyncSnapshot(tweetId);
          if (!snapshot) {
            delete remoteTweetSyncStatuses[tweetId];
          }
          return snapshot;
        })
        .filter(Boolean) as RemoteSyncSnapshot[];

      if (snapshots.length === 0) continue;

      const epoch = remoteSyncEpoch;
      let bundles: RemoteDbTweetBundle[];
      try {
        bundles = await queryRemoteDbTweetBundles({
          items: snapshots.map((snapshot) => ({
            tweetId: snapshot.tweet.id,
            authorId: snapshot.author?.id,
            mediaIds: snapshot.media.map((media) => media.id),
          })),
        });
      } catch {
        return;
      }

      if (epoch !== remoteSyncEpoch) {
        continue;
      }

      for (const [index, bundle] of bundles.entries()) {
        const snapshot = snapshots[index];
        if (!snapshot || !hasRemoteTweetSelectorResult(bundle)) continue;

        if (!isRemoteSyncSnapshotCurrent(snapshot)) {
          remoteSyncPendingTweetIds.add(snapshot.tweet.id);
          continue;
        }

        remoteTweetSyncStatuses[snapshot.tweet.id] = compareRemoteDbTweetBundle(
          snapshot.tweet,
          snapshot.author,
          snapshot.media,
          bundle,
        ).overallStatus;
      }
    }
  } finally {
    remoteSyncRunning = false;
    if (remoteSyncPendingTweetIds.size > 0 && isRemoteDbTweetApiReady()) {
      scheduleRemoteTweetSyncStatusRefresh();
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
    if (isRemoteDbTweetApiReady()) {
      enqueueRemoteTweetSyncStatusRefresh([...db.tweets.keys()]);
    }
  },
  { immediate: true },
);
