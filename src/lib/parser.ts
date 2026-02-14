import type { XUser, XTweet, XMedia, ParsedResponse, VideoVariant, MediaType } from './types';

function safeStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function safeNum(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function stripHtmlSource(html: string): string {
  const m = />([^<]*)</.exec(html);
  return m ? m[1] : html;
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
    bannerUrl: legacy.profile_banner_url ? safeStr(legacy.profile_banner_url) : null,
    isBlueVerified: !!raw.is_blue_verified,
    isProtected: !!priv.protected,
    followersCount: safeNum(legacy.followers_count),
    friendsCount: safeNum(legacy.friends_count),
    favouritesCount: safeNum(legacy.favourites_count),
    statusesCount: safeNum(legacy.statuses_count),
    mediaCount: safeNum(legacy.media_count),
    listedCount: safeNum(legacy.listed_count),
    createdAt: safeStr(coreInfo.created_at),
  };
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
  if (videoInfo?.variants) {
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

  // Parse source user from additional_media_info (reposted media)
  const sourceUserRaw = raw.additional_media_info?.source_user?.user_results?.result;
  if (sourceUserRaw) {
    const sourceUser = parseUser(sourceUserRaw);
    if (sourceUser && !ctx.users.has(sourceUser.id)) {
      ctx.users.set(sourceUser.id, sourceUser);
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

function parseTweet(
  raw: Record<string, any>,
  ctx: ParsedResponse,
): XTweet | null {
  const typename = safeStr(raw.__typename);

  // Handle TweetWithVisibilityResults wrapper
  if (typename === 'TweetWithVisibilityResults' && raw.tweet) {
    return parseTweet({ __typename: 'Tweet', ...raw.tweet }, ctx);
  }

  // Handle tweets without __typename (e.g. unwrapped from visibility wrapper)
  if (typename !== 'Tweet' && typename !== '') return null;

  const restId = safeStr(raw.rest_id);
  if (!restId) return null;

  // Parse author
  const userRaw = raw.core?.user_results?.result;
  if (userRaw) {
    const user = parseUser(userRaw);
    if (user && !ctx.users.has(user.id)) {
      ctx.users.set(user.id, user);
    }
  }

  const legacy = raw.legacy;
  if (!legacy) return null;

  // Parse media from extended_entities (preferred over entities)
  const mediaIds: string[] = [];
  const extMedia = legacy.extended_entities?.media;
  if (Array.isArray(extMedia)) {
    for (const m of extMedia) {
      const media = parseMediaItem(m, restId, ctx);
      if (media && !ctx.media.has(media.id)) {
        ctx.media.set(media.id, media);
        mediaIds.push(media.id);
      }
    }
  }

  // Parse quoted tweet recursively
  let quotedTweetId: string | null = null;
  const quotedResult = raw.quoted_status_result?.result;
  if (quotedResult) {
    const qt = parseTweet(quotedResult, ctx);
    if (qt) {
      quotedTweetId = qt.id;
    }
  }

  const viewCount = raw.views?.count != null ? parseInt(raw.views.count, 10) : null;

  const tweet: XTweet = {
    id: restId,
    authorId: safeStr(legacy.user_id_str),
    conversationId: safeStr(legacy.conversation_id_str),
    fullText: safeStr(legacy.full_text),
    lang: safeStr(legacy.lang),
    createdAt: safeStr(legacy.created_at),
    inReplyToTweetId: legacy.in_reply_to_status_id_str ? safeStr(legacy.in_reply_to_status_id_str) : null,
    inReplyToUserId: legacy.in_reply_to_user_id_str ? safeStr(legacy.in_reply_to_user_id_str) : null,
    quotedTweetId,
    viewCount: Number.isNaN(viewCount!) ? null : viewCount,
    favoriteCount: safeNum(legacy.favorite_count),
    retweetCount: safeNum(legacy.retweet_count),
    replyCount: safeNum(legacy.reply_count),
    quoteCount: safeNum(legacy.quote_count),
    bookmarkCount: safeNum(legacy.bookmark_count),
    mediaIds,
    source: stripHtmlSource(safeStr(legacy.source ?? raw.source ?? '')),
  };

  if (!ctx.tweets.has(tweet.id)) {
    ctx.tweets.set(tweet.id, tweet);
  }

  return tweet;
}

function walkTweetResult(result: any, ctx: ParsedResponse) {
  if (!result || typeof result !== 'object') return;
  parseTweet(result, ctx);
}

function walkEntry(entry: any, ctx: ParsedResponse) {
  if (!entry?.content) return;
  const content = entry.content;

  // TimelineTimelineItem
  const itemResult = content.itemContent?.tweet_results?.result;
  if (itemResult) {
    walkTweetResult(itemResult, ctx);
  }

  // TimelineTimelineModule (conversation threads)
  if (Array.isArray(content.items)) {
    for (const item of content.items) {
      const tweetResult = item?.item?.itemContent?.tweet_results?.result;
      if (tweetResult) {
        walkTweetResult(tweetResult, ctx);
      }
    }
  }
}

export interface UserMediaParsedResponse extends ParsedResponse {
  /** Tweet IDs in timeline display order (preserves server ordering). */
  tweetIds: string[];
}

function walkModuleItem(item: any, ctx: ParsedResponse, orderedIds: string[]) {
  const tweetResult = item?.item?.itemContent?.tweet_results?.result;
  if (tweetResult) {
    const tweet = parseTweet(tweetResult, ctx);
    if (tweet) orderedIds.push(tweet.id);
  }
}

export function parseUserMediaResponse(json: unknown): UserMediaParsedResponse {
  const ctx: UserMediaParsedResponse = {
    users: new Map(),
    tweets: new Map(),
    media: new Map(),
    tweetIds: [],
  };

  if (!json || typeof json !== 'object') return ctx;

  const instructions = (json as any)?.data?.user?.result?.timeline?.timeline?.instructions;
  if (!Array.isArray(instructions)) return ctx;

  for (const instruction of instructions) {
    // Subsequent page loads: tweets arrive via TimelineAddToModule
    if (instruction.type === 'TimelineAddToModule' && Array.isArray(instruction.moduleItems)) {
      for (const item of instruction.moduleItems) {
        walkModuleItem(item, ctx, ctx.tweetIds);
      }
    }

    // Initial page load: tweets inside TimelineAddEntries → TimelineTimelineModule
    if (instruction.type === 'TimelineAddEntries' && Array.isArray(instruction.entries)) {
      for (const entry of instruction.entries) {
        if (entry.content?.entryType === 'TimelineTimelineModule' && Array.isArray(entry.content.items)) {
          for (const item of entry.content.items) {
            walkModuleItem(item, ctx, ctx.tweetIds);
          }
        }
      }
    }
  }

  return ctx;
}

export function parseTweetDetailResponse(json: unknown): ParsedResponse {
  const ctx: ParsedResponse = {
    users: new Map(),
    tweets: new Map(),
    media: new Map(),
  };

  if (!json || typeof json !== 'object') return ctx;

  const instructions = (json as any)?.data?.threaded_conversation_with_injections_v2?.instructions;
  if (!Array.isArray(instructions)) return ctx;

  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') continue;
    if (!Array.isArray(instruction.entries)) continue;
    for (const entry of instruction.entries) {
      walkEntry(entry, ctx);
    }
  }

  return ctx;
}
