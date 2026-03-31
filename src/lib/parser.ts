import type { XUser, XTweet, XMedia, ParsedResponse, VideoVariant, MediaType } from './types';
import { mergeEntity } from './entity-merge';

function safeStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function safeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => safeStr(item)).filter(Boolean);
}

function createParsedResponse(instructionPath: string | null = null, warnings: string[] = []): ParsedResponse {
  return {
    users: new Map(),
    tweets: new Map(),
    media: new Map(),
    meta: {
      instructionPath,
      warnings: [...warnings],
    },
  };
}

function stripHtmlSource(html: string): string {
  const m = />([^<]*)</.exec(html);
  return m ? m[1] : html;
}

function resolveUserProfileUrl(legacy: Record<string, any>): string | null {
  const expandedUrl = legacy?.entities?.url?.urls?.find((item: any) => typeof item?.expanded_url === 'string')?.expanded_url;
  if (expandedUrl) return safeStr(expandedUrl);
  return legacy?.url ? safeStr(legacy.url) : null;
}

function parseUser(raw: Record<string, any>): XUser | null {
  if (raw?.__typename !== 'User') return null;
  const restId = safeStr(raw.rest_id);
  if (!restId) return null;

  const coreInfo = raw.core ?? {};
  const legacy = raw.legacy ?? {};
  const avatar = raw.avatar ?? {};
  const loc = raw.location ?? {};
  const priv = raw.privacy ?? {};

  return {
    id: restId,
    name: safeStr(coreInfo.name),
    screenName: safeStr(coreInfo.screen_name),
    description: safeStr(legacy.description),
    location: safeStr(loc.location),
    avatarUrl: safeStr(avatar.image_url),
    profileUrl: resolveUserProfileUrl(legacy),
    bannerUrl: legacy.profile_banner_url ? safeStr(legacy.profile_banner_url) : null,
    isBlueVerified: !!raw.is_blue_verified,
    verifiedType: raw.verification?.verified_type ? safeStr(raw.verification.verified_type) : null,
    isProtected: !!priv.protected,
    profileImageShape: safeStr(raw.profile_image_shape),
    professionalType: raw.professional?.professional_type ? safeStr(raw.professional.professional_type) : null,
    followersCount: safeNum(legacy.followers_count),
    friendsCount: safeNum(legacy.friends_count),
    favouritesCount: safeNum(legacy.favourites_count),
    statusesCount: safeNum(legacy.statuses_count),
    mediaCount: safeNum(legacy.media_count),
    listedCount: safeNum(legacy.listed_count),
    pinnedTweetIds: safeStringArray(legacy.pinned_tweet_ids_str),
    createdAt: safeStr(coreInfo.created_at),
  };
}

function upsertParsedUser(ctx: ParsedResponse, user: XUser): XUser {
  const existing = ctx.users.get(user.id);
  if (existing) {
    mergeEntity(existing, user);
    return existing;
  }
  ctx.users.set(user.id, user);
  return user;
}

function upsertParsedMedia(ctx: ParsedResponse, media: XMedia): XMedia {
  const existing = ctx.media.get(media.id);
  if (existing) {
    mergeEntity(existing, media);
    return existing;
  }
  ctx.media.set(media.id, media);
  return media;
}

function resolveThumbUrl(mediaUrl: string): string {
  if (!mediaUrl) return mediaUrl;
  const dotIdx = mediaUrl.lastIndexOf('.');
  if (dotIdx === -1) return mediaUrl;
  const ext = mediaUrl.slice(dotIdx + 1);
  const base = mediaUrl.slice(0, dotIdx);
  return `${base}?format=${ext}&name=small`;
}

function stripQuery(url: string): string {
  const idx = url.indexOf('?');
  return idx === -1 ? url : url.slice(0, idx);
}

function resolvePhotoSourceUrl(mediaUrl: string): string {
  if (!mediaUrl) return mediaUrl;
  const dotIdx = mediaUrl.lastIndexOf('.');
  if (dotIdx === -1) return mediaUrl;
  const ext = mediaUrl.slice(dotIdx + 1);
  const base = mediaUrl.slice(0, dotIdx);
  return `${base}?format=${ext}&name=orig`;
}

