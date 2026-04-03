import type { DbMedia, DbTweet, DbUser } from '../db-service';
import type {
  RemoteDbActorView,
  RemoteDbMediaInput,
  RemoteDbMediaStatusView,
  RemoteDbPostStatusItem,
  RemoteDbPostView,
  RemoteDbSubmissionEnvelope,
  RemoteDbTransferSummary,
  RemoteDbTweetInput,
  RemoteDbUserInput,
  RemoteDbVideoVariantInput,
} from './types';

export interface RemoteDbStatusComparison {
  exists: boolean;
  consistent: boolean;
  mismatchReason: string | null;
  expectedMediaCount: number;
  transferSummary: RemoteDbTransferSummary;
}

interface ComparableRemoteMedia {
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
}

const REMOTE_DB_SOURCE_KIND = 'x';

function normalizeStringArray(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function isSamePrimitiveArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function toComparablePost(tweet: DbTweet): RemoteDbPostView {
  return {
    sourcePostId: tweet.id,
    authorSourceActorId: tweet.authorId,
    conversationSourcePostId: tweet.conversationId,
    fullText: tweet.fullText,
    legacyFullText: tweet.legacyFullText,
    noteText: tweet.noteText,
    lang: tweet.lang,
    sourceCreatedAtRaw: tweet.createdAt,
    inReplyToSourcePostId: tweet.inReplyToTweetId,
    inReplyToSourceActorId: tweet.inReplyToUserId,
    quotedSourcePostId: tweet.quotedTweetId,
    retweetedSourcePostId: tweet.retweetedTweetId,
    viewCount: tweet.viewCount,
    possiblySensitive: tweet.possiblySensitive,
    favoriteCount: tweet.favoriteCount,
    retweetCount: tweet.retweetCount,
    replyCount: tweet.replyCount,
    quoteCount: tweet.quoteCount,
    bookmarkCount: tweet.bookmarkCount,
    mediaSourceIds: normalizeStringArray(tweet.mediaIds),
    sourceLabel: tweet.source,
  };
}

function toComparableAuthor(user: DbUser | undefined): RemoteDbActorView | null {
  if (!user) return null;

  return {
    sourceActorId: user.id,
    name: user.name,
    screenName: user.screenName,
    description: user.description,
    location: user.location,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    bannerUrl: user.bannerUrl,
    verifiedType: user.verifiedType,
  };
}

function toComparableMedia(media: DbMedia): ComparableRemoteMedia {
  return {
    sourceMediaId: media.id,
    mediaKey: media.mediaKey,
    sourcePostId: media.tweetId,
    mediaType: media.type,
    sourceUrl: media.sourceUrl,
    thumbUrl: media.thumbUrl,
    width: media.width,
    height: media.height,
    altText: media.altText,
    allowDownload: media.allowDownload,
    durationMs: media.durationMs,
  };
}

function toComparableRemoteMedia(media: RemoteDbMediaStatusView): ComparableRemoteMedia {
  return {
    sourceMediaId: media.sourceMediaId,
    mediaKey: media.mediaKey,
    sourcePostId: media.sourcePostId,
    mediaType: media.mediaType,
    sourceUrl: media.sourceUrl,
    thumbUrl: media.thumbUrl,
    width: media.width,
    height: media.height,
    altText: media.altText,
    allowDownload: media.allowDownload,
    durationMs: media.durationMs,
  };
}

function sortComparableMedia(values: ComparableRemoteMedia[]): ComparableRemoteMedia[] {
  return [...values].sort((left, right) => left.sourceMediaId.localeCompare(right.sourceMediaId));
}

function isSameComparableMedia(left: ComparableRemoteMedia, right: ComparableRemoteMedia): boolean {
  return left.sourceMediaId === right.sourceMediaId
    && left.mediaKey === right.mediaKey
    && left.sourcePostId === right.sourcePostId
    && left.mediaType === right.mediaType
    && left.sourceUrl === right.sourceUrl
    && left.thumbUrl === right.thumbUrl
    && left.width === right.width
    && left.height === right.height
    && left.altText === right.altText
    && left.allowDownload === right.allowDownload
    && left.durationMs === right.durationMs;
}

function isSamePost(left: RemoteDbPostView, right: RemoteDbPostView): boolean {
  return left.sourcePostId === right.sourcePostId
    && left.authorSourceActorId === right.authorSourceActorId
    && left.conversationSourcePostId === right.conversationSourcePostId
    && left.fullText === right.fullText
    && left.legacyFullText === right.legacyFullText
    && left.noteText === right.noteText
    && left.lang === right.lang
    && left.sourceCreatedAtRaw === right.sourceCreatedAtRaw
    && left.inReplyToSourcePostId === right.inReplyToSourcePostId
    && left.inReplyToSourceActorId === right.inReplyToSourceActorId
    && left.quotedSourcePostId === right.quotedSourcePostId
    && left.retweetedSourcePostId === right.retweetedSourcePostId
    && left.viewCount === right.viewCount
    && left.possiblySensitive === right.possiblySensitive
    && left.favoriteCount === right.favoriteCount
    && left.retweetCount === right.retweetCount
    && left.replyCount === right.replyCount
    && left.quoteCount === right.quoteCount
    && left.bookmarkCount === right.bookmarkCount
    && left.sourceLabel === right.sourceLabel
    && isSamePrimitiveArray(left.mediaSourceIds, right.mediaSourceIds);
}

function isSameAuthor(left: RemoteDbActorView | null, right: RemoteDbActorView | null): boolean {
  if (!left || !right) return left === right;

  return left.sourceActorId === right.sourceActorId
    && left.name === right.name
    && left.screenName === right.screenName
    && left.description === right.description
    && left.location === right.location
    && left.avatarUrl === right.avatarUrl
    && left.profileUrl === right.profileUrl
    && left.bannerUrl === right.bannerUrl
    && left.verifiedType === right.verifiedType;
}

function isSameMediaSet(left: ComparableRemoteMedia[], right: ComparableRemoteMedia[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => isSameComparableMedia(value, right[index]));
}

export function toRemoteDbUserInput(user: DbUser): RemoteDbUserInput {
  return {
    id: user.id,
    name: user.name,
    screenName: user.screenName,
    description: user.description,
    location: user.location,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    bannerUrl: user.bannerUrl,
    isBlueVerified: user.isBlueVerified,
    verifiedType: user.verifiedType,
    isProtected: user.isProtected,
    profileImageShape: user.profileImageShape,
    professionalType: user.professionalType,
    followersCount: user.followersCount,
    friendsCount: user.friendsCount,
    favouritesCount: user.favouritesCount,
    statusesCount: user.statusesCount,
    mediaCount: user.mediaCount,
    listedCount: user.listedCount,
    pinnedTweetIds: [...user.pinnedTweetIds],
    createdAt: user.createdAt,
  };
}

export function toRemoteDbTweetInput(tweet: DbTweet): RemoteDbTweetInput {
  return {
    id: tweet.id,
    authorId: tweet.authorId,
    conversationId: tweet.conversationId,
    fullText: tweet.fullText,
    legacyFullText: tweet.legacyFullText,
    noteText: tweet.noteText,
    lang: tweet.lang,
    createdAt: tweet.createdAt,
    inReplyToTweetId: tweet.inReplyToTweetId,
    inReplyToUserId: tweet.inReplyToUserId,
    quotedTweetId: tweet.quotedTweetId,
    retweetedTweetId: tweet.retweetedTweetId,
    viewCount: tweet.viewCount,
    possiblySensitive: tweet.possiblySensitive,
    favoriteCount: tweet.favoriteCount,
    retweetCount: tweet.retweetCount,
    replyCount: tweet.replyCount,
    quoteCount: tweet.quoteCount,
    bookmarkCount: tweet.bookmarkCount,
    mediaIds: [...tweet.mediaIds],
    source: tweet.source,
  };
}

export function toRemoteDbVideoVariantInput(variant: DbMedia['videoVariants'][number]): RemoteDbVideoVariantInput {
  return {
    bitrate: variant.bitrate,
    contentType: variant.contentType,
    url: variant.url,
  };
}

export function toRemoteDbMediaInput(media: DbMedia): RemoteDbMediaInput {
  return {
    id: media.id,
    mediaKey: media.mediaKey,
    tweetId: media.tweetId,
    type: media.type,
    mediaUrl: media.mediaUrl,
    thumbUrl: media.thumbUrl,
    sourceUrl: media.sourceUrl,
    width: media.width,
    height: media.height,
    altText: media.altText,
    allowDownload: media.allowDownload,
    sourceStatusId: media.sourceStatusId,
    sourceUserId: media.sourceUserId,
    durationMs: media.durationMs,
    videoVariants: media.videoVariants.map(toRemoteDbVideoVariantInput),
  };
}

export function buildRemoteDbSubmission(
  tweet: DbTweet,
  author: DbUser | undefined,
  media: DbMedia[],
): RemoteDbSubmissionEnvelope | null {
  if (!author) {
    return null;
  }

  return {
    sourceKind: REMOTE_DB_SOURCE_KIND,
    users: [toRemoteDbUserInput(author)],
    tweets: [toRemoteDbTweetInput(tweet)],
    media: media.map(toRemoteDbMediaInput),
  };
}

export function compareRemoteDbPostStatus(
  tweet: DbTweet,
  author: DbUser | undefined,
  media: DbMedia[],
  remoteItem: RemoteDbPostStatusItem,
): RemoteDbStatusComparison {
  const expectedMediaCount = tweet.mediaIds.length;

  if (!remoteItem.found) {
    return {
      exists: false,
      consistent: false,
      mismatchReason: null,
      expectedMediaCount,
      transferSummary: remoteItem.transferSummary,
    };
  }

  if (!remoteItem.post) {
    return {
      exists: true,
      consistent: false,
      mismatchReason: 'Remote post payload is missing',
      expectedMediaCount,
      transferSummary: remoteItem.transferSummary,
    };
  }

  const localPost = toComparablePost(tweet);
  const remotePost: RemoteDbPostView = {
    ...remoteItem.post,
    mediaSourceIds: normalizeStringArray(remoteItem.post.mediaSourceIds),
  };
  if (!isSamePost(localPost, remotePost)) {
    return {
      exists: true,
      consistent: false,
      mismatchReason: 'Remote post data differs from the local record',
      expectedMediaCount,
      transferSummary: remoteItem.transferSummary,
    };
  }

  const localAuthor = toComparableAuthor(author);
  if (!isSameAuthor(localAuthor, remoteItem.author)) {
    return {
      exists: true,
      consistent: false,
      mismatchReason: author
        ? 'Remote author data differs from the local record'
        : 'Local author data is missing',
      expectedMediaCount,
      transferSummary: remoteItem.transferSummary,
    };
  }

  const localMedia = sortComparableMedia(media.map(toComparableMedia));
  const remoteMedia = sortComparableMedia(remoteItem.media.map(toComparableRemoteMedia));
  if (!isSameMediaSet(localMedia, remoteMedia)) {
    return {
      exists: true,
      consistent: false,
      mismatchReason: 'Remote media data differs from the local record',
      expectedMediaCount,
      transferSummary: remoteItem.transferSummary,
    };
  }

  if (remoteItem.missingMediaSourceIds.length > 0) {
    return {
      exists: true,
      consistent: false,
      mismatchReason: `Remote media is incomplete (${remoteItem.missingMediaSourceIds.length} missing)`,
      expectedMediaCount,
      transferSummary: remoteItem.transferSummary,
    };
  }

  return {
    exists: true,
    consistent: true,
    mismatchReason: null,
    expectedMediaCount,
    transferSummary: remoteItem.transferSummary,
  };
}
