import type { DbMedia, DbTweet, DbUser } from '../db-service';
import type { RemoteDbSubmissionEnvelope, RemoteDbTweetBundle } from './types';

export interface RemoteDbEntityComparison {
  remoteStatus: 'found' | 'missing' | 'failed';
  consistent: boolean;
  message: string | null;
  error: string | null;
}

export interface RemoteDbMediaComparison {
  total: number;
  found: number;
  missing: number;
  failed: number;
  consistent: number;
  mismatchIds: string[];
  missingIds: string[];
  failedIds: string[];
}

export interface RemoteDbStatusComparison {
  tweet: RemoteDbEntityComparison;
  author: RemoteDbEntityComparison | null;
  media: RemoteDbMediaComparison;
  overallStatus: 'in_sync' | 'mismatch' | 'missing' | 'failed';
  message: string | null;
}

export interface RemoteDbSubmissionSourceItem {
  tweet: DbTweet;
  author: DbUser | undefined;
  media: DbMedia[];
}

export interface RemoteDbSubmissionBatchResult {
  submission: RemoteDbSubmissionEnvelope | null;
  missingAuthorTweetIds: string[];
  invalidUserCreatedAtIds: string[];
  invalidTweetCreatedAtIds: string[];
}

export function normalizeRemoteDbCreatedAt(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().replace('.000Z', 'Z');
}

export function buildRemoteDbSubmission(
  _tweet: DbTweet,
  _author: DbUser | undefined,
  _media: DbMedia[],
): RemoteDbSubmissionEnvelope | null {
  return null;
}

export function buildRemoteDbSubmissionBatch(
  _items: RemoteDbSubmissionSourceItem[],
): RemoteDbSubmissionBatchResult {
  return {
    submission: null,
    missingAuthorTweetIds: [],
    invalidUserCreatedAtIds: [],
    invalidTweetCreatedAtIds: [],
  };
}

export function compareRemoteDbTweetBundle(
  _tweet: DbTweet,
  _author: DbUser | undefined,
  media: DbMedia[],
  bundle: RemoteDbTweetBundle,
): RemoteDbStatusComparison {
  const missingIds = bundle.media
    .filter((item) => item.status === 'missing')
    .map((item) => item.id ?? '');
  const failedIds = bundle.media
    .filter((item) => item.status === 'failed')
    .map((item) => item.id ?? '');
  const found = bundle.media.filter((item) => item.status === 'found').length;

  return {
    tweet: {
      remoteStatus: bundle.tweet.status,
      consistent: false,
      message: 'Comparison is not implemented yet',
      error: bundle.tweet.error ?? null,
    },
    author: bundle.author
      ? {
          remoteStatus: bundle.author.status,
          consistent: false,
          message: 'Comparison is not implemented yet',
          error: bundle.author.error ?? null,
        }
      : null,
    media: {
      total: media.length,
      found,
      missing: missingIds.length,
      failed: failedIds.length,
      consistent: 0,
      mismatchIds: [],
      missingIds,
      failedIds,
    },
    overallStatus: bundle.tweet.status === 'failed' ? 'failed' : bundle.tweet.status === 'missing' ? 'missing' : 'mismatch',
    message: 'Comparison is not implemented yet',
  };
}
