export interface RemoteDbBuildConfig {
  enabled: boolean;
  configurable: boolean;
  defaultBaseUrl: string | null;
}

export interface RemoteDbSessionResponse {
  authenticated: boolean;
  registered: boolean;
  username: string | null;
  expiresAt: string | null;
  accountUrl: string | null;
}

export interface RemoteDbVideoVariantInput {
  bitrate: number | null;
  contentType: string;
  url: string;
}

export interface RemoteDbUserInput {
  id: string;
  name: string;
  screenName: string;
  description: string;
  location: string;
  avatarUrl: string;
  profileUrl: string | null;
  bannerUrl: string | null;
  isBlueVerified: boolean;
  verifiedType: string | null;
  isProtected: boolean;
  profileImageShape: string;
  professionalType: string | null;
  followersCount: number;
  friendsCount: number;
  favouritesCount: number;
  statusesCount: number;
  mediaCount: number;
  listedCount: number;
  pinnedTweetIds: string[];
  createdAt: string;
}

export interface RemoteDbTweetInput {
  id: string;
  authorId: string;
  conversationId: string;
  fullText: string;
  legacyFullText: string;
  noteText: string | null;
  lang: string;
  createdAt: string;
  inReplyToTweetId: string | null;
  inReplyToUserId: string | null;
  quotedTweetId: string | null;
  retweetedTweetId: string | null;
  viewCount: number | null;
  possiblySensitive: boolean | null;
  favoriteCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  mediaIds: string[];
  source: string;
}

export interface RemoteDbMediaInput {
  id: string;
  mediaKey: string;
  tweetId: string;
  type: string;
  mediaUrl: string;
  thumbUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  altText: string | null;
  allowDownload: boolean;
  sourceStatusId: string | null;
  sourceUserId: string | null;
  durationMs: number | null;
  videoVariants: RemoteDbVideoVariantInput[];
}

export interface RemoteDbSubmissionEnvelope {
  sourceKind: string;
  users: RemoteDbUserInput[];
  tweets: RemoteDbTweetInput[];
  media: RemoteDbMediaInput[];
}

export interface RemoteDbIngestResponse {
  submissionId: string;
  status: string;
  acceptedCount: number;
  transferJobsEnqueued: number;
  warnings: string[];
}

export interface RemoteDbPostStatusQueryRequest {
  sourceKind: string;
  postIds: string[];
}

export interface RemoteDbTransferSummary {
  pending: number;
  processing: number;
  succeeded: number;
  failed: number;
}

export interface RemoteDbPostView {
  sourcePostId: string;
  authorSourceActorId: string;
  conversationSourcePostId: string;
  fullText: string;
  legacyFullText: string;
  noteText: string | null;
  lang: string;
  sourceCreatedAtRaw: string;
  inReplyToSourcePostId: string | null;
  inReplyToSourceActorId: string | null;
  quotedSourcePostId: string | null;
  retweetedSourcePostId: string | null;
  viewCount: number | null;
  possiblySensitive: boolean | null;
  favoriteCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  bookmarkCount: number;
  mediaSourceIds: string[];
  sourceLabel: string;
}

export interface RemoteDbActorView {
  sourceActorId: string;
  name: string;
  screenName: string;
  description: string;
  location: string;
  avatarUrl: string;
  profileUrl: string | null;
  bannerUrl: string | null;
  verifiedType: string | null;
}

export interface RemoteDbMediaStatusView {
  sourceMediaId: string;
  mediaKey: string;
  sourcePostId: string;
  mediaType: string;
  sourceUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  altText: string | null;
  allowDownload: boolean;
  durationMs: number | null;
  transferStatus: string | null;
  storageObjectKey: string | null;
  lastError: string | null;
}

export interface RemoteDbPostStatusItem {
  sourceKind: string;
  postId: string;
  found: boolean;
  post: RemoteDbPostView | null;
  author: RemoteDbActorView | null;
  media: RemoteDbMediaStatusView[];
  missingMediaSourceIds: string[];
  transferSummary: RemoteDbTransferSummary;
}

export interface RemoteDbPostStatusQueryResponse {
  items: RemoteDbPostStatusItem[];
}

export type RemoteDbLifecycleState =
  | 'disabled'
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
  configurable: boolean;
  defaultBaseUrl: string | null;
  baseUrl: string | null;
  lifecycle: RemoteDbLifecycleState;
  sessionState: RemoteDbSessionState;
  session: RemoteDbSessionResponse | null;
  lastError: string | null;
  lastCheckedAt: number | null;
}
