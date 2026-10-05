import type { ArchiveBatch, Media, Post, User } from '../../archive/model';
import { cloneRecord, mergeArchiveRecord } from '../../archive/merge';
import type { RemoteDbQueryRequest, RemoteDbQueryResponse, RemoteDbQueryResult } from './types';

/** Read access to the records held locally. */
export interface ArchiveRecordSource {
  getPost(id: string): Post | undefined;
  getUser(id: string): User | undefined;
  getMedia(id: string): Media | undefined;
}

export interface ArchiveBatchBuildResult {
  batch: ArchiveBatch;
  /** Requested posts that are not held locally. */
  missingPostIds: string[];
}

/**
 * Collects what each post needs to be shown on its own: the post, its author
 * and media, plus the reposted post and the quoted post (one level) with their
 * authors and media.
 */
export function buildArchiveBatch(postIds: readonly string[], source: ArchiveRecordSource): ArchiveBatchBuildResult {
  const posts = new Map<string, Post>();
  const users = new Map<string, User>();
  const media = new Map<string, Media>();
  const missingPostIds: string[] = [];

  const visit = (id: string, followQuote: boolean): boolean => {
    const post = source.getPost(id);
    if (!post) return false;
    if (posts.has(id)) return true;
    posts.set(id, post);

    const author = source.getUser(post.authorId);
    if (author) users.set(author.id, author);
    for (const mediaId of post.mediaIds ?? []) {
      const item = source.getMedia(mediaId);
      if (item) media.set(item.id, item);
    }
    if (post.article?.coverMediaId || post.article?.mediaIds) {
      for (const mediaId of [post.article.coverMediaId, ...(post.article.mediaIds ?? [])]) {
        const item = mediaId ? source.getMedia(mediaId) : undefined;
        if (item) media.set(item.id, item);
      }
    }
    if (post.repostOf) visit(post.repostOf, true);
    if (followQuote && post.quote) visit(post.quote.postId, false);
    return true;
  };

  for (const id of postIds) {
    if (!visit(id, true)) missingPostIds.push(id);
  }

  return {
    batch: { users: [...users.values()], posts: [...posts.values()], media: [...media.values()] },
    missingPostIds,
  };
}

export function toArchiveQuery(batch: ArchiveBatch): RemoteDbQueryRequest {
  return {
    users: batch.users.map((item) => item.id),
    posts: batch.posts.map((item) => item.id),
    media: batch.media.map((item) => item.id),
  };
}

/**
 * - `in_sync`: submitting would change nothing
 * - `stale`: only counters (likes, views, followers, poll votes …) differ
 * - `mismatch`: submitting would change stored content
 */
export type RemoteRecordStatus = 'in_sync' | 'stale' | 'mismatch' | 'missing' | 'failed';

export interface RemoteRecordComparison {
  kind: 'user' | 'post' | 'media';
  id: string;
  status: RemoteRecordStatus;
  error?: string;
}

export interface RemoteBatchComparison {
  status: RemoteRecordStatus;
  records: RemoteRecordComparison[];
}

const STATUS_PRECEDENCE: RemoteRecordStatus[] = ['failed', 'missing', 'mismatch', 'stale', 'in_sync'];

type ComparableRecord = { id: string; counts?: object; card?: { poll?: { choices: Array<{ count?: number }>; updatedAt?: string } } };

/**
 * Splits a record into its content and its counters. Counters change from one
 * capture to the next: the engagement counts, and the tally of a poll (the
 * vote counts and the time X last updated them).
 */
function splitCounters(record: ComparableRecord): { content: Record<string, unknown>; counters: Record<string, unknown> } {
  const { counts, ...content } = cloneRecord(record);
  const counters: Record<string, unknown> = counts ? { counts } : {};
  const poll = content.card?.poll;
  if (poll) {
    counters.poll = { votes: poll.choices.map((choice) => choice.count ?? null), updatedAt: poll.updatedAt };
    for (const choice of poll.choices) delete choice.count;
    delete poll.updatedAt;
  }
  return { content, counters };
}

function compareRecord<T extends ComparableRecord>(
  kind: RemoteRecordComparison['kind'],
  local: T,
  result: RemoteDbQueryResult<T> | undefined,
): RemoteRecordComparison {
  if (!result) return { kind, id: local.id, status: 'failed', error: 'No result returned for this record' };
  if (result.status !== 'found' || !result.data) {
    return { kind, id: local.id, status: result.status === 'found' ? 'failed' : result.status, error: result.error };
  }

  // The server merges submissions with the same rules, so a record is in sync
  // exactly when merging the local copy into the stored one changes nothing.
  const localParts = splitCounters(local);
  const remoteParts = splitCounters(result.data);
  if (mergeArchiveRecord(remoteParts.content, localParts.content)) {
    return { kind, id: local.id, status: 'mismatch' };
  }
  const stale = mergeArchiveRecord(remoteParts.counters, localParts.counters);
  return { kind, id: local.id, status: stale ? 'stale' : 'in_sync' };
}

export function compareArchiveBatch(batch: ArchiveBatch, response: RemoteDbQueryResponse): RemoteBatchComparison {
  const byId = <T extends { id: string }>(results: Array<RemoteDbQueryResult<T>>) => new Map(results.map((item) => [item.id, item]));
  const users = byId(response.users);
  const posts = byId(response.posts);
  const media = byId(response.media);

  const records = [
    ...batch.posts.map((item) => compareRecord('post', item, posts.get(item.id))),
    ...batch.users.map((item) => compareRecord('user', item, users.get(item.id))),
    ...batch.media.map((item) => compareRecord('media', item, media.get(item.id))),
  ];
  const status = STATUS_PRECEDENCE.find((candidate) => records.some((record) => record.status === candidate)) ?? 'in_sync';
  return { status, records };
}
