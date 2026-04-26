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

export interface RemoteDbQueryIdSelector {
  id: string;
}

export interface RemoteDbQueryRequest {
  users: RemoteDbQueryIdSelector[];
  tweets: RemoteDbQueryIdSelector[];
  media: RemoteDbQueryIdSelector[];
}

export interface RemoteDbQuerySummary {
  total: number;
  found: number;
  missing: number;
  failed: number;
}

export type RemoteDbQueryObjectStatus = 'found' | 'missing' | 'failed';

export interface RemoteDbQueryObjectResult<T> {
  id?: string;
  status: RemoteDbQueryObjectStatus;
  data?: T;
  error?: string;
}

export interface RemoteDbSubmitTextRange {
  start: number;
  end: number;
}

export interface RemoteDbSubmitResolvedUrl {
  url: string;
  expandedUrl: string;
  displayText: string;
}

export interface RemoteDbSubmitHashtagEntity {
  text: string;
  range: RemoteDbSubmitTextRange;
}

export interface RemoteDbSubmitSymbolEntity {
  text: string;
  range?: RemoteDbSubmitTextRange;
  ticker?: string;
  name?: string;
}

export interface RemoteDbSubmitUrlEntity {
  url: string;
  expandedUrl: string;
  displayText: string;
  range: RemoteDbSubmitTextRange;
}

export interface RemoteDbSubmitMentionEntity {
  userId: string;
  name?: string;
  userName?: string;
  range: RemoteDbSubmitTextRange;
}

export interface RemoteDbSubmitMediaOrigin {
  tweetId?: string;
  userId?: string;
}

export interface RemoteDbSubmitMediaEntity {
  mediaId: string;
  range?: RemoteDbSubmitTextRange;
  displayText?: string;
  expandedUrl?: string;
  url?: string;
  origin?: RemoteDbSubmitMediaOrigin;
}

export interface RemoteDbSubmitTextStyleRange {
  range: RemoteDbSubmitTextRange;
  styles: string[];
}

export interface RemoteDbSubmitAnnotatedText {
  text: string;
  displayRange?: RemoteDbSubmitTextRange;
  entities: {
    hashtags: RemoteDbSubmitHashtagEntity[];
    symbols: RemoteDbSubmitSymbolEntity[];
    urls: RemoteDbSubmitUrlEntity[];
    mentions: RemoteDbSubmitMentionEntity[];
    media: RemoteDbSubmitMediaEntity[];
  };
  styles: RemoteDbSubmitTextStyleRange[];
}

export interface RemoteDbSubmitUserCategory {
  id: string;
  name: string;
}

export interface RemoteDbSubmitUserVerification {
  isBlueVerified?: boolean;
  type?: string;
}

export interface RemoteDbSubmitUserDisclosure {
  relation?: string;
  subjectId?: string;
  subjectHandle?: string;
  subjectName?: string;
  subjectUrl?: string;
}

export interface RemoteDbSubmitUserIdentity {
  verification?: RemoteDbSubmitUserVerification;
  disclosure?: RemoteDbSubmitUserDisclosure;
  parodyLabel?: string;
  hasCompletedNewAccountReview?: boolean;
  isPossiblySensitive?: boolean;
}

export interface RemoteDbSubmitUserProfessional {
  id?: string;
  type?: string;
  categories: RemoteDbSubmitUserCategory[];
}

export interface RemoteDbSubmitUserStats {
  followers?: number;
  following?: number;
  likes?: number;
  mediaPosts?: number;
  tweets?: number;
  listed?: number;
}

export interface RemoteDbSubmitUserFeatures {
  canDm?: boolean;
  canTagMedia?: boolean;
  isProtected?: boolean;
  canBeSubscribed?: boolean;
}

export interface RemoteDbSubmitUserProfile {
  displayName: string;
  userName: string;
  avatarUrl?: string;
  usesDefaultAvatar?: boolean;
  avatarShape?: string;
  bannerUrl?: string;
  location?: string;
  bio?: RemoteDbSubmitAnnotatedText;
  profileLinks: RemoteDbSubmitResolvedUrl[];
}

export interface RemoteDbSubmitUser {
  id: string;
  registeredAt?: string;
  profile?: RemoteDbSubmitUserProfile;
  pinnedTweetIds: string[];
  identity?: RemoteDbSubmitUserIdentity;
  professional?: RemoteDbSubmitUserProfessional;
  stats?: RemoteDbSubmitUserStats;
  features?: RemoteDbSubmitUserFeatures;
}

export interface RemoteDbSubmitGeoPoint {
  longitude: number;
  latitude: number;
}

export interface RemoteDbSubmitTweetPlace {
  id?: string;
  name?: string;
  fullName?: string;
  country?: string;
  countryCode?: string;
  kind?: string;
  boundary?: RemoteDbSubmitGeoPoint[];
}