function resolveBestVideoUrl(variants: VideoVariant[]): string {
  let best: VideoVariant | null = null;
  for (const v of variants) {
    if (v.contentType !== 'video/mp4') continue;
    if (!best || (v.bitrate ?? 0) > (best.bitrate ?? 0)) best = v;
  }
  return best?.url ?? '';
}

function parseMediaItem(
  raw: Record<string, any>,
  tweetId: string,
  ctx: ParsedResponse,
): XMedia | null {
  const id = safeStr(raw.id_str);
  if (!id) return null;

  const origInfo = raw.original_info ?? {};
  const videoInfo = raw.video_info;

  const variants: VideoVariant[] = [];
  if (Array.isArray(videoInfo?.variants)) {
    for (const v of videoInfo.variants) {
      variants.push({
        bitrate: v.bitrate ?? null,
        contentType: safeStr(v.content_type),
        url: stripQuery(safeStr(v.url)),
      });
    }
  }

  const mediaType = safeStr(raw.type, 'photo') as MediaType;
  const mediaUrl = safeStr(raw.media_url_https);

  const sourceUrl = mediaType === 'photo'
    ? resolvePhotoSourceUrl(mediaUrl)
    : (resolveBestVideoUrl(variants) || mediaUrl);

  const sourceUserRaw = raw.additional_media_info?.source_user?.user_results?.result;
  if (sourceUserRaw) {
    const sourceUser = parseUser(sourceUserRaw);
    if (sourceUser) {
      upsertParsedUser(ctx, sourceUser);
    }
  }

  return {
    id,
    mediaKey: safeStr(raw.media_key),
    tweetId,
    type: mediaType,
    mediaUrl,
    thumbUrl: resolveThumbUrl(mediaUrl),
    sourceUrl,
    width: safeNum(origInfo.width),
    height: safeNum(origInfo.height),
    altText: raw.ext_alt_text ? safeStr(raw.ext_alt_text) : null,
    allowDownload: !!raw.allow_download_status?.allow_download,
    sourceStatusId: raw.source_status_id_str ? safeStr(raw.source_status_id_str) : null,
    sourceUserId: raw.source_user_id_str ? safeStr(raw.source_user_id_str) : null,
    durationMs: videoInfo?.duration_millis ?? null,
    videoVariants: variants,
  };
}

function resolvePreferredTweetText(raw: Record<string, any>, legacy: Record<string, any>) {
  const legacyFullText = safeStr(legacy.full_text);
  const noteText = raw.note_tweet?.note_tweet_results?.result?.text
    ? safeStr(raw.note_tweet.note_tweet_results.result.text)
    : null;

  return {
    legacyFullText,
    noteText,
    fullText: noteText || legacyFullText,
  };
}

