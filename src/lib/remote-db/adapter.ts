import type {
  AnnotatedText,
  TweetMediaTag,
  TweetPermalink,
  TweetUser,
} from '../../schema/tweet-schema';
import type { DbMedia, DbTweet, DbUser } from '../db-service';
import type {
  RemoteDbQueryAnnotatedText,
  RemoteDbQueryMediaData,
  RemoteDbQueryObjectStatus,
  RemoteDbQueryResolvedUrl,
  RemoteDbQueryTweetData,
  RemoteDbQueryUserData,
  RemoteDbSubmissionEnvelope,
  RemoteDbSubmitAnnotatedText,
  RemoteDbSubmitMedia,
  RemoteDbSubmitMediaDetails,
  RemoteDbSubmitMediaEntity,
  RemoteDbSubmitMediaGeometry,
  RemoteDbSubmitMediaOrigin,
  RemoteDbSubmitMediaTag,
  RemoteDbSubmitMediaVariant,
  RemoteDbSubmitMediaVariants,
  RemoteDbSubmitMediaVideo,
  RemoteDbSubmitResolvedUrl,
  RemoteDbSubmitTextRange,
  RemoteDbSubmitTextStyleRange,
  RemoteDbSubmitTweet,
  RemoteDbSubmitTweetCommunityNote,
  RemoteDbSubmitTweetEdit,
  RemoteDbSubmitTweetPlace,
  RemoteDbSubmitTweetPolicy,
  RemoteDbSubmitTweetStats,
  RemoteDbSubmitUser,
  RemoteDbSubmitUserDisclosure,
  RemoteDbSubmitUserFeatures,
  RemoteDbSubmitUserIdentity,
  RemoteDbSubmitUserProfessional,
  RemoteDbSubmitUserStats,
  RemoteDbSubmitUserVerification,
  RemoteDbTweetBundle,
} from './types';

export interface RemoteDbEntityComparison {
  remoteStatus: RemoteDbQueryObjectStatus;
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

type ComparableAnnotatedText = Omit<RemoteDbQueryAnnotatedText, 'styles'> & {
  styles: RemoteDbSubmitTextStyleRange[];
};

type ComparableTweet = RemoteDbQueryTweetData;
type ComparableUser = Omit<RemoteDbQueryUserData, 'profile' | 'stats'> & {
  profile?: Omit<NonNullable<RemoteDbQueryUserData['profile']>, 'fetchedAt'> | null;
  stats?: Omit<NonNullable<RemoteDbQueryUserData['stats']>, 'fetchedAt'> | null;
};
type ComparableMedia = Omit<RemoteDbQueryMediaData, 'resource'> & {
  resource?: Omit<NonNullable<RemoteDbQueryMediaData['resource']>, 'fetchedAt'> | null;
};

interface MediaGeometryLike {
  width: number;
  height: number;
  focusRects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

interface MediaVariantLike {
  width: number;
  height: number;
  resizeMode: string;
}

interface MediaVideoLike {
  aspectRatio?: [number, number];
  durationMs?: number;
  variants: Array<{
    bitrate?: number;
    contentType: string;
    url: string;
  }>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((value, index) => deepEqual(value, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (!deepEqual(leftKeys, rightKeys)) return false;
    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }

  return false;
}

function compactObject<T>(value: T): T | undefined {
  if (value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => compactObject(item)).filter((item) => item !== undefined) as T;
  }

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const normalized = compactObject(entry);
      if (normalized !== undefined) {
        next[key] = normalized;
      }
    }
    return Object.keys(next).length > 0 ? next as T : undefined;
  }

  return value;
}

