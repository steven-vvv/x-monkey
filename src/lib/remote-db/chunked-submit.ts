import type { ArchiveBatch } from '../../archive/model';
import { buildArchiveBatch, type ArchiveRecordSource } from './adapter';
import { RemoteDbHttpError, RemoteDbNetworkError, RemoteDbTimeoutError } from './errors';
import { MAX_REQUEST_BYTES, MAX_REQUEST_RECORDS } from './limits';
import type { RemoteDbSubmission, RemoteDbSubmitResponse } from './types';

/** Retries per request on 503 / 429 / timeout / network errors (so up to 4 attempts). */
export const CHUNK_MAX_RETRIES = 3;
const RETRY_INITIAL_MS = 2000;
const RETRY_MAX_MS = 30_000;
/** A longer `Retry-After` than this is clamped: the user is waiting on the button. */
const RETRY_AFTER_MAX_MS = 60_000;

/** A manual submit stopped part-way. `submittedPostIds` were stored; sending them again is harmless. */
export class RemoteDbChunkedSubmitError extends Error {
  readonly submittedPostIds: string[];
  readonly totalPosts: number;
  readonly cause: unknown;

  constructor(cause: unknown, submittedPostIds: string[], totalPosts: number) {
    const reason = cause instanceof Error && cause.message.trim() ? cause.message : '提交到远端数据库失败';
    super(`${reason}（已提交 ${submittedPostIds.length}/${totalPosts} 条，可重试，已提交的重复发送无妨）`);
    this.name = 'RemoteDbChunkedSubmitError';
    this.cause = cause;
    this.submittedPostIds = submittedPostIds;
    this.totalPosts = totalPosts;
  }
}