export interface RemoteDbSubmitTweetNote {
  id?: string;
  text: RemoteDbSubmitAnnotatedText;
}

export interface RemoteDbSubmitTweetReplyTarget {
  tweetId: string;
  userId?: string;
  userName?: string;
}

export interface RemoteDbSubmitTweetQuote {
  tweetId: string;
  permalink?: RemoteDbSubmitResolvedUrl;
}

export interface RemoteDbSubmitTweetStats {
  views?: string;
  replies?: number;
  reposts?: number;
  quotes?: number;
  likes?: number;
  bookmarks?: number;
}

export interface RemoteDbSubmitTweetEdit {
  versionIds: string[];
  editableUntilAt?: string;
  remainingEdits?: string;
}

export interface RemoteDbSubmitTweetPolicy {
  replyPolicy?: string;
  followersOnly?: boolean;
  isPossiblySensitive?: boolean;
  availableActions: string[];
  isMediaVisibilityRestricted?: boolean;
  paidPromotion?: boolean;
}

export interface RemoteDbSubmitTweetCommunityNote {
  id?: string;
  title?: string;
  shortTitle?: string;
  subtitle?: RemoteDbSubmitAnnotatedText;
  footer?: RemoteDbSubmitAnnotatedText;
  destinationUrl?: string;
}

export interface RemoteDbSubmitTweet {
  id: string;
  publishedAt: string;
  source?: string;
  authorId: string;
  place?: RemoteDbSubmitTweetPlace;
  content: {
    legacyText: RemoteDbSubmitAnnotatedText;
    note?: RemoteDbSubmitTweetNote;
    mediaIds: string[];
    language?: string;
  };
  conversation: {
    conversationId: string;
    replyTo?: RemoteDbSubmitTweetReplyTarget;
    quote?: RemoteDbSubmitTweetQuote;
    repostId?: string;
  };
  stats?: RemoteDbSubmitTweetStats;
  edit?: RemoteDbSubmitTweetEdit;
  policy?: RemoteDbSubmitTweetPolicy;
  communityNote?: RemoteDbSubmitTweetCommunityNote;
}

export interface RemoteDbSubmitMediaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RemoteDbSubmitMediaGeometry {
  width: number;
  height: number;
  focusRects: RemoteDbSubmitMediaRect[];
}

export interface RemoteDbSubmitMediaVariant {
  width: number;
  height: number;
  resizeMode: string;
}

export interface RemoteDbSubmitMediaVariants {
  large?: RemoteDbSubmitMediaVariant;
  medium?: RemoteDbSubmitMediaVariant;
  small?: RemoteDbSubmitMediaVariant;
  thumb?: RemoteDbSubmitMediaVariant;
}

export interface RemoteDbSubmitMediaTag {
  userId?: string;
  kind?: string;
}

export interface RemoteDbSubmitVideoVariant {
  bitrate?: number;
  contentType: string;
  url: string;
}

export interface RemoteDbSubmitMediaVideo {
  aspectRatio?: [number, number];
  durationMs?: number;
  variants: RemoteDbSubmitVideoVariant[];
}

export interface RemoteDbSubmitMediaDetails {
  title?: string;
  description?: string;
  siteUrl?: string;
  isEmbeddable?: boolean;
  isMonetizable?: boolean;
}

export interface RemoteDbSubmitMedia {
  id: string;
  type: 'photo' | 'video' | 'animated_gif';
  mediaUrl?: string;
  altText?: string;
  grokPostId?: string;
  geometry?: RemoteDbSubmitMediaGeometry;
  variants?: RemoteDbSubmitMediaVariants;
  taggedUsers: RemoteDbSubmitMediaTag[];
  sensitivityWarnings: string[];
  availability?: string;
  video?: RemoteDbSubmitMediaVideo;
  origin?: RemoteDbSubmitMediaOrigin;
  details?: RemoteDbSubmitMediaDetails;
}

export interface RemoteDbSubmissionEnvelope {
  users: RemoteDbSubmitUser[];
  tweets: RemoteDbSubmitTweet[];
  media: RemoteDbSubmitMedia[];
}

export type RemoteDbSubmitObjectStatus = 'accepted' | 'skipped' | 'partial' | 'failed';
export type RemoteDbSubmitOperationStatus = 'accepted' | 'skipped' | 'failed';

export interface RemoteDbSubmitOperationResult {
  name: string;
  status: RemoteDbSubmitOperationStatus;
  reason?: string;
}

export interface RemoteDbSubmitObjectResult {
  id?: string;
  status: RemoteDbSubmitObjectStatus;
  operations: RemoteDbSubmitOperationResult[];
  error?: string;
}

export interface RemoteDbSubmitSummary {
  total: number;
  accepted: number;
  skipped: number;
  partial: number;
  failed: number;
}