function parseTweet(
  raw: Record<string, any>,
  ctx: ParsedResponse,
): XTweet | null {
  const typename = safeStr(raw.__typename);

  if (typename === 'TweetWithVisibilityResults' && raw.tweet) {
    return parseTweet({ __typename: 'Tweet', ...raw.tweet }, ctx);
  }

  if (typename !== 'Tweet' && typename !== '') return null;

  const restId = safeStr(raw.rest_id);
  if (!restId) return null;

  const userRaw = raw.core?.user_results?.result;
  if (userRaw) {
    const user = parseUser(userRaw);
    if (user) {
      upsertParsedUser(ctx, user);
    }
  }

  const legacy = raw.legacy;
  if (!legacy) return null;

  const mediaIds: string[] = [];
  const seenMediaIds = new Set<string>();
  const extMedia = Array.isArray(legacy.extended_entities?.media)
    ? legacy.extended_entities.media
    : legacy.entities?.media;

  if (Array.isArray(extMedia)) {
    for (const m of extMedia) {
      const media = parseMediaItem(m, restId, ctx);
      if (!media) continue;
      const resolvedMedia = upsertParsedMedia(ctx, media);
      if (!seenMediaIds.has(resolvedMedia.id)) {
        seenMediaIds.add(resolvedMedia.id);
        mediaIds.push(resolvedMedia.id);
      }
    }
  }

  let quotedTweetId: string | null = null;
  const quotedResult = raw.quoted_status_result?.result;
  if (quotedResult) {
    const quotedTweet = parseTweet(quotedResult, ctx);
    if (quotedTweet) {
      quotedTweetId = quotedTweet.id;
    }
  }
  if (!quotedTweetId && legacy.quoted_status_id_str) {
    quotedTweetId = safeStr(legacy.quoted_status_id_str);
  }

  let retweetedTweetId: string | null = null;
  const retweetedResult = raw.retweeted_status_result?.result ?? legacy.retweeted_status_result?.result;
  if (retweetedResult) {
    const retweetedTweet = parseTweet(retweetedResult, ctx);
    if (retweetedTweet) {
      retweetedTweetId = retweetedTweet.id;
    }
  }

  const viewCount = raw.views?.count != null ? Number.parseInt(String(raw.views.count), 10) : null;
  const possiblySensitive = typeof legacy.possibly_sensitive === 'boolean'
    ? legacy.possibly_sensitive
    : (typeof raw.possibly_sensitive === 'boolean' ? raw.possibly_sensitive : null);
  const text = resolvePreferredTweetText(raw, legacy);

  const tweet: XTweet = {
    id: restId,
    authorId: safeStr(legacy.user_id_str),
    conversationId: safeStr(legacy.conversation_id_str),
    fullText: text.fullText,
    legacyFullText: text.legacyFullText,
    noteText: text.noteText,
    lang: safeStr(legacy.lang),
    createdAt: safeStr(legacy.created_at),
    inReplyToTweetId: legacy.in_reply_to_status_id_str ? safeStr(legacy.in_reply_to_status_id_str) : null,
    inReplyToUserId: legacy.in_reply_to_user_id_str ? safeStr(legacy.in_reply_to_user_id_str) : null,
    quotedTweetId,
    retweetedTweetId,
    viewCount: Number.isNaN(viewCount ?? Number.NaN) ? null : viewCount,
    possiblySensitive,
    favoriteCount: safeNum(legacy.favorite_count),
    retweetCount: safeNum(legacy.retweet_count),
    replyCount: safeNum(legacy.reply_count),
    quoteCount: safeNum(legacy.quote_count),
    bookmarkCount: safeNum(legacy.bookmark_count),
    mediaIds,
    source: stripHtmlSource(safeStr(raw.source ?? '')),
  };

  const existing = ctx.tweets.get(tweet.id);
  if (existing) {
    mergeEntity(existing, tweet);
    return existing;
  }

  ctx.tweets.set(tweet.id, tweet);
  return tweet;
}

function appendOrderedTweetId(tweetId: string, orderedIds: string[], seenIds: Set<string>) {
  if (!tweetId || seenIds.has(tweetId)) return;
  seenIds.add(tweetId);
  orderedIds.push(tweetId);
}

function walkTweetResult(
  result: any,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
) {
  if (!result || typeof result !== 'object') return;
  const tweet = parseTweet(result, ctx);
  if (tweet && orderedIds && seenIds) {
    appendOrderedTweetId(tweet.id, orderedIds, seenIds);
  }
}

function walkModuleItem(
  item: any,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
) {
  const tweetResult = item?.item?.itemContent?.tweet_results?.result;
  if (tweetResult) {
    walkTweetResult(tweetResult, ctx, orderedIds, seenIds);
  }
}

function walkEntryContent(
  content: any,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
) {
  if (!content) return;

  const itemResult = content.itemContent?.tweet_results?.result;
  if (itemResult) {
    walkTweetResult(itemResult, ctx, orderedIds, seenIds);
  }

  if (Array.isArray(content.items)) {
    for (const item of content.items) {
      walkModuleItem(item, ctx, orderedIds, seenIds);
    }
  }
}