export interface ChunkedSubmitOptions {
  /** Called with 0 before the first request and again after each stored chunk; counts posts. */
  onProgress?: (done: number, total: number) => void;
  maxRecords?: number;
  maxBytes?: number;
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface ChunkedSubmitDeps {
  submit: (batch: RemoteDbSubmission) => Promise<RemoteDbSubmitResponse>;
}

const utf8 = new TextEncoder();
const byteLength = (value: unknown): number => utf8.encode(JSON.stringify(value)).length;

export function emptySubmitResponse(): RemoteDbSubmitResponse {
  return { summary: { accepted: 0, unchanged: 0, partial: 0, failed: 0, total: 0 }, users: [], posts: [], media: [] };
}

/** Sums the summaries and concatenates the per-record arrays. */
export function mergeSubmitResponses(responses: readonly RemoteDbSubmitResponse[]): RemoteDbSubmitResponse {
  const merged = emptySubmitResponse();
  for (const response of responses) {
    for (const key of Object.keys(merged.summary) as Array<keyof RemoteDbSubmitResponse['summary']>) {
      merged.summary[key] += response.summary?.[key] ?? 0;
    }
    merged.users.push(...(response.users ?? []));
    merged.posts.push(...(response.posts ?? []));
    merged.media.push(...(response.media ?? []));
  }
  return merged;
}

/**
 * Groups post ids into chunks whose batches stay within the record and byte limits. Each post is costed with the
 * records `buildArchiveBatch` collects for it (author, media, repost / quote); a record shared by posts of one chunk
 * counts once. A single post over the limits gets a chunk of its own. Posts not held locally are left out.
 */
export function planChunks(
  postIds: readonly string[],
  source: ArchiveRecordSource,
  limits: { maxRecords: number; maxBytes: number },
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let seen = new Set<string>();
  let records = 0;
  let bytes = 0;

  for (const id of new Set(postIds)) {
    const { batch, missingPostIds } = buildArchiveBatch([id], source);
    if (missingPostIds.length > 0) continue;

    // Every record of the post with its size (`+ 1` for the separating comma).
    const entries: Array<[string, number]> = [
      ...batch.users.map((item): [string, number] => [`user:${item.id}`, byteLength(item) + 1]),
      ...batch.posts.map((item): [string, number] => [`post:${item.id}`, byteLength(item) + 1]),
      ...batch.media.map((item): [string, number] => [`media:${item.id}`, byteLength(item) + 1]),
    ];
    const freshOf = (known: Set<string>) => entries.filter(([key]) => !known.has(key));
    let fresh = freshOf(seen);
    const freshBytes = fresh.reduce((sum, [, size]) => sum + size, 0);

    if (current.length > 0 && (records + fresh.length > limits.maxRecords || bytes + freshBytes > limits.maxBytes)) {
      chunks.push(current);
      current = [];
      seen = new Set();
      records = 0;
      bytes = 0;
      fresh = entries;
    }

    current.push(id);
    for (const [key, size] of fresh) {
      seen.add(key);
      records += 1;
      bytes += size;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function retryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof RemoteDbHttpError && error.retryAfterMs !== undefined) {
    return Math.min(RETRY_AFTER_MAX_MS, error.retryAfterMs);
  }
  return Math.min(RETRY_MAX_MS, RETRY_INITIAL_MS * 2 ** attempt);
}

const isTransient = (error: unknown): boolean => error instanceof RemoteDbTimeoutError
  || error instanceof RemoteDbNetworkError
  || (error instanceof RemoteDbHttpError && (error.status === 503 || error.status === 429));

const isBadBatch = (error: unknown): boolean => error instanceof RemoteDbHttpError
  && (error.status === 400 || error.status === 413);

/**
 * Submits posts (with their author, media and quoted / reposted records) in sequential requests of at most
 * `maxRecords` records and `maxBytes` bytes, and returns the merged response. Retries 503 / timeouts / network
 * errors with backoff (honouring `Retry-After`), splits a chunk the server rejects with 400 / 413, and stops at once
 * on anything else (401 / 403 are rethrown unchanged so callers can show their dedicated message). Any other
 * failure throws `RemoteDbChunkedSubmitError` carrying how many posts were stored.
 */
export async function submitPostsChunked(
  postIds: readonly string[],
  source: ArchiveRecordSource,
  deps: ChunkedSubmitDeps,
  options: ChunkedSubmitOptions = {},
): Promise<RemoteDbSubmitResponse> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const chunks = planChunks(postIds, source, {
    maxRecords: options.maxRecords ?? MAX_REQUEST_RECORDS,
    maxBytes: options.maxBytes ?? MAX_REQUEST_BYTES,
  });
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const responses: RemoteDbSubmitResponse[] = [];
  const submitted: string[] = [];
  options.onProgress?.(0, total);

  const sendWithRetry = async (batch: ArchiveBatch): Promise<RemoteDbSubmitResponse> => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await deps.submit(batch);
      } catch (error) {
        if (attempt >= CHUNK_MAX_RETRIES || !isTransient(error)) throw error;
        await sleep(retryDelayMs(error, attempt));
      }
    }
  };

  const sendChunk = async (ids: string[]): Promise<void> => {
    const { batch } = buildArchiveBatch(ids, source);
    let response: RemoteDbSubmitResponse;
    try {
      response = await sendWithRetry(batch);
    } catch (error) {
      if (isBadBatch(error) && ids.length > 1) {
        const half = Math.ceil(ids.length / 2);
        await sendChunk(ids.slice(0, half));
        await sendChunk(ids.slice(half));
        return;
      }
      throw error;
    }
    responses.push(response);
    submitted.push(...ids);
    options.onProgress?.(submitted.length, total);
  };

  try {
    for (const chunk of chunks) await sendChunk(chunk);
  } catch (error) {
    if (error instanceof RemoteDbHttpError && (error.status === 401 || error.status === 403)) throw error;
    // Nothing to report for a lone post.
    if (total <= 1) throw error;
    throw new RemoteDbChunkedSubmitError(error, submitted, total);
  }
  return mergeSubmitResponses(responses);
}
