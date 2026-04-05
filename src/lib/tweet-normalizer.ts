import { TweetSchema } from '../schema/tweet-schema';
import { parseTweetResult as parseRawTweetResult } from '../schema/tweet-raw-schema';
import type * as normalized from '../schema/tweet-schema';
import type * as raw from '../schema/tweet-raw-schema';

function createTextEntities(): normalized.TextEntities {
  return {
    hashtags: [],
    symbols: [],
    urls: [],
    mentions: [],
  };
}

function hasAnyDefinedValue(value: Record<string, unknown>): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

function toOptionalObject<T extends Record<string, unknown>>(value: T): T | undefined {
  return hasAnyDefinedValue(value) ? value : undefined;
}

function toTextRange(indices: number[] | undefined | null): normalized.TextRange | undefined {
  if (!indices || indices.length < 2) return undefined;
  const [start, end] = indices;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < 0 || end < start) {
    return undefined;
  }
  return { start, end };
}

function stripHtmlSource(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = />([^<]*)</.exec(html);
  const text = (match ? match[1] : html).trim();
  return text || undefined;
}

function normalizeResolvedUrls(urls: raw.UrlEntity[] | undefined): normalized.ResolvedUrl[] {
  return (urls ?? []).map((item) => ({
    url: item.url,
    expandedUrl: item.expanded_url,
    displayText: item.display_url,
  }));
}

function normalizeTweetHashtags(hashtags: raw.HashtagEntity[] | undefined): normalized.HashtagEntity[] {
  return (hashtags ?? [])
    .map((item) => {
      const range = toTextRange(item.indices);
      if (!range) return null;
      return {
        text: item.text,
        range,
      };
    })
    .filter(Boolean) as normalized.HashtagEntity[];
}

function normalizeTweetSymbols(symbols: raw.SymbolEntity[] | undefined): normalized.SymbolEntity[] {
  return (symbols ?? []).map((item) => ({
    text: item.text ?? '',
    range: toTextRange(item.indices),
    ticker: item.tag?.info?.info?.ticker,
    name: item.tag?.info?.info?.name,
  }));
}

function normalizeTweetUrls(urls: raw.UrlEntity[] | undefined): normalized.UrlEntity[] {
  return (urls ?? [])
    .map((item) => {
      const range = toTextRange(item.indices);
      if (!range) return null;
      return {
        url: item.url,
        expandedUrl: item.expanded_url,
        displayText: item.display_url,
        range,
      };
    })
    .filter(Boolean) as normalized.UrlEntity[];
}

function normalizeTweetMentions(mentions: raw.UserMention[] | undefined): normalized.MentionEntity[] {
  return (mentions ?? [])
    .map((item) => {
      const range = toTextRange(item.indices);
      if (!range) return null;
      return {
        userId: item.id_str,
        name: item.name,
        userName: item.screen_name,
        range,
      };
    })
    .filter(Boolean) as normalized.MentionEntity[];
}

function normalizeAnnotatedTextFromTweetEntities(
  text: string,
  entities: raw.TweetEntities | undefined,
  displayRange?: number[] | undefined,
  styles?: normalized.TextStyleRange[] | undefined,
): normalized.AnnotatedText {
  return {
    text,
    displayRange: toTextRange(displayRange),
    entities: {
      hashtags: normalizeTweetHashtags(entities?.hashtags),
      symbols: normalizeTweetSymbols(entities?.symbols),
      urls: normalizeTweetUrls(entities?.urls),
      mentions: normalizeTweetMentions(entities?.user_mentions),
    },
    styles,
  };
}

function normalizeAnnotatedTextFromSimpleUrls(
  text: string,
  urls: raw.UrlEntity[] | undefined,
): normalized.AnnotatedText {
  return {
    text,
    entities: {
      hashtags: [],
      symbols: [],
      urls: normalizeTweetUrls(urls),
      mentions: [],
    },
  };
}

