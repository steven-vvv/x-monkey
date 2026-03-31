import { reactive, computed } from 'vue';
import type { XUser, XTweet, XMedia } from './types';
import { mergeEntity } from './entity-merge';

export interface DbTweet extends XTweet {
  _ts: number;
  _focal: boolean;
}

export interface DbUser extends XUser {
  _ts: number;
}

export interface DbMedia extends XMedia {
  _ts: number;
  _focal: boolean;
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

let changeCounter = reactive({ value: 0 });
let batchDepth = 0;
let batchDirty = false;

function bump() {
  changeCounter.value++;
}

function markDirty() {
  if (batchDepth > 0) {
    batchDirty = true;
    return;
  }
  bump();
}

export function runDbBatch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && batchDirty) {
      batchDirty = false;
      bump();
    }
  }
}

export function upsertTweet(tweet: XTweet, focal: boolean): void {
  const now = Date.now();
  const existing = db.tweets.get(tweet.id);

  if (existing) {
    if (existing._focal && !focal) {
      return;
    }
    const previousTs = existing._ts;
    const previousFocal = existing._focal;
    const changed = mergeEntity(existing, tweet);
    existing._ts = now;
    existing._focal = previousFocal || focal;
    if (changed || previousTs !== existing._ts || previousFocal !== existing._focal) {
      markDirty();
    }
  } else {
    db.tweets.set(tweet.id, { ...tweet, _ts: now, _focal: focal });
    markDirty();
  }
}

export function upsertUser(user: XUser): void {
  const now = Date.now();
  const existing = db.users.get(user.id);
  if (existing) {
    const previousTs = existing._ts;
    const changed = mergeEntity(existing, user);
    existing._ts = now;
    if (changed || previousTs !== existing._ts) {
      markDirty();
    }
  } else {
    db.users.set(user.id, { ...user, _ts: now });
    markDirty();
  }
}

export function upsertMedia(media: XMedia, focal: boolean): void {
  const now = Date.now();
  const existing = db.media.get(media.id);

  if (existing) {
    if (existing._focal && !focal) {
      return;
    }
    const previousTs = existing._ts;
    const previousFocal = existing._focal;
    const changed = mergeEntity(existing, media);
    existing._ts = now;
    existing._focal = previousFocal || focal;
    if (changed || previousTs !== existing._ts || previousFocal !== existing._focal) {
      markDirty();
    }
  } else {
    db.media.set(media.id, { ...media, _ts: now, _focal: focal });
    markDirty();
  }
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

export function getFocalTweets(): DbTweet[] {
  return Array.from(db.tweets.values()).filter((t) => t._focal);
}

export function getTweetCount(): number {
  return db.tweets.size;
}

export function getParentChain(tweetId: string): DbTweet[] {
  const chain: DbTweet[] = [];
  let current = db.tweets.get(tweetId);
  while (current?.inReplyToTweetId) {
    const parent = db.tweets.get(current.inReplyToTweetId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

export function getReplies(tweetId: string): DbTweet[] {
  const result: DbTweet[] = [];
  for (const tweet of db.tweets.values()) {
    if (tweet.inReplyToTweetId === tweetId) result.push(tweet);
  }
  return result;
}

export function getMediaForTweet(tweetId: string): DbMedia[] {
  const tweet = db.tweets.get(tweetId);
  if (!tweet) return [];
  return tweet.mediaIds.map((id) => db.media.get(id)).filter(Boolean) as DbMedia[];
}
