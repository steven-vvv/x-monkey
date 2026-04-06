import { reactive, computed } from 'vue';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from './types';
import { mergeEntity } from './entity-merge';
import { getTweetMediaIds, getTweetReplyToTweetId } from './tweet-selectors';

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

const db = reactive<Db>({
  tweets: new Map(),
  users: new Map(),
  media: new Map(),
});

const changeCounter = reactive({ value: 0 });
let batchDepth = 0;
let batchDirty = false;

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
}

export function upsertUser(user: DbUserRecord): void {
  upsertEntity(db.users, user);
}

export function upsertMedia(media: DbMediaRecord): void {
  upsertEntity(db.media, media);
}

export function clearDb(): void {
  db.tweets.clear();
  db.users.clear();
  db.media.clear();
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