function normalizeAnnotatedTextFromTimelineText(
  value: raw.TimelineText | undefined,
): normalized.AnnotatedText | undefined {
  if (!value) return undefined;

  const entities = createTextEntities();
  for (const entity of value.entities ?? []) {
    const range = toTextRange([entity.fromIndex, entity.toIndex]);
    if (!range || !entity.ref) continue;

    const mentionResult = entity.ref.mention_results?.result;
    if (mentionResult?.rest_id) {
      const userName = entity.ref.screen_name ?? mentionResult.core?.screen_name ?? '';
      entities.mentions.push({
        userId: mentionResult.rest_id,
        name: userName,
        userName,
        range,
      });
      continue;
    }

    if (entity.ref.url) {
      entities.urls.push({
        url: entity.ref.url,
        expandedUrl: entity.ref.url,
        displayText: entity.ref.url,
        range,
      });
    }
  }

  return {
    text: value.text,
    entities,
  };
}

function normalizeTextStyles(
  richtext: raw.NoteTweetRichText | undefined,
): normalized.TextStyleRange[] | undefined {
  const styles = (richtext?.richtext_tags ?? [])
    .map((item) => {
      const range = toTextRange([item.from_index, item.to_index]);
      if (!range) return null;
      return {
        range,
        styles: item.richtext_types,
      };
    })
    .filter(Boolean) as normalized.TextStyleRange[];

  return styles.length > 0 ? styles : undefined;
}

function normalizeMediaType(value: string): normalized.TweetMedia['type'] {
  if (value === 'photo' || value === 'video' || value === 'animated_gif') {
    return value;
  }
  throw new Error(`Unsupported media type: ${value}`);
}

function normalizeMediaRect(
  value: { x: number; y: number; w: number; h: number } | undefined,
): normalized.MediaRect | undefined {
  if (!value) return undefined;
  if (value.x < 0 || value.y < 0 || value.w <= 0 || value.h <= 0) return undefined;
  return {
    x: value.x,
    y: value.y,
    width: value.w,
    height: value.h,
  };
}

function normalizeMediaRects(
  values: Array<{ x: number; y: number; w: number; h: number }> | undefined,
): normalized.MediaRect[] | undefined {
  const rects = (values ?? [])
    .map((item) => normalizeMediaRect(item))
    .filter(Boolean) as normalized.MediaRect[];

  return rects.length > 0 ? rects : undefined;
}

function normalizeMediaFaces(features: raw.MediaFeatures | undefined): normalized.TweetMediaFaces | undefined {
  if (!features) return undefined;

  return toOptionalObject({
    large: normalizeMediaRects(features.large?.faces),
    medium: normalizeMediaRects(features.medium?.faces),
    small: normalizeMediaRects(features.small?.faces),
    thumb: normalizeMediaRects(features.small?.faces),
    original: normalizeMediaRects(features.orig?.faces),
  });
}

function normalizeMediaVariants(sizes: raw.MediaSizes | undefined): normalized.MediaVariants | undefined {
  if (!sizes) return undefined;

  const normalizeVariant = (value: raw.MediaSize | undefined): normalized.MediaVariant | undefined => {
    if (!value) return undefined;
    if (value.w <= 0 || value.h <= 0) return undefined;
    return {
      width: value.w,
      height: value.h,
      resizeMode: value.resize,
    };
  };

  return toOptionalObject({
    large: normalizeVariant(sizes.large),
    medium: normalizeVariant(sizes.medium),
    small: normalizeVariant(sizes.small),
    thumb: normalizeVariant(sizes.thumb),
  });
}

function normalizeMediaGeometry(info: raw.OriginalInfo | undefined): normalized.TweetMediaGeometry | undefined {
  if (!info) return undefined;
  if (info.width <= 0 || info.height <= 0) return undefined;

  return {
    width: info.width,
    height: info.height,
    focusRects: (info.focus_rects ?? [])
      .map((item) => normalizeMediaRect(item))
      .filter(Boolean) as normalized.MediaRect[],
  };
}

function normalizeVideo(videoInfo: raw.VideoInfo | undefined): normalized.TweetVideo | undefined {
  if (!videoInfo) return undefined;

  const aspectRatio = videoInfo.aspect_ratio && videoInfo.aspect_ratio.length >= 2
    ? videoInfo.aspect_ratio.slice(0, 2)
    : undefined;

  return {
    aspectRatio: aspectRatio && aspectRatio[0] > 0 && aspectRatio[1] > 0
      ? [aspectRatio[0], aspectRatio[1]]
      : undefined,
    durationMs: videoInfo.duration_millis,
    variants: (videoInfo.variants ?? []).map((variant) => ({
      contentType: variant.content_type,
      bitrate: variant.bitrate,
      url: variant.url,
    })),
  };
}

