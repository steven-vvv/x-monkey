import type {
  RemoteDbPostStatusItem,
  RemoteDbSubmissionEnvelope,
  RemoteDbTransferSummary,
} from './types';

export interface RemoteDbStatusComparison {
  exists: boolean;
  consistent: boolean;
  mismatchReason: string | null;
  expectedMediaCount: number;
  transferSummary: RemoteDbTransferSummary;
}

export interface RemoteDbSubmissionSourceItem {
  tweet: { id: string };
  author: { id: string } | undefined;
  media: Array<{ id: string }>;
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
  tweet: RemoteDbSubmissionSourceItem['tweet'],
  author: RemoteDbSubmissionSourceItem['author'],
  media: RemoteDbSubmissionSourceItem['media'],
): RemoteDbSubmissionEnvelope | null {
  void tweet;
  void author;
  void media;
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

export function compareRemoteDbPostStatus(
  _tweet: RemoteDbSubmissionSourceItem['tweet'],
  _author: RemoteDbSubmissionSourceItem['author'],
  _media: RemoteDbSubmissionSourceItem['media'],
  remoteItem: RemoteDbPostStatusItem,
): RemoteDbStatusComparison {
  return {
    exists: remoteItem.found,
    consistent: false,
    mismatchReason: 'Remote database integration is disabled',
    expectedMediaCount: 0,
    transferSummary: remoteItem.transferSummary,
  };
}