function sortByJson<T>(values: T[]): T[] {
  return [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizeStringArray(values: readonly string[] | null | undefined): string[] {
  return [...new Set((values ?? []).filter(Boolean))].sort();
}

function normalizeDateTime(value: string | null | undefined): string | null {
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

export function normalizeRemoteDbCreatedAt(value: string | null | undefined): string | null {
  return normalizeDateTime(value);
}

function toSubmitTextRange(range: { start: number; end: number } | undefined): RemoteDbSubmitTextRange | undefined {
  if (!range) {
    return undefined;
  }

  return {
    start: range.start,
    end: range.end,
  };
}

function toSubmitResolvedUrl(value: RemoteDbQueryResolvedUrl): RemoteDbSubmitResolvedUrl {
  return {
    url: value.url,
    expandedUrl: value.expandedUrl,
    displayText: value.displayText,
  };
}

function toSubmitMediaOrigin(
  value: { tweetId?: string; userId?: string } | undefined,
): RemoteDbSubmitMediaOrigin | undefined {
  return compactObject({
    tweetId: value?.tweetId,
    userId: value?.userId,
  });
}

function toSubmitAnnotatedText(value: AnnotatedText): RemoteDbSubmitAnnotatedText {
  return {
    text: value.text,
    displayRange: toSubmitTextRange(value.displayRange),
    entities: {
      hashtags: value.entities.hashtags.map((item) => ({
        text: item.text,
        range: {
          start: item.range.start,
          end: item.range.end,
        },
      })),
      symbols: value.entities.symbols.map((item) => compactObject({
        text: item.text,
        range: item.range ? {
          start: item.range.start,
          end: item.range.end,
        } : undefined,
        ticker: item.ticker,
        name: item.name,
      }) as NonNullable<RemoteDbSubmitAnnotatedText['entities']['symbols'][number]>),
      urls: value.entities.urls.map((item) => ({
        url: item.url,
        expandedUrl: item.expandedUrl,
        displayText: item.displayText,
        range: {
          start: item.range.start,
          end: item.range.end,
        },
      })),
      mentions: value.entities.mentions.map((item) => compactObject({
        userId: item.userId,
        name: item.name,
        userName: item.userName,
        range: {
          start: item.range.start,
          end: item.range.end,
        },
      }) as NonNullable<RemoteDbSubmitAnnotatedText['entities']['mentions'][number]>),
      media: value.entities.media.map((item) => compactObject({
        mediaId: item.mediaId,
        range: item.range ? {
          start: item.range.start,
          end: item.range.end,
        } : undefined,
        displayText: item.displayText,
        expandedUrl: item.expandedUrl,
        url: item.url,
        origin: toSubmitMediaOrigin(item.origin),
      }) as RemoteDbSubmitMediaEntity),
    },
    styles: (value.styles ?? []).map((item) => ({
      range: {
        start: item.range.start,
        end: item.range.end,
      },
      styles: [...item.styles],
    })),
  };
}

function toComparableAnnotatedText(value: RemoteDbQueryAnnotatedText | AnnotatedText): ComparableAnnotatedText {
  const normalized = 'entities' in value && 'text' in value
    ? {
        text: value.text,
        displayRange: toSubmitTextRange(value.displayRange),
        entities: {
          hashtags: sortByJson((value.entities.hashtags ?? []).map((item) => ({
            text: item.text,
            range: {
              start: item.range.start,
              end: item.range.end,
            },
          }))),
          symbols: sortByJson((value.entities.symbols ?? []).map((item) => compactObject({
            text: item.text,
            range: item.range ? {
              start: item.range.start,
              end: item.range.end,
            } : undefined,
            ticker: item.ticker,
            name: item.name,
          }) as NonNullable<ComparableAnnotatedText['entities']['symbols'][number]>)),
          urls: sortByJson((value.entities.urls ?? []).map((item) => ({
            url: item.url,
            expandedUrl: item.expandedUrl,
            displayText: item.displayText,
            range: {
              start: item.range.start,
              end: item.range.end,
            },
          }))),
          mentions: sortByJson((value.entities.mentions ?? []).map((item) => ({
            userId: item.userId,
            range: {
              start: item.range.start,
              end: item.range.end,
            },
          }))),
          media: sortByJson((value.entities.media ?? []).map((item) => compactObject({
            mediaId: item.mediaId,
            range: item.range ? {
              start: item.range.start,
              end: item.range.end,
            } : undefined,
            displayText: item.displayText,
            expandedUrl: item.expandedUrl,
            url: item.url,
            origin: toSubmitMediaOrigin(item.origin),
          }) as RemoteDbSubmitMediaEntity)),
        },
        styles: sortByJson((value.styles ?? []).map((item) => ({
          range: {
            start: item.range.start,
            end: item.range.end,
          },
          styles: normalizeStringArray(item.styles),
        }))),
      }
    : undefined;

  return compactObject(normalized) as ComparableAnnotatedText;
}

function toComparableResolvedUrl(value: TweetPermalink | RemoteDbQueryResolvedUrl): RemoteDbQueryResolvedUrl {
  return {
    url: value.url,
    expandedUrl: value.expandedUrl,
    displayText: value.displayText,
  };
}

function toComparableUser(local: DbUser | TweetUser): ComparableUser {
  return compactObject({
    id: local.id,
    registeredAt: normalizeRemoteDbCreatedAt(local.createdAt),
    profile: compactObject({
      displayName: local.profile.displayName,
      userName: local.profile.userName,
      avatarUrl: local.profile.avatarUrl,
      usesDefaultAvatar: local.profile.usesDefaultAvatar,
      avatarShape: local.profile.avatarShape,
      bannerUrl: local.profile.bannerUrl,
      location: local.profile.location,
      bio: local.profile.bio ? toComparableAnnotatedText(local.profile.bio) : undefined,
      profileLinks: local.profile.profileLinks.map((item) => toComparableResolvedUrl(item)),
    }),
    pinnedTweetIds: [...local.pinnedTweetIds],
    identity: compactObject({
      verification: local.identity?.verification ? compactObject({
        isBlueVerified: local.identity.verification.isBlueVerified,
        type: local.identity.verification.type,
      }) as RemoteDbSubmitUserVerification : undefined,
      disclosure: local.identity?.disclosure ? compactObject({
        relation: local.identity.disclosure.relation,
        subjectId: local.identity.disclosure.subjectId,
        subjectHandle: local.identity.disclosure.subjectHandle,
        subjectName: local.identity.disclosure.subjectName,
        subjectUrl: local.identity.disclosure.subjectUrl,
      }) as RemoteDbSubmitUserDisclosure : undefined,
      parodyLabel: local.identity?.parodyLabel,
      hasCompletedNewAccountReview: local.identity?.hasCompletedNewAccountReview,
      isPossiblySensitive: local.identity?.isPossiblySensitive,
    }),
    professional: local.professional ? compactObject({
      id: local.professional.id,
      type: local.professional.type,
      categories: sortByJson(local.professional.categories.map((item) => ({
        id: item.id,
        name: item.name,
      }))),
    }) as RemoteDbSubmitUserProfessional : undefined,
    stats: local.stats ? compactObject({
      followers: local.stats.followers,
      following: local.stats.following,
      likes: local.stats.likes,
      mediaPosts: local.stats.mediaPosts,
      tweets: local.stats.tweets,
      listed: local.stats.listed,
    }) as RemoteDbSubmitUserStats : undefined,
    features: local.features ? compactObject({
      canDm: local.features.canDm,
      canTagMedia: local.features.canTagMedia,
      isProtected: local.features.isProtected,
      canBeSubscribed: local.features.canBeSubscribed,
    }) as RemoteDbSubmitUserFeatures : undefined,
  }) as ComparableUser;
}

function toComparableRemoteUser(remote: RemoteDbQueryUserData): ComparableUser {
  return compactObject({
    id: remote.id,
    registeredAt: normalizeRemoteDbCreatedAt(remote.registeredAt),
    profile: remote.profile ? compactObject({
      displayName: remote.profile.displayName,
      userName: remote.profile.userName,
      avatarUrl: remote.profile.avatarUrl,
      usesDefaultAvatar: remote.profile.usesDefaultAvatar,
      avatarShape: remote.profile.avatarShape,
      bannerUrl: remote.profile.bannerUrl,
      location: remote.profile.location,
      bio: remote.profile.bio ? toComparableAnnotatedText(remote.profile.bio) : undefined,
      profileLinks: (remote.profile.profileLinks ?? []).map((item) => toComparableResolvedUrl(item)),
    }) : undefined,
    pinnedTweetIds: [...remote.pinnedTweetIds],
    identity: remote.identity ? compactObject({
      verification: remote.identity.verification ? compactObject({
        isBlueVerified: remote.identity.verification.isBlueVerified,
        type: remote.identity.verification.type,
      }) : undefined,
      disclosure: remote.identity.disclosure ? compactObject({
        relation: remote.identity.disclosure.relation,
        subjectId: remote.identity.disclosure.subjectId,
        subjectHandle: remote.identity.disclosure.subjectHandle,
        subjectName: remote.identity.disclosure.subjectName,
        subjectUrl: remote.identity.disclosure.subjectUrl,
      }) : undefined,
      parodyLabel: remote.identity.parodyLabel,
      hasCompletedNewAccountReview: remote.identity.hasCompletedNewAccountReview,
      isPossiblySensitive: remote.identity.isPossiblySensitive,
    }) : undefined,
    professional: remote.professional ? compactObject({
      id: remote.professional.id,
      type: remote.professional.type,
      categories: sortByJson((remote.professional.categories ?? []).map((item) => ({
        id: item.id,
        name: item.name,
      }))),
    }) : undefined,
    stats: remote.stats ? compactObject({
      followers: remote.stats.followers,
      following: remote.stats.following,
      likes: remote.stats.likes,
      mediaPosts: remote.stats.mediaPosts,
      tweets: remote.stats.tweets,
      listed: remote.stats.listed,
    }) : undefined,
    features: remote.features ? compactObject({
      canDm: remote.features.canDm,
      canTagMedia: remote.features.canTagMedia,
      isProtected: remote.features.isProtected,
      canBeSubscribed: remote.features.canBeSubscribed,
    }) : undefined,
  }) as ComparableUser;
}

function toComparableTweet(local: DbTweet): ComparableTweet {
  return compactObject({
    id: local.id,
    publishedAt: normalizeRemoteDbCreatedAt(local.createdAt),
    source: local.source,
    authorId: local.authorId,
    place: local.place ? compactObject({
      id: local.place.id,
      name: local.place.name,
      fullName: local.place.fullName,
      country: local.place.country,
      countryCode: local.place.countryCode,
      kind: local.place.kind,
      boundary: local.place.boundary?.map((item) => ({
        longitude: item.longitude,
        latitude: item.latitude,
      })),
    }) as RemoteDbSubmitTweetPlace : undefined,
    content: {
      legacyText: toComparableAnnotatedText(local.content.legacyText),
      note: local.content.note ? compactObject({
        id: local.content.note.id,
        text: toComparableAnnotatedText(local.content.note.text),
      }) : undefined,
      mediaIds: [...local.content.mediaIds],
      language: local.content.language,
    },
    conversation: compactObject({
      conversationId: local.conversation.conversationId,
      replyTo: local.conversation.replyTo ? compactObject({
        tweetId: local.conversation.replyTo.tweetId,
        userId: local.conversation.replyTo.userId,
      }) : undefined,
      quote: local.conversation.quote ? compactObject({
        tweetId: local.conversation.quote.tweetId,
        permalink: local.conversation.quote.permalink
          ? toComparableResolvedUrl(local.conversation.quote.permalink)
          : undefined,
      }) : undefined,
      repostId: local.conversation.repostId,
    })!,
    stats: compactObject({
      views: local.stats.views,
      replies: local.stats.replies,
      reposts: local.stats.reposts,
      quotes: local.stats.quotes,
      likes: local.stats.likes,
      bookmarks: local.stats.bookmarks,
    }) as RemoteDbSubmitTweetStats,
    edit: local.edit ? compactObject({
      versionIds: [...local.edit.versionIds],
      editableUntilAt: normalizeDateTime(local.edit.editableUntilAt),
      remainingEdits: local.edit.remainingEdits,
    }) as RemoteDbSubmitTweetEdit : undefined,
    policy: local.policy ? compactObject({
      replyPolicy: local.policy.replyPolicy,
      followersOnly: local.policy.followersOnly,
      isPossiblySensitive: local.policy.isPossiblySensitive,
      availableActions: normalizeStringArray(local.policy.availableActions),
      isMediaVisibilityRestricted: local.policy.isMediaVisibilityRestricted,
      paidPromotion: local.policy.paidPromotion,
    }) as RemoteDbSubmitTweetPolicy : undefined,
    communityNote: local.communityNote ? compactObject({
      id: local.communityNote.id,
      title: local.communityNote.title,
      shortTitle: local.communityNote.shortTitle,
      subtitle: local.communityNote.subtitle
        ? toComparableAnnotatedText(local.communityNote.subtitle)
        : undefined,
      footer: local.communityNote.footer
        ? toComparableAnnotatedText(local.communityNote.footer)
        : undefined,
      destinationUrl: local.communityNote.destinationUrl,
    }) as RemoteDbSubmitTweetCommunityNote : undefined,
  }) as ComparableTweet;
}

function toComparableRemoteTweet(remote: RemoteDbQueryTweetData): ComparableTweet {
  return compactObject({
    id: remote.id,
    publishedAt: normalizeRemoteDbCreatedAt(remote.publishedAt),
    source: remote.source,
    authorId: remote.authorId,
    place: remote.place ? compactObject({
      id: remote.place.id,
      name: remote.place.name,
      fullName: remote.place.fullName,
      country: remote.place.country,
      countryCode: remote.place.countryCode,
      kind: remote.place.kind,
      boundary: remote.place.boundary?.map((item) => ({
        longitude: item.longitude,
        latitude: item.latitude,
      })),
    }) : undefined,
    content: {
      legacyText: toComparableAnnotatedText(remote.content.legacyText),
      note: remote.content.note ? compactObject({
        id: remote.content.note.id,
        text: remote.content.note.text ? toComparableAnnotatedText(remote.content.note.text) : undefined,
      }) : undefined,
      mediaIds: [...remote.content.mediaIds],
      language: remote.content.language,
    },
    conversation: compactObject({
      conversationId: remote.conversation.conversationId,
      replyTo: remote.conversation.replyTo ? compactObject({
        tweetId: remote.conversation.replyTo.tweetId,
        userId: remote.conversation.replyTo.userId,
      }) : undefined,
      quote: remote.conversation.quote ? compactObject({
        tweetId: remote.conversation.quote.tweetId,
        permalink: remote.conversation.quote.permalink
          ? toComparableResolvedUrl(remote.conversation.quote.permalink)
          : undefined,
      }) : undefined,
      repostId: remote.conversation.repostId,
    })!,
    stats: remote.stats ? compactObject({
      views: remote.stats.views,
      replies: remote.stats.replies,
      reposts: remote.stats.reposts,
      quotes: remote.stats.quotes,
      likes: remote.stats.likes,
      bookmarks: remote.stats.bookmarks,
    }) : undefined,
    edit: remote.edit ? compactObject({
      versionIds: [...remote.edit.versionIds],
      editableUntilAt: normalizeDateTime(remote.edit.editableUntilAt),
      remainingEdits: remote.edit.remainingEdits,
    }) : undefined,
    policy: remote.policy ? compactObject({
      replyPolicy: remote.policy.replyPolicy,
      followersOnly: remote.policy.followersOnly,
      isPossiblySensitive: remote.policy.isPossiblySensitive,
      availableActions: normalizeStringArray(remote.policy.availableActions),
      isMediaVisibilityRestricted: remote.policy.isMediaVisibilityRestricted,
      paidPromotion: remote.policy.paidPromotion,
    }) : undefined,
    communityNote: remote.communityNote ? compactObject({
      id: remote.communityNote.id,
      title: remote.communityNote.title,
      shortTitle: remote.communityNote.shortTitle,
      subtitle: remote.communityNote.subtitle
        ? toComparableAnnotatedText(remote.communityNote.subtitle)
        : undefined,
      footer: remote.communityNote.footer
        ? toComparableAnnotatedText(remote.communityNote.footer)
        : undefined,
      destinationUrl: remote.communityNote.destinationUrl,
    }) : undefined,
  }) as ComparableTweet;
}

function toComparableMediaTag(value: Pick<TweetMediaTag, 'userId' | 'kind'> | RemoteDbSubmitMediaTag) {
  return compactObject({
    userId: value.userId,
    kind: value.kind,
  }) as RemoteDbSubmitMediaTag;
}

function toSubmitMediaGeometry(
  value: MediaGeometryLike | null | undefined,
): RemoteDbSubmitMediaGeometry | undefined {
  if (!value) {
    return undefined;
  }

  return {
    width: value.width,
    height: value.height,
    focusRects: value.focusRects.map((item) => ({
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    })),
  };
}

function toSubmitMediaVariant(
  value: MediaVariantLike | null | undefined,
): RemoteDbSubmitMediaVariant | undefined {
  if (!value) {
    return undefined;
  }

  return {
    width: value.width,
    height: value.height,
    resizeMode: value.resizeMode,
  };
}

function toSubmitMediaVariants(
  value: {
    large?: MediaVariantLike;
    medium?: MediaVariantLike;
    small?: MediaVariantLike;
    thumb?: MediaVariantLike;
  } | null | undefined,
): RemoteDbSubmitMediaVariants | undefined {
  if (!value) {
    return undefined;
  }

  return compactObject({
    large: toSubmitMediaVariant(value.large),
    medium: toSubmitMediaVariant(value.medium),
    small: toSubmitMediaVariant(value.small),
    thumb: toSubmitMediaVariant(value.thumb),
  });
}

function toSubmitMediaVideo(
  value: MediaVideoLike | null | undefined,
): RemoteDbSubmitMediaVideo | undefined {
  if (!value) {
    return undefined;
  }

  return compactObject({
    aspectRatio: value.aspectRatio ? [value.aspectRatio[0], value.aspectRatio[1]] as [number, number] : undefined,
    durationMs: value.durationMs,
    variants: value.variants.map((item) => compactObject({
      bitrate: item.bitrate,
      contentType: item.contentType,
      url: item.url,
    })!).filter(Boolean),
  });
}

function toComparableMedia(local: DbMedia): ComparableMedia {
  return compactObject({
    id: local.id,
    type: local.type,
    altText: local.altText,
    grokPostId: local.grokPostId,
    geometry: toSubmitMediaGeometry(local.geometry),
    variants: toSubmitMediaVariants(local.variants),
    taggedUsers: sortByJson(local.taggedUsers.map((item) => toComparableMediaTag(item))),
    sensitivityWarnings: normalizeStringArray(local.sensitivityWarnings),
    origin: toSubmitMediaOrigin(local.origin),
    details: local.details ? compactObject({
      title: local.details.title,
      description: local.details.description,
      siteUrl: local.details.siteUrl,
      isEmbeddable: local.details.isEmbeddable,
      isMonetizable: local.details.isMonetizable,
    }) as RemoteDbSubmitMediaDetails : undefined,
    resource: compactObject({
      mediaUrl: local.mediaUrl,
      availability: local.availability,
      video: toSubmitMediaVideo(local.video),
    }),
  }) as ComparableMedia;
}

function toComparableRemoteMedia(remote: RemoteDbQueryMediaData): ComparableMedia {
  return compactObject({
    id: remote.id,
    type: remote.type,
    altText: remote.altText,
    grokPostId: remote.grokPostId,
    geometry: toSubmitMediaGeometry(remote.geometry),
    variants: toSubmitMediaVariants(remote.variants),
    taggedUsers: sortByJson((remote.taggedUsers ?? []).map((item) => toComparableMediaTag(item))),
    sensitivityWarnings: normalizeStringArray(remote.sensitivityWarnings),
    origin: toSubmitMediaOrigin(remote.origin ?? undefined),
    details: remote.details ? compactObject({
      title: remote.details.title,
      description: remote.details.description,
      siteUrl: remote.details.siteUrl,
      isEmbeddable: remote.details.isEmbeddable,
      isMonetizable: remote.details.isMonetizable,
    }) : undefined,
    resource: remote.resource ? compactObject({
      mediaUrl: remote.resource.mediaUrl,
      availability: remote.resource.availability,
      video: toSubmitMediaVideo(remote.resource.video),
    }) : undefined,
  }) as ComparableMedia;
}

function compareEntity(
  remoteStatus: RemoteDbQueryObjectStatus,
  error: string | undefined,
  label: string,
  compare: () => { consistent: boolean; message: string | null },
): RemoteDbEntityComparison {
  if (remoteStatus === 'failed') {
    return {
      remoteStatus,
      consistent: false,
      message: `${label} query failed`,
      error: error ?? null,
    };
  }

  if (remoteStatus === 'missing') {
    return {
      remoteStatus,
      consistent: false,
      message: `${label} is missing on remote`,
      error: null,
    };
  }

  const result = compare();
  return {
    remoteStatus,
    consistent: result.consistent,
    message: result.message,
    error: null,
  };
}

function firstMessage(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return null;
}

export function buildRemoteDbSubmission(
  tweet: DbTweet,
  author: DbUser | undefined,
  media: DbMedia[],
): RemoteDbSubmissionEnvelope | null {
  return buildRemoteDbSubmissionBatch([{ tweet, author, media }]).submission;
}

export function buildRemoteDbSubmissionBatch(
  items: RemoteDbSubmissionSourceItem[],
): RemoteDbSubmissionBatchResult {
  if (items.length === 0) {
    return {
      submission: null,
      missingAuthorTweetIds: [],
      invalidUserCreatedAtIds: [],
      invalidTweetCreatedAtIds: [],
    };
  }

  const missingAuthorTweetIds = items
    .filter((item) => !item.author)
    .map((item) => item.tweet.id);
  if (missingAuthorTweetIds.length > 0) {
    return {
      submission: null,
      missingAuthorTweetIds,
      invalidUserCreatedAtIds: [],
      invalidTweetCreatedAtIds: [],
    };
  }

  const invalidTweetCreatedAtIds = items
    .filter((item) => !normalizeRemoteDbCreatedAt(item.tweet.createdAt))
    .map((item) => item.tweet.id);
  if (invalidTweetCreatedAtIds.length > 0) {
    return {
      submission: null,
      missingAuthorTweetIds: [],
      invalidUserCreatedAtIds: [],
      invalidTweetCreatedAtIds,
    };
  }

  const users = new Map<string, RemoteDbSubmitUser>();
  const tweets = new Map<string, RemoteDbSubmitTweet>();
  const mediaMap = new Map<string, RemoteDbSubmitMedia>();
  const invalidUserCreatedAtIds = new Set<string>();

  for (const item of items) {
    const author = item.author as DbUser;
    const normalizedUserCreatedAt = normalizeRemoteDbCreatedAt(author.createdAt);
    if (author.createdAt && !normalizedUserCreatedAt) {
      invalidUserCreatedAtIds.add(author.id);
      continue;
    }

    if (!users.has(author.id)) {
      users.set(author.id, compactObject({
        id: author.id,
        registeredAt: normalizedUserCreatedAt ?? undefined,
        profile: compactObject({
          displayName: author.profile.displayName,
          userName: author.profile.userName,
          avatarUrl: author.profile.avatarUrl,
          usesDefaultAvatar: author.profile.usesDefaultAvatar,
          avatarShape: author.profile.avatarShape,
          bannerUrl: author.profile.bannerUrl,
          location: author.profile.location,
          bio: author.profile.bio ? toSubmitAnnotatedText(author.profile.bio) : undefined,
          profileLinks: author.profile.profileLinks.map((link) => toSubmitResolvedUrl(link)),
        }),
        pinnedTweetIds: [...author.pinnedTweetIds],
        identity: compactObject({
          verification: author.identity?.verification ? compactObject({
            isBlueVerified: author.identity.verification.isBlueVerified,
            type: author.identity.verification.type,
          }) as RemoteDbSubmitUserVerification : undefined,
          disclosure: author.identity?.disclosure ? compactObject({
            relation: author.identity.disclosure.relation,
            subjectId: author.identity.disclosure.subjectId,
            subjectHandle: author.identity.disclosure.subjectHandle,
            subjectName: author.identity.disclosure.subjectName,
            subjectUrl: author.identity.disclosure.subjectUrl,
          }) as RemoteDbSubmitUserDisclosure : undefined,
          parodyLabel: author.identity?.parodyLabel,
          hasCompletedNewAccountReview: author.identity?.hasCompletedNewAccountReview,
          isPossiblySensitive: author.identity?.isPossiblySensitive,
        }) as RemoteDbSubmitUserIdentity | undefined,
        professional: author.professional ? compactObject({
          id: author.professional.id,
          type: author.professional.type,
          categories: author.professional.categories.map((category) => ({
            id: category.id,
            name: category.name,
          })),
        }) as RemoteDbSubmitUserProfessional : undefined,
        stats: author.stats ? compactObject({
          followers: author.stats.followers,
          following: author.stats.following,
          likes: author.stats.likes,
          mediaPosts: author.stats.mediaPosts,
          tweets: author.stats.tweets,
          listed: author.stats.listed,
        }) as RemoteDbSubmitUserStats : undefined,
        features: author.features ? compactObject({
          canDm: author.features.canDm,
          canTagMedia: author.features.canTagMedia,
          isProtected: author.features.isProtected,
          canBeSubscribed: author.features.canBeSubscribed,
        }) as RemoteDbSubmitUserFeatures : undefined,
      })!);
    }

    tweets.set(item.tweet.id, compactObject({
      id: item.tweet.id,
      publishedAt: normalizeRemoteDbCreatedAt(item.tweet.createdAt) as string,
      source: item.tweet.source,
      authorId: item.tweet.authorId,
      place: item.tweet.place ? compactObject({
        id: item.tweet.place.id,
        name: item.tweet.place.name,
        fullName: item.tweet.place.fullName,
        country: item.tweet.place.country,
        countryCode: item.tweet.place.countryCode,
        kind: item.tweet.place.kind,
        boundary: item.tweet.place.boundary?.map((point) => ({
          longitude: point.longitude,
          latitude: point.latitude,
        })),
      }) as RemoteDbSubmitTweetPlace : undefined,
      content: {
        legacyText: toSubmitAnnotatedText(item.tweet.content.legacyText),
        note: item.tweet.content.note ? compactObject({
          id: item.tweet.content.note.id,
          text: toSubmitAnnotatedText(item.tweet.content.note.text),
        }) : undefined,
        mediaIds: [...item.tweet.content.mediaIds],
        language: item.tweet.content.language,
      },
      conversation: compactObject({
        conversationId: item.tweet.conversation.conversationId,
        replyTo: item.tweet.conversation.replyTo ? compactObject({
          tweetId: item.tweet.conversation.replyTo.tweetId,
          userId: item.tweet.conversation.replyTo.userId,
          userName: item.tweet.conversation.replyTo.userName,
        }) : undefined,
        quote: item.tweet.conversation.quote ? compactObject({
          tweetId: item.tweet.conversation.quote.tweetId,
          permalink: item.tweet.conversation.quote.permalink
            ? toSubmitResolvedUrl(item.tweet.conversation.quote.permalink)
            : undefined,
        }) : undefined,
        repostId: item.tweet.conversation.repostId,
      })!,
      stats: compactObject({
        views: item.tweet.stats.views,
        replies: item.tweet.stats.replies,
        reposts: item.tweet.stats.reposts,
        quotes: item.tweet.stats.quotes,
        likes: item.tweet.stats.likes,
        bookmarks: item.tweet.stats.bookmarks,
      }) as RemoteDbSubmitTweetStats | undefined,
      edit: item.tweet.edit ? compactObject({
        versionIds: [...item.tweet.edit.versionIds],
        editableUntilAt: normalizeDateTime(item.tweet.edit.editableUntilAt),
        remainingEdits: item.tweet.edit.remainingEdits,
        }) as RemoteDbSubmitTweetEdit : undefined,
      policy: item.tweet.policy ? compactObject({
        replyPolicy: item.tweet.policy.replyPolicy,
        followersOnly: item.tweet.policy.followersOnly,
        isPossiblySensitive: item.tweet.policy.isPossiblySensitive,
        availableActions: [...(item.tweet.policy.availableActions ?? [])],
        isMediaVisibilityRestricted: item.tweet.policy.isMediaVisibilityRestricted,
        paidPromotion: item.tweet.policy.paidPromotion,
      }) as RemoteDbSubmitTweetPolicy : undefined,
      communityNote: item.tweet.communityNote ? compactObject({
        id: item.tweet.communityNote.id,
        title: item.tweet.communityNote.title,
        shortTitle: item.tweet.communityNote.shortTitle,
        subtitle: item.tweet.communityNote.subtitle
          ? toSubmitAnnotatedText(item.tweet.communityNote.subtitle)
          : undefined,
        footer: item.tweet.communityNote.footer
          ? toSubmitAnnotatedText(item.tweet.communityNote.footer)
          : undefined,
        destinationUrl: item.tweet.communityNote.destinationUrl,
      }) as RemoteDbSubmitTweetCommunityNote : undefined,
    })!);

    for (const media of item.media) {
      mediaMap.set(media.id, compactObject({
        id: media.id,
        type: media.type,
        mediaUrl: media.mediaUrl,
        altText: media.altText,
        grokPostId: media.grokPostId,
        geometry: media.geometry ? compactObject({
          width: media.geometry.width,
          height: media.geometry.height,
          focusRects: media.geometry.focusRects.map((rect) => ({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          })),
        }) as RemoteDbSubmitMediaGeometry : undefined,
        variants: media.variants ? compactObject({
          large: media.variants.large ? {
            width: media.variants.large.width,
            height: media.variants.large.height,
            resizeMode: media.variants.large.resizeMode,
          } : undefined,
          medium: media.variants.medium ? {
            width: media.variants.medium.width,
            height: media.variants.medium.height,
            resizeMode: media.variants.medium.resizeMode,
          } : undefined,
          small: media.variants.small ? {
            width: media.variants.small.width,
            height: media.variants.small.height,
            resizeMode: media.variants.small.resizeMode,
          } : undefined,
          thumb: media.variants.thumb ? {
            width: media.variants.thumb.width,
            height: media.variants.thumb.height,
            resizeMode: media.variants.thumb.resizeMode,
          } : undefined,
        }) as RemoteDbSubmitMediaVariants : undefined,
        taggedUsers: media.taggedUsers.map((tag) => compactObject({
          userId: tag.userId,
          kind: tag.kind,
        }) as RemoteDbSubmitMediaTag),
        sensitivityWarnings: [...(media.sensitivityWarnings ?? [])],
        availability: media.availability,
        video: media.video ? compactObject({
          aspectRatio: media.video.aspectRatio ? [media.video.aspectRatio[0], media.video.aspectRatio[1]] as [number, number] : undefined,
          durationMs: media.video.durationMs,
          variants: media.video.variants.map((variant) => compactObject({
            bitrate: variant.bitrate,
            contentType: variant.contentType,
            url: variant.url,
          })!).filter(Boolean),
        }) as RemoteDbSubmitMediaVideo : undefined,
        origin: toSubmitMediaOrigin(media.origin),
        details: media.details ? compactObject({
          title: media.details.title,
          description: media.details.description,
          siteUrl: media.details.siteUrl,
          isEmbeddable: media.details.isEmbeddable,
          isMonetizable: media.details.isMonetizable,
        }) as RemoteDbSubmitMediaDetails : undefined,
      })!);
    }
  }

  if (invalidUserCreatedAtIds.size > 0) {
    return {
      submission: null,
      missingAuthorTweetIds: [],
      invalidUserCreatedAtIds: [...invalidUserCreatedAtIds],
      invalidTweetCreatedAtIds: [],
    };
  }

  return {
    submission: {
      users: Array.from(users.values()),
      tweets: Array.from(tweets.values()),
      media: Array.from(mediaMap.values()),
    },
    missingAuthorTweetIds: [],
    invalidUserCreatedAtIds: [],
    invalidTweetCreatedAtIds: [],
  };
}

export function compareRemoteDbTweetBundle(
  tweet: DbTweet,
  author: DbUser | undefined,
  media: DbMedia[],
  bundle: RemoteDbTweetBundle,
): RemoteDbStatusComparison {
  const tweetComparison = compareEntity(
    bundle.tweet.status,
    bundle.tweet.error,
    'Tweet',
    () => {
      if (!bundle.tweet.data) {
        return {
          consistent: false,
          message: 'Remote tweet payload is empty',
        };
      }

      return deepEqual(toComparableTweet(tweet), toComparableRemoteTweet(bundle.tweet.data))
        ? { consistent: true, message: null }
        : { consistent: false, message: 'Remote tweet data differs from the local record' };
    },
  );

  const authorComparison = author && bundle.author
    ? compareEntity(
        bundle.author.status,
        bundle.author.error,
        'Author',
        () => {
          if (!bundle.author?.data) {
            return {
              consistent: false,
              message: 'Remote author payload is empty',
            };
          }

          return deepEqual(toComparableUser(author), toComparableRemoteUser(bundle.author.data))
            ? { consistent: true, message: null }
            : { consistent: false, message: 'Remote author data differs from the local record' };
        },
      )
    : author
      ? {
          remoteStatus: 'failed' as const,
          consistent: false,
          message: 'Remote author selector result is missing',
          error: null,
        }
      : null;

  const mismatchIds: string[] = [];
  const missingIds: string[] = [];
  const failedIds: string[] = [];
  let consistentMediaCount = 0;
  let foundMediaCount = 0;

  for (const mediaItem of media) {
    const result = bundle.media.find((item) => item.id === mediaItem.id);
    if (!result) {
      failedIds.push(mediaItem.id);
      continue;
    }

    if (result.status === 'missing') {
      missingIds.push(mediaItem.id);
      continue;
    }

    if (result.status === 'failed') {
      failedIds.push(mediaItem.id);
      continue;
    }

    foundMediaCount += 1;
    if (!result.data) {
      failedIds.push(mediaItem.id);
      continue;
    }

    if (deepEqual(toComparableMedia(mediaItem), toComparableRemoteMedia(result.data))) {
      consistentMediaCount += 1;
    } else {
      mismatchIds.push(mediaItem.id);
    }
  }

  const hasFailed = tweetComparison.remoteStatus === 'failed'
    || authorComparison?.remoteStatus === 'failed'
    || failedIds.length > 0;
  const hasMissing = tweetComparison.remoteStatus === 'missing'
    || authorComparison?.remoteStatus === 'missing'
    || missingIds.length > 0;
  const hasMismatch = !tweetComparison.consistent
    || Boolean(authorComparison && !authorComparison.consistent)
    || mismatchIds.length > 0;

  const overallStatus = hasFailed
    ? 'failed'
    : hasMissing
      ? 'missing'
      : hasMismatch
        ? 'mismatch'
        : 'in_sync';

  return {
    tweet: tweetComparison,
    author: authorComparison,
    media: {
      total: media.length,
      found: foundMediaCount,
      missing: missingIds.length,
      failed: failedIds.length,
      consistent: consistentMediaCount,
      mismatchIds,
      missingIds,
      failedIds,
    },
    overallStatus,
    message: firstMessage([
      tweetComparison.message,
      authorComparison?.message,
      mismatchIds.length > 0 ? `Remote media data differs for ${mismatchIds.length} item(s)` : null,
      missingIds.length > 0 ? `Remote media is missing ${missingIds.length} item(s)` : null,
      failedIds.length > 0 ? `Remote media query failed for ${failedIds.length} item(s)` : null,
    ]),
  };
}