function normalizeUser(rawUser: raw.User): normalized.TweetUser {
  const profile: normalized.TweetUserProfile = {
    avatarUrl: rawUser.avatar?.image_url,
    usesDefaultAvatar: rawUser.legacy?.default_profile_image,
    avatarShape: rawUser.profile_image_shape,
    bannerUrl: rawUser.legacy?.profile_banner_url,
    location: rawUser.location?.location,
    bio: rawUser.legacy?.description || rawUser.profile_bio?.description
      ? normalizeAnnotatedTextFromSimpleUrls(
          rawUser.legacy?.description ?? rawUser.profile_bio?.description ?? '',
          rawUser.legacy?.entities?.description?.urls,
        )
      : undefined,
    profileLinks: normalizeResolvedUrls(rawUser.legacy?.entities?.url?.urls),
    isPossiblySensitive: rawUser.legacy?.possibly_sensitive,
  };

  const verification = toOptionalObject({
    isBlueVerified: rawUser.is_blue_verified,
    type: rawUser.verification?.verified_type,
  });

  const accountLabel = rawUser.affiliates_highlighted_label?.label
    ? toOptionalObject({
        type: rawUser.affiliates_highlighted_label.label.userLabelType,
        displayType: rawUser.affiliates_highlighted_label.label.userLabelDisplayType,
        text: rawUser.affiliates_highlighted_label.label.description,
        detail: normalizeAnnotatedTextFromTimelineText(rawUser.affiliates_highlighted_label.label.longDescription),
        badgeUrl: rawUser.affiliates_highlighted_label.label.badge?.url,
        url: rawUser.affiliates_highlighted_label.label.url?.url,
        urlType: rawUser.affiliates_highlighted_label.label.url?.urlType,
      })
    : undefined;

  const identity = toOptionalObject({
    verification,
    accountLabel,
    parodyLabel: rawUser.parody_commentary_fan_label,
    hasCompletedNewAccountReview: rawUser.has_graduated_access,
  });

  const professional = rawUser.professional
    ? {
        id: rawUser.professional.rest_id,
        type: rawUser.professional.professional_type,
        categories: (rawUser.professional.category ?? []).map((category) => ({
          id: String(category.id),
          name: category.name,
        })),
      }
    : undefined;

  const stats = toOptionalObject({
    followers: rawUser.legacy?.followers_count,
    following: rawUser.legacy?.friends_count,
    likes: rawUser.legacy?.favourites_count,
    mediaPosts: rawUser.legacy?.media_count,
    tweets: rawUser.legacy?.statuses_count,
    listed: rawUser.legacy?.listed_count,
  });

  const features = toOptionalObject({
    canDm: rawUser.dm_permissions?.can_dm,
    canTagMedia: rawUser.media_permissions?.can_media_tag,
    isProtected: rawUser.privacy?.protected,
    canBeSubscribed: rawUser.super_follow_eligible,
  });

  return {
    id: rawUser.rest_id ?? rawUser.id ?? '',
    displayName: rawUser.core?.name ?? '',
    userName: rawUser.core?.screen_name ?? '',
    createdAt: rawUser.core?.created_at,
    profile,
    pinnedTweetIds: rawUser.legacy?.pinned_tweet_ids_str ?? [],
    identity,
    professional,
    stats,
    features,
  };
}

function normalizeMedia(rawMedia: raw.Media): normalized.TweetMedia {
  const originUserRaw = rawMedia.additional_media_info?.source_user?.user_results?.result;
  const originUser = originUserRaw ? normalizeUser(originUserRaw) : undefined;

  return {
    id: rawMedia.id_str,
    type: normalizeMediaType(rawMedia.type),
    displayText: rawMedia.display_url,
    expandedUrl: rawMedia.expanded_url,
    url: rawMedia.url,
    mediaUrl: rawMedia.media_url_https,
    altText: rawMedia.ext_alt_text,
    grokPostId: rawMedia.grok_post_id,
    geometry: normalizeMediaGeometry(rawMedia.original_info),
    variants: normalizeMediaVariants(rawMedia.sizes),
    taggedUsers: (rawMedia.features?.all?.tags ?? []).map((tag) => ({
      userId: tag.user_id,
      name: tag.name,
      userName: tag.screen_name,
      kind: tag.type,
    })),
    faces: normalizeMediaFaces(rawMedia.features),
    origin: toOptionalObject({
      tweetId: rawMedia.source_status_id_str,
      userId: rawMedia.source_user_id_str,
      user: originUser,
    }),
    details: toOptionalObject({
      title: rawMedia.additional_media_info?.title,
      description: rawMedia.additional_media_info?.description,
      siteUrl: rawMedia.additional_media_info?.call_to_actions?.visit_site?.url,
      isEmbeddable: rawMedia.additional_media_info?.embeddable,
      isMonetizable: rawMedia.additional_media_info?.monetizable,
    }),
    availability: rawMedia.ext_media_availability?.status,
    video: normalizeVideo(rawMedia.video_info),
  };
}