function walkEntry(
  entry: any,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
) {
  walkEntryContent(entry?.content, ctx, orderedIds, seenIds);
}

interface InstructionCandidate {
  path: string;
  read: (response: any) => unknown;
}

interface InstructionExtraction {
  instructions: any[];
  instructionPath: string | null;
  warnings: string[];
}

const TIMELINE_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  {
    path: 'data.user.result.timeline.timeline.instructions',
    read: (response) => response?.data?.user?.result?.timeline?.timeline?.instructions,
  },
  {
    path: 'data.user.result.timeline_v2.timeline.instructions',
    read: (response) => response?.data?.user?.result?.timeline_v2?.timeline?.instructions,
  },
  {
    path: 'data.home.home_timeline_urt.instructions',
    read: (response) => response?.data?.home?.home_timeline_urt?.instructions,
  },
];

const TWEET_DETAIL_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  {
    path: 'data.threaded_conversation_with_injections_v2.instructions',
    read: (response) => response?.data?.threaded_conversation_with_injections_v2?.instructions,
  },
];

function extractInstructionArray(
  json: unknown,
  candidates: InstructionCandidate[],
  label: string,
): InstructionExtraction {
  if (!json || typeof json !== 'object') {
    return {
      instructions: [],
      instructionPath: null,
      warnings: [`${label} response was not an object`],
    };
  }

  const response = json as any;

  for (const candidate of candidates) {
    const value = candidate.read(response);
    if (Array.isArray(value)) {
      return {
        instructions: value,
        instructionPath: candidate.path,
        warnings: [],
      };
    }
  }

  const warnings: string[] = [];
  for (const candidate of candidates) {
    const value = candidate.read(response);
    if (value !== undefined) {
      warnings.push(`${label} instructions at ${candidate.path} were not an array`);
    }
  }
  warnings.push(`No ${label} instructions found at known paths`);

  return {
    instructions: [],
    instructionPath: null,
    warnings,
  };
}

function walkInstruction(
  instruction: any,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
) {
  if (!instruction || typeof instruction !== 'object') return;

  if (Array.isArray(instruction.entries)) {
    for (const entry of instruction.entries) {
      walkEntry(entry, ctx, orderedIds, seenIds);
    }
  }

  if (instruction.entry) {
    walkEntry(instruction.entry, ctx, orderedIds, seenIds);
  }

  if (Array.isArray(instruction.moduleItems)) {
    for (const item of instruction.moduleItems) {
      walkModuleItem(item, ctx, orderedIds, seenIds);
    }
  }
}

export interface TimelineParsedResponse extends ParsedResponse {
  /** Tweet IDs in timeline display order. */
  tweetIds: string[];
}

export interface UserMediaParsedResponse extends TimelineParsedResponse {}

function parseTimelineResponse(json: unknown): TimelineParsedResponse {
  const extracted = extractInstructionArray(json, TIMELINE_INSTRUCTION_CANDIDATES, 'timeline');
  const ctx: TimelineParsedResponse = {
    ...createParsedResponse(extracted.instructionPath, extracted.warnings),
    tweetIds: [],
  };

  if (extracted.instructions.length === 0) return ctx;

  const seenOrderedIds = new Set<string>();

  for (const instruction of extracted.instructions) {
    walkInstruction(instruction, ctx, ctx.tweetIds, seenOrderedIds);
  }

  return ctx;
}

export function parseHomeTimelineResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseHomeLatestTimelineResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseUserTweetsResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseUserMediaResponse(json: unknown): UserMediaParsedResponse {
  return parseTimelineResponse(json);
}

export function parseTweetDetailResponse(json: unknown): ParsedResponse {
  const extracted = extractInstructionArray(json, TWEET_DETAIL_INSTRUCTION_CANDIDATES, 'tweet detail');
  const ctx = createParsedResponse(extracted.instructionPath, extracted.warnings);

  for (const instruction of extracted.instructions) {
    walkInstruction(instruction, ctx);
  }

  return ctx;
}
