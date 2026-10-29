import type { ArchiveBatch, Media, Post, User } from '../../archive/model';

export interface RemoteDbBuildConfig {
  enabled: boolean;
  configurable: boolean;
  defaultBaseUrl: string | null;
}

export interface RemoteDbClientConfig {
  runtimeEnabled: boolean;
  baseUrl: string | null | undefined;
}

export interface RemoteDbSessionResponseWire {
  authenticated: boolean;
  registered: boolean;
  username: string | null;
  expires_at?: string | null;
  account_url?: string | null;
  expiresAt?: string | null;
  accountUrl?: string | null;
}

export interface RemoteDbSessionResponse {
  authenticated: boolean;
  registered: boolean;
  username: string | null;
  expiresAt: string | null;
  accountUrl: string | null;
}

/** `POST /api/v1/archive/query` request: the ids to look up per kind. */
export interface RemoteDbQueryRequest {
  users: string[];
  posts: string[];
  media: string[];
}

export type RemoteDbObjectStatus = 'found' | 'missing' | 'failed';

export interface RemoteDbQueryResult<T> {
  id: string;
  status: RemoteDbObjectStatus;
  /** The stored archive record when `status` is `found`. */
  data?: T;
  error?: string;
}

export interface RemoteDbQueryResponse {
  users: Array<RemoteDbQueryResult<User>>;
  posts: Array<RemoteDbQueryResult<Post>>;
  media: Array<RemoteDbQueryResult<Media>>;
}

/** `POST /api/v1/archive/submit` sends archive records verbatim. */
export type RemoteDbSubmission = ArchiveBatch;

/** The submit request body: the batch plus the optional merge mode. */
export type RemoteDbSubmitBody = RemoteDbSubmission & { merge?: 'explicit' };

/**
 * - `accepted`: stored or merged into the stored record
 * - `unchanged`: merging changed nothing
 * - `partial`: stored, but a follow-up step (projection, media scheduling) failed
 */
export type RemoteDbSubmitStatus = 'accepted' | 'unchanged' | 'partial' | 'failed';

export interface RemoteDbSubmitResult {
  id: string;
  status: RemoteDbSubmitStatus;
  reason?: string;
}

export interface RemoteDbSubmitResponse {
  summary: Record<RemoteDbSubmitStatus | 'total', number>;
  users: RemoteDbSubmitResult[];
  posts: RemoteDbSubmitResult[];
  media: RemoteDbSubmitResult[];
}

export type RemoteDbLifecycleState =
  | 'disabled'
  | 'paused'
  | 'unconfigured'
  | 'initializing'
  | 'ready'
  | 'error';

export type RemoteDbSessionState =
  | 'unknown'
  | 'checking'
  | 'anonymous'
  | 'pending_registration'
  | 'authenticated'
  | 'error';

export interface RemoteDbClientState {
  enabled: boolean;
  runtimeEnabled: boolean;
  configurable: boolean;
  defaultBaseUrl: string | null;
  baseUrl: string | null;
  lifecycle: RemoteDbLifecycleState;
  sessionState: RemoteDbSessionState;
  session: RemoteDbSessionResponse | null;
  lastError: string | null;
  lastCheckedAt: number | null;
}