function normalizePlace(place: raw.Place | undefined): normalized.TweetPlace | undefined {
  if (!place) return undefined;

  const boundaryPoints = place.bounding_box?.coordinates?.[0]?.map((point) => ({
    longitude: point[0],
    latitude: point[1],
  }));

  return toOptionalObject({
    id: place.id,
    name: place.name,
    fullName: place.full_name,
    country: place.country,
    countryCode: place.country_code,
    kind: place.place_type,
    boundary: boundaryPoints && boundaryPoints.length > 0 ? { points: boundaryPoints } : undefined,
  });
}

function normalizeNote(noteTweet: raw.NoteTweet | undefined): normalized.TweetNote | undefined {
  const result = noteTweet?.note_tweet_results?.result;
  if (!result) return undefined;

  return {
    id: result.id,
    text: normalizeAnnotatedTextFromTweetEntities(
      result.text,
      {
        hashtags: result.entity_set?.hashtags,
        media: undefined,
        smarttags: undefined,
        symbols: undefined,
        timestamps: undefined,
        urls: result.entity_set?.urls,
        user_mentions: result.entity_set?.user_mentions,
      },
      undefined,
      normalizeTextStyles(result.richtext),
    ),
  };
}

function normalizePermalink(
  permalink: raw.QuotedStatusPermalink | undefined,
): normalized.TweetPermalink | undefined {
  if (!permalink) return undefined;
  return {
    url: permalink.url,
    expandedUrl: permalink.expanded,
    displayText: permalink.display,
  };
}

function normalizeLimitedActions(
  limitedActionResults: raw.LimitedActionResults | undefined,
): normalized.TweetLimitedAction[] | undefined {
  const actions = (limitedActionResults?.limited_actions ?? []).map((action) => ({
    action: action.action,
    prompt: action.prompt
      ? toOptionalObject({
          kind: action.prompt.__typename,
          ctaType: action.prompt.cta_type,
          headline: normalizeAnnotatedTextFromTimelineText(action.prompt.headline),
          subtext: normalizeAnnotatedTextFromTimelineText(action.prompt.subtext),
        })
      : undefined,
  }));

  return actions.length > 0 ? actions : undefined;
}

function normalizeMediaInterstitial(
  interstitial: raw.MediaVisibilityInterstitial | undefined,
): normalized.TweetMediaInterstitial | undefined {
  if (!interstitial) return undefined;
  return toOptionalObject({
    title: normalizeAnnotatedTextFromTimelineText(interstitial.title),
    text: normalizeAnnotatedTextFromTimelineText(interstitial.text),
    opacity: interstitial.opacity,
  });
}

function normalizeCommunityNote(
  pivot: raw.BirdwatchPivot | undefined,
): normalized.TweetCommunityNote | undefined {
  if (!pivot) return undefined;
  return toOptionalObject({
    id: pivot.note?.rest_id,
    title: pivot.title,
    shortTitle: pivot.shorttitle,
    subtitle: normalizeAnnotatedTextFromTimelineText(pivot.subtitle),
    footer: normalizeAnnotatedTextFromTimelineText(pivot.footer),
    destinationUrl: pivot.destinationUrl,
    iconType: pivot.iconType,
    footerIconType: pivot.footerIconType,
    visualStyle: pivot.visualStyle,
  });
}

function normalizeEditInfo(editControl: raw.EditControl | undefined): normalized.TweetEditInfo | undefined {
  if (!editControl) return undefined;

  const base = 'edit_control_initial' in editControl
    ? editControl.edit_control_initial
    : editControl;

  return {
    versionIds: base.edit_tweet_ids,
    editableUntilMs: base.editable_until_msecs,
    remainingEdits: base.edits_remaining,
  };
}