export interface RemoteDbSubmitResponse {
  summary: RemoteDbSubmitSummary;
  users: RemoteDbSubmitObjectResult[];
  tweets: RemoteDbSubmitObjectResult[];
  media: RemoteDbSubmitObjectResult[];
}

export interface RemoteDbQueryResolvedUrl {
  url: string;
  expandedUrl: string;
  displayText: string;
}

export interface RemoteDbQueryAnnotatedText {
  text: string;
  displayRange?: RemoteDbSubmitTextRange;
  entities: {
    hashtags: RemoteDbSubmitHashtagEntity[];
    symbols: RemoteDbSubmitSymbolEntity[];
    urls: RemoteDbSubmitUrlEntity[];
    mentions: Array<Pick<RemoteDbSubmitMentionEntity, 'userId' | 'range'>>;
    media: RemoteDbSubmitMediaEntity[];
  };
  styles: RemoteDbSubmitTextStyleRange[];
}

export interface RemoteDbQueryUserData {
  id: string;
  registeredAt?: string | null;
  profile?: {
    fetchedAt?: string;
    displayName: string;
    userName: string;
    avatarUrl?: string | null;
    usesDefaultAvatar?: boolean | null;
    avatarShape?: string | null;
    bannerUrl?: string | null;
    location?: string | null;
    bio?: RemoteDbQueryAnnotatedText | null;
    profileLinks: RemoteDbQueryResolvedUrl[];
  } | null;
  pinnedTweetIds: string[];
  identity?: {
    verification?: RemoteDbSubmitUserVerification | null;
    disclosure?: RemoteDbSubmitUserDisclosure | null;
    parodyLabel?: string | null;
    hasCompletedNewAccountReview?: boolean | null;
    isPossiblySensitive?: boolean | null;
  } | null;
  professional?: RemoteDbSubmitUserProfessional | null;
  stats?: ({
    fetchedAt?: string;
  } & RemoteDbSubmitUserStats) | null;
  features?: RemoteDbSubmitUserFeatures | null;
}

export interface RemoteDbQueryTweetData {
  id: string;
  publishedAt: string;
  source?: string | null;
  authorId: string;
  place?: RemoteDbSubmitTweetPlace | null;
  content: {
    legacyText: RemoteDbQueryAnnotatedText;
    note?: {
      id?: string | null;
      text?: RemoteDbQueryAnnotatedText | null;
    } | null;
    mediaIds: string[];
    language?: string | null;
  };
  conversation: {
    conversationId: string;
    replyTo?: {
      tweetId: string;
      userId?: string | null;
    } | null;
    quote?: {
      tweetId: string;
      permalink?: RemoteDbQueryResolvedUrl | null;
    } | null;
    repostId?: string | null;
  };
  stats?: ({
    fetchedAt?: string;
  } & RemoteDbSubmitTweetStats) | null;
  edit?: RemoteDbSubmitTweetEdit | null;
  policy?: RemoteDbSubmitTweetPolicy | null;
  communityNote?: RemoteDbSubmitTweetCommunityNote | null;
}

export interface RemoteDbQueryMediaData {
  id: string;
  type: 'photo' | 'video' | 'animated_gif';
  altText?: string | null;
  grokPostId?: string | null;
  geometry?: RemoteDbSubmitMediaGeometry | null;
  variants?: RemoteDbSubmitMediaVariants | null;
  taggedUsers: RemoteDbSubmitMediaTag[];
  sensitivityWarnings?: string[] | null;
  origin?: RemoteDbSubmitMediaOrigin | null;
  details?: RemoteDbSubmitMediaDetails | null;
  resource?: {
    fetchedAt?: string;
    mediaUrl?: string | null;
    availability?: string | null;
    video?: RemoteDbSubmitMediaVideo | null;
  } | null;
}

export interface RemoteDbQueryResponse {
  summary: RemoteDbQuerySummary;
  users: Array<RemoteDbQueryObjectResult<RemoteDbQueryUserData>>;
  tweets: Array<RemoteDbQueryObjectResult<RemoteDbQueryTweetData>>;
  media: Array<RemoteDbQueryObjectResult<RemoteDbQueryMediaData>>;
}

export interface RemoteDbTweetBundleQuery {
  tweetId: string;
  authorId?: string | null;
  mediaIds?: string[];
}

export interface RemoteDbTweetBundle {
  summary: RemoteDbQuerySummary;
  tweet: RemoteDbQueryObjectResult<RemoteDbQueryTweetData>;
  author: RemoteDbQueryObjectResult<RemoteDbQueryUserData> | null;
  media: Array<RemoteDbQueryObjectResult<RemoteDbQueryMediaData>>;
}

export interface RemoteDbTweetBundleBatchQuery {
  items: RemoteDbTweetBundleQuery[];
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