function normalizeTweetPolicy(
  data: raw.TweetData,
  wrapper: raw.TweetWithVisibilityResults | undefined,
): normalized.TweetPolicy | undefined {
  return toOptionalObject({
    replyPolicy: data.legacy.conversation_control?.policy,
    followersOnly: data.legacy.scopes?.followers,
    isPossiblySensitive: data.legacy.possibly_sensitive,
    limitedActions: normalizeLimitedActions(wrapper?.limitedActionResults),
    mediaInterstitial: normalizeMediaInterstitial(wrapper?.mediaVisibilityResults?.blurred_image_interstitial),
    paidPromotion: data.content_disclosure?.advertising_disclosure?.is_paid_promotion,
  });
}

function normalizeTweetData(
  data: raw.TweetData,
  wrapper: raw.TweetWithVisibilityResults | undefined,
  stack: Set<string>,
): normalized.Tweet {
  const author = normalizeUser(data.core.user_results.result);
  const note = normalizeNote(data.note_tweet);
  const quotedTweet = data.quoted_status_result?.result
    ? normalizeParsedTweetResultInternal(data.quoted_status_result.result, stack)
    : null;
  const quotedTweetId = data.legacy.quoted_status_id_str
    ?? quotedTweet?.id
    ?? data.quotedRefResult?.result.rest_id;
  const repostTweet = data.legacy.retweeted_status_result?.result
    ? normalizeParsedTweetResultInternal(data.legacy.retweeted_status_result.result, stack)
    : null;

  return {
    id: data.rest_id,
    createdAt: data.legacy.created_at,
    source: stripHtmlSource(data.source),
    place: normalizePlace(data.legacy.place),
    author,
    content: {
      body: normalizeAnnotatedTextFromTweetEntities(
        data.legacy.full_text,
        data.legacy.entities,
        data.legacy.display_text_range,
      ),
      note,
      media: (data.legacy.extended_entities?.media ?? []).map((item) => normalizeMedia(item)),
      language: data.legacy.lang,
    },
    conversation: {
      conversationId: data.legacy.conversation_id_str,
      replyTo: data.legacy.in_reply_to_status_id_str
        ? toOptionalObject({
            tweetId: data.legacy.in_reply_to_status_id_str,
            userId: data.legacy.in_reply_to_user_id_str ?? undefined,
            userName: data.legacy.in_reply_to_screen_name ?? undefined,
          }) as normalized.TweetReplyTarget
        : undefined,
      quote: quotedTweetId
        ? {
            tweetId: quotedTweetId,
            permalink: normalizePermalink(data.legacy.quoted_status_permalink),
            tweet: quotedTweet ?? undefined,
          }
        : undefined,
      repost: repostTweet ?? undefined,
    },
    stats: {
      views: data.views?.count,
      replies: data.legacy.reply_count,
      reposts: data.legacy.retweet_count,
      quotes: data.legacy.quote_count,
      likes: data.legacy.favorite_count,
      bookmarks: data.legacy.bookmark_count,
    },
    edit: normalizeEditInfo(data.edit_control),
    policy: normalizeTweetPolicy(data, wrapper),
    communityNote: normalizeCommunityNote(data.birdwatch_pivot),
  };
}

function normalizeParsedTweetResultInternal(
  result: raw.TweetResult,
  stack: Set<string>,
): normalized.Tweet | null {
  if (result.__typename === 'TweetTombstone') {
    return null;
  }

  const wrapper = result.__typename === 'TweetWithVisibilityResults' ? result : undefined;
  const data = result.__typename === 'TweetWithVisibilityResults' ? result.tweet : result;

  if (stack.has(data.rest_id)) {
    return null;
  }

  stack.add(data.rest_id);
  try {
    return TweetSchema.parse(normalizeTweetData(data, wrapper, stack));
  } finally {
    stack.delete(data.rest_id);
  }
}

export function normalizeParsedTweetResult(result: raw.TweetResult): normalized.Tweet | null {
  return normalizeParsedTweetResultInternal(result, new Set<string>());
}

export function parseAndNormalizeTweetResult(input: unknown): normalized.Tweet | null {
  return normalizeParsedTweetResult(parseRawTweetResult(input));
}
