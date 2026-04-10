import { TweetSchema, TweetUserSchema } from '../schema/tweet-schema';
import type * as normalized from '../schema/tweet-schema';

type JsonObject = Record<string, unknown>;

export interface ParsedTweetResult {
  tweet: normalized.Tweet | null;
  warnings: string[];
}

export interface ParsedUserResult {
  user: normalized.TweetUser | null;
  warnings: string[];
}

function isPlainObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject | undefined {
  return isPlainObject(value) ? value : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asStringLike(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function readPath(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;

  for (const segment of path) {
    const currentObject = asObject(current);
    if (!currentObject) return undefined;
    current = currentObject[segment];
  }

  return current;
}

function readStringArray(value: unknown): string[] {
  return asArray(value).map((item) => asString(item)).filter(Boolean) as string[];
}

function readNumberArray(value: unknown): number[] {
  return asArray(value).map((item) => asNumber(item)).filter((item): item is number => item !== undefined);
}

function readActiveStringFlags(value: unknown): string[] {
  const object = asObject(value);
  if (!object) return [];

  return [...new Set(
    Object.entries(object)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key),
  )].sort();
}

function createTextEntities(): normalized.TextEntities {
  return {
    hashtags: [],
    symbols: [],
    urls: [],
    mentions: [],
    media: [],
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

function normalizeIsoDateTime(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let timestamp = Number.NaN;
  if (/^-?\d+$/.test(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numeric)) {
      timestamp = trimmed.length <= 10 ? numeric * 1000 : numeric;
    }
  } else {
    timestamp = Date.parse(trimmed);
  }

  if (!Number.isFinite(timestamp)) return undefined;

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function appendWarning(warnings: string[], path: string, message: string): void {
  warnings.push(`${path}: ${message}`);
}

function formatErrorMessage(error: unknown): string {
  const issues = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> })?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    const first = issues[0];
    const issuePath = Array.isArray(first.path) && first.path.length > 0
      ? ` (${first.path.join('.')})`
      : '';
    return `${first.message ?? 'validation failed'}${issuePath}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeResolvedUrls(urlsInput: unknown): normalized.ResolvedUrl[] {
  return asArray(urlsInput)
    .map((item) => {
      const object = asObject(item);
      const url = asString(object?.url);
      const expandedUrl = asString(object?.expanded_url);
      const displayText = asString(object?.display_url);
      if (!url || !expandedUrl || !displayText) return null;

      return {
        url,
        expandedUrl,
        displayText,
      };
    })
    .filter(Boolean) as normalized.ResolvedUrl[];
}

function normalizeTweetHashtags(hashtagsInput: unknown): normalized.HashtagEntity[] {
  return asArray(hashtagsInput)
    .map((item) => {
      const object = asObject(item);
      const text = asString(object?.text);
      const range = toTextRange(readNumberArray(object?.indices));
      if (!text || !range) return null;

      return {
        text,
        range,
      };
    })
    .filter(Boolean) as normalized.HashtagEntity[];
}

function normalizeTweetSymbols(symbolsInput: unknown): normalized.SymbolEntity[] {
  return asArray(symbolsInput).map((item) => {
    const object = asObject(item);
    return {
      text: asString(object?.text) ?? '',
      range: toTextRange(readNumberArray(object?.indices)),
      ticker: asString(readPath(object, 'tag', 'info', 'info', 'ticker')),
      name: asString(readPath(object, 'tag', 'info', 'info', 'name')),
    };
  });
}

function normalizeTweetUrls(urlsInput: unknown): normalized.UrlEntity[] {
  return asArray(urlsInput)
    .map((item) => {
      const object = asObject(item);
      const url = asString(object?.url);
      const expandedUrl = asString(object?.expanded_url);
      const displayText = asString(object?.display_url);
      const range = toTextRange(readNumberArray(object?.indices));

      if (!url || !expandedUrl || !displayText || !range) return null;
      return {
        url,
        expandedUrl,
        displayText,
        range,
      };
    })
    .filter(Boolean) as normalized.UrlEntity[];
}

function normalizeTweetMentions(mentionsInput: unknown): normalized.MentionEntity[] {
  return asArray(mentionsInput)
    .map((item) => {
      const object = asObject(item);
      const userId = asString(object?.id_str);
      const name = asString(object?.name);
      const userName = asString(object?.screen_name);
      const range = toTextRange(readNumberArray(object?.indices));

      if (!userId || !name || !userName || !range) return null;
      return {
        userId,
        name,
        userName,
        range,
      };
    })
    .filter(Boolean) as normalized.MentionEntity[];
}

function normalizeMediaEntityOrigin(rawMedia: JsonObject): normalized.MediaEntityOrigin | undefined {
  return toOptionalObject({
    tweetId: asString(rawMedia.source_status_id_str),
    userId: asString(rawMedia.source_user_id_str),
  });
}

function normalizeMediaOrigin(
  rawMedia: JsonObject,
  warnings: string[],
  path: string,
): normalized.TweetMediaOrigin | undefined {
  const originUserRaw = readPath(rawMedia, 'additional_media_info', 'source_user', 'user_results', 'result');
  const originUser = originUserRaw
    ? normalizeUser(originUserRaw, warnings, `${path}.additional_media_info.source_user.user_results.result`)
    : null;

  return toOptionalObject({
    tweetId: asString(rawMedia.source_status_id_str),
    userId: asString(rawMedia.source_user_id_str),
    user: originUser ?? undefined,
  });
}

function normalizeTweetMediaEntities(
  mediaInput: unknown,
  fallbackMediaInput?: unknown,
): normalized.MediaEntity[] {
  const mediaObjects = asArray(mediaInput).length > 0 ? asArray(mediaInput) : asArray(fallbackMediaInput);

  return mediaObjects
    .map((item) => {
      const object = asObject(item);
      const mediaId = asString(object?.id_str);
      if (!object || !mediaId) return null;

      return {
        mediaId,
        range: toTextRange(readNumberArray(object.indices)),
        displayText: asString(object.display_url),
        expandedUrl: asString(object.expanded_url),
        url: asString(object.url),
        origin: normalizeMediaEntityOrigin(object),
      };
    })
    .filter(Boolean) as normalized.MediaEntity[];
}

function normalizeAnnotatedTextFromTweetEntities(
  text: string,
  entitiesInput: unknown,
  displayRangeInput?: unknown,
  styles?: normalized.TextStyleRange[] | undefined,
  fallbackMediaInput?: unknown,
): normalized.AnnotatedText {
  return {
    text,
    displayRange: toTextRange(readNumberArray(displayRangeInput)),
    entities: {
      hashtags: normalizeTweetHashtags(readPath(entitiesInput, 'hashtags')),
      symbols: normalizeTweetSymbols(readPath(entitiesInput, 'symbols')),
      urls: normalizeTweetUrls(readPath(entitiesInput, 'urls')),
      mentions: normalizeTweetMentions(readPath(entitiesInput, 'user_mentions')),
      media: normalizeTweetMediaEntities(readPath(entitiesInput, 'media'), fallbackMediaInput),
    },
    styles,
  };
}

function normalizeAnnotatedTextFromSimpleUrls(
  text: string,
  urlsInput: unknown,
): normalized.AnnotatedText {
  return {
    text,
    entities: {
      hashtags: [],
      symbols: [],
      urls: normalizeTweetUrls(urlsInput),
      mentions: [],
      media: [],
    },
  };
}

function normalizeAnnotatedTextFromTimelineText(
  valueInput: unknown,
): normalized.AnnotatedText | undefined {
  const value = asObject(valueInput);
  const text = asString(value?.text);
  if (!value || text === undefined) return undefined;

  const entities = createTextEntities();
  for (const entityInput of asArray(value.entities)) {
    const entity = asObject(entityInput);
    const range = toTextRange([
      asNumber(entity?.fromIndex) ?? Number.NaN,
      asNumber(entity?.toIndex) ?? Number.NaN,
    ]);
    const ref = asObject(entity?.ref);

    if (!range || !ref) continue;

    const mentionResult = asObject(readPath(ref, 'mention_results', 'result'));
    const mentionUserId = asString(mentionResult?.rest_id);
    if (mentionUserId) {
      const userName = asString(ref.screen_name) ?? asString(readPath(mentionResult, 'core', 'screen_name')) ?? '';
      entities.mentions.push({
        userId: mentionUserId,
        name: userName,
        userName,
        range,
      });
      continue;
    }

    const url = asString(ref.url);
    if (url) {
      entities.urls.push({
        url,
        expandedUrl: url,
        displayText: url,
        range,
      });
    }
  }

  return {
    text,
    entities,
  };
}

function extractTwitterHandleFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host !== 'twitter.com'
      && host !== 'www.twitter.com'
      && host !== 'mobile.twitter.com'
      && host !== 'x.com'
      && host !== 'www.x.com'
    ) {
      return undefined;
    }

    const handle = parsed.pathname
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)[0];
    if (!handle) return undefined;
    return handle.startsWith('@') ? handle.slice(1) : handle;
  } catch {
    return undefined;
  }
}

function normalizeUserDisclosure(rawUser: JsonObject): normalized.TweetUserDisclosure | undefined {
  const label = asObject(readPath(rawUser, 'affiliates_highlighted_label', 'label'));
  if (!label) return undefined;

  const subjectUrl = asString(readPath(label, 'url', 'url'));
  const subjectHandleFromUrl = extractTwitterHandleFromUrl(subjectUrl);

  if (asString(label.userLabelType) === 'BusinessLabel') {
    const subject = toOptionalObject({
      subjectHandle: subjectHandleFromUrl,
      subjectName: asString(label.description),
      subjectUrl,
    });
    return subject
      ? { relation: 'affiliated_with', ...subject }
      : { relation: 'affiliated_with' };
  }

  if (asString(label.userLabelType) === 'AutomatedLabel') {
    const mention = asArray(readPath(label, 'longDescription', 'entities'))
      .map((item) => asObject(item))
      .find((entity) => {
        const mentionResult = asObject(readPath(entity, 'ref', 'mention_results', 'result'));
        return Boolean(
          asString(readPath(entity, 'ref', 'screen_name'))
          || asString(readPath(mentionResult, 'core', 'screen_name'))
          || asString(mentionResult?.rest_id),
        );
      });

    const subject = toOptionalObject({
      subjectId: asString(readPath(mention, 'ref', 'mention_results', 'result', 'rest_id')),
      subjectHandle: asString(readPath(mention, 'ref', 'screen_name'))
        ?? asString(readPath(mention, 'ref', 'mention_results', 'result', 'core', 'screen_name')),
    });
    return subject
      ? { relation: 'operated_by', ...subject }
      : { relation: 'operated_by' };
  }

  const subject = toOptionalObject({
    subjectHandle: subjectHandleFromUrl,
    subjectName: asString(label.description),
    subjectUrl,
  });
  return subject
    ? { relation: 'unknown', ...subject }
    : { relation: 'unknown' };
}

function normalizeTextStyles(
  richtextInput: unknown,
): normalized.TextStyleRange[] | undefined {
  const styles = asArray(readPath(richtextInput, 'richtext_tags'))
    .map((item) => {
      const object = asObject(item);
      const range = toTextRange([
        asNumber(object?.from_index) ?? Number.NaN,
        asNumber(object?.to_index) ?? Number.NaN,
      ]);
      const styleNames = readStringArray(object?.richtext_types);
      if (!range || styleNames.length === 0) return null;

      return {
        range,
        styles: styleNames,
      };
    })
    .filter(Boolean) as normalized.TextStyleRange[];

  return styles.length > 0 ? styles : undefined;
}

function normalizeMediaType(
  value: unknown,
  warnings: string[],
  path: string,
): normalized.TweetMedia['type'] | null {
  if (value === 'photo' || value === 'video' || value === 'animated_gif') {
    return value;
  }

  appendWarning(warnings, path, `unsupported media type: ${String(value)}`);
  return null;
}

function normalizeMediaRect(
  valueInput: unknown,
): normalized.MediaRect | undefined {
  const value = asObject(valueInput);
  const x = asNumber(value?.x);
  const y = asNumber(value?.y);
  const w = asNumber(value?.w);
  const h = asNumber(value?.h);

  if (x === undefined || y === undefined || w === undefined || h === undefined) return undefined;
  if (x < 0 || y < 0 || w <= 0 || h <= 0) return undefined;

  return {
    x,
    y,
    width: w,
    height: h,
  };
}

function normalizeMediaRects(
  valuesInput: unknown,
): normalized.MediaRect[] | undefined {
  const rects = asArray(valuesInput)
    .map((item) => normalizeMediaRect(item))
    .filter(Boolean) as normalized.MediaRect[];

  return rects.length > 0 ? rects : undefined;
}

function normalizeMediaFaces(featuresInput: unknown): normalized.TweetMediaFaces | undefined {
  const features = asObject(featuresInput);
  if (!features) return undefined;

  return toOptionalObject({
    large: normalizeMediaRects(readPath(features, 'large', 'faces')),
    medium: normalizeMediaRects(readPath(features, 'medium', 'faces')),
    small: normalizeMediaRects(readPath(features, 'small', 'faces')),
    thumb: normalizeMediaRects(readPath(features, 'small', 'faces')),
    original: normalizeMediaRects(readPath(features, 'orig', 'faces')),
  });
}

function normalizeMediaVariants(sizesInput: unknown): normalized.MediaVariants | undefined {
  const normalizeVariant = (valueInput: unknown): normalized.MediaVariant | undefined => {
    const value = asObject(valueInput);
    const width = asNumber(value?.w);
    const height = asNumber(value?.h);
    const resizeMode = asString(value?.resize);

    if (width === undefined || height === undefined || !resizeMode) return undefined;
    if (width <= 0 || height <= 0) return undefined;

    return {
      width,
      height,
      resizeMode,
    };
  };

  return toOptionalObject({
    large: normalizeVariant(readPath(sizesInput, 'large')),
    medium: normalizeVariant(readPath(sizesInput, 'medium')),
    small: normalizeVariant(readPath(sizesInput, 'small')),
    thumb: normalizeVariant(readPath(sizesInput, 'thumb')),
  });
}

function normalizeMediaGeometry(infoInput: unknown): normalized.TweetMediaGeometry | undefined {
  const info = asObject(infoInput);
  const width = asNumber(info?.width);
  const height = asNumber(info?.height);
  if (!info || width === undefined || height === undefined) return undefined;
  if (width <= 0 || height <= 0) return undefined;

  return {
    width,
    height,
    focusRects: asArray(info.focus_rects)
      .map((item) => normalizeMediaRect(item))
      .filter(Boolean) as normalized.MediaRect[],
  };
}

function normalizeVideo(videoInfoInput: unknown): normalized.TweetVideo | undefined {
  const videoInfo = asObject(videoInfoInput);
  if (!videoInfo) return undefined;

  const aspectRatioInput = readNumberArray(videoInfo.aspect_ratio);
  const aspectRatio = aspectRatioInput.length >= 2 ? aspectRatioInput.slice(0, 2) : undefined;

  return {
    aspectRatio: aspectRatio && aspectRatio[0] > 0 && aspectRatio[1] > 0
      ? [aspectRatio[0], aspectRatio[1]]
      : undefined,
    durationMs: asNumber(videoInfo.duration_millis),
    variants: asArray(videoInfo.variants)
      .map((variantInput) => {
        const variant = asObject(variantInput);
        const contentType = asString(variant?.content_type);
        const url = asString(variant?.url);
        if (!contentType || !url) return null;

        return {
          contentType,
          bitrate: asNumber(variant?.bitrate),
          url,
        };
      })
      .filter(Boolean) as normalized.TweetVideoVariant[],
  };
}

function normalizeUser(
  rawUserInput: unknown,
  warnings: string[],
  path: string,
): normalized.TweetUser | null {
  const rawUserRoot = asObject(rawUserInput);
  const rawUser = asObject(rawUserRoot?.result) ?? rawUserRoot;
  if (!rawUser) {
    appendWarning(warnings, path, 'expected user object');
    return null;
  }

  const id = asString(rawUser.rest_id) ?? asString(rawUser.id);
  if (!id) {
    appendWarning(warnings, path, 'missing user id');
    return null;
  }

  const description = asString(readPath(rawUser, 'legacy', 'description'))
    ?? asString(readPath(rawUser, 'profile_bio', 'description'))
    ?? '';

  const candidate: normalized.TweetUser = {
    id,
    createdAt: normalizeIsoDateTime(asStringLike(readPath(rawUser, 'core', 'created_at'))),
    profile: {
      displayName: asString(readPath(rawUser, 'core', 'name')) ?? '',
      userName: asString(readPath(rawUser, 'core', 'screen_name')) ?? '',
      avatarUrl: asString(readPath(rawUser, 'avatar', 'image_url')),
      usesDefaultAvatar: asBoolean(readPath(rawUser, 'legacy', 'default_profile_image')),
      avatarShape: asString(rawUser.profile_image_shape),
      bannerUrl: asString(readPath(rawUser, 'legacy', 'profile_banner_url')),
      location: asString(readPath(rawUser, 'location', 'location')),
      bio: description
        ? normalizeAnnotatedTextFromSimpleUrls(
            description,
            readPath(rawUser, 'legacy', 'entities', 'description', 'urls'),
          )
        : undefined,
      profileLinks: normalizeResolvedUrls(readPath(rawUser, 'legacy', 'entities', 'url', 'urls')),
    },
    pinnedTweetIds: readStringArray(readPath(rawUser, 'legacy', 'pinned_tweet_ids_str')),
    identity: toOptionalObject({
      verification: toOptionalObject({
        isBlueVerified: asBoolean(rawUser.is_blue_verified),
        type: asString(readPath(rawUser, 'verification', 'verified_type')),
      }),
      disclosure: normalizeUserDisclosure(rawUser),
      parodyLabel: asString(rawUser.parody_commentary_fan_label),
      hasCompletedNewAccountReview: asBoolean(rawUser.has_graduated_access),
      isPossiblySensitive: asBoolean(readPath(rawUser, 'legacy', 'possibly_sensitive')),
    }),
    professional: asObject(rawUser.professional)
      ? {
          id: asString(readPath(rawUser, 'professional', 'rest_id')),
          type: asString(readPath(rawUser, 'professional', 'professional_type')),
          categories: asArray(readPath(rawUser, 'professional', 'category'))
            .map((categoryInput) => {
              const category = asObject(categoryInput);
              const categoryId = asStringLike(category?.id);
              const categoryName = asString(category?.name);
              if (!categoryId || !categoryName) return null;

              return {
                id: categoryId,
                name: categoryName,
              };
            })
            .filter(Boolean) as normalized.TweetUserCategory[],
        }
      : undefined,
    stats: toOptionalObject({
      followers: asNumber(readPath(rawUser, 'legacy', 'followers_count')),
      following: asNumber(readPath(rawUser, 'legacy', 'friends_count')),
      likes: asNumber(readPath(rawUser, 'legacy', 'favourites_count')),
      mediaPosts: asNumber(readPath(rawUser, 'legacy', 'media_count')),
      tweets: asNumber(readPath(rawUser, 'legacy', 'statuses_count')),
      listed: asNumber(readPath(rawUser, 'legacy', 'listed_count')),
    }),
    features: toOptionalObject({
      canDm: asBoolean(readPath(rawUser, 'dm_permissions', 'can_dm')),
      canTagMedia: asBoolean(readPath(rawUser, 'media_permissions', 'can_media_tag')),
      isProtected: asBoolean(readPath(rawUser, 'privacy', 'protected')),
      canBeSubscribed: asBoolean(rawUser.super_follow_eligible),
    }),
  };

  try {
    return TweetUserSchema.parse(candidate);
  } catch (error) {
    appendWarning(warnings, path, `user normalization failed: ${formatErrorMessage(error)}`);
    return null;
  }
}

function normalizeMedia(
  rawMediaInput: unknown,
  warnings: string[],
  path: string,
): normalized.TweetMedia | null {
  const rawMedia = asObject(rawMediaInput);
  if (!rawMedia) {
    appendWarning(warnings, path, 'expected media object');
    return null;
  }

  const id = asString(rawMedia.id_str);
  if (!id) {
    appendWarning(warnings, path, 'missing media id');
    return null;
  }

  const type = normalizeMediaType(rawMedia.type, warnings, `${path}.type`);
  if (!type) return null;

  return {
    id,
    type,
    mediaUrl: asString(rawMedia.media_url_https),
    altText: asString(rawMedia.ext_alt_text),
    grokPostId: asString(rawMedia.grok_post_id),
    geometry: normalizeMediaGeometry(rawMedia.original_info),
    variants: normalizeMediaVariants(rawMedia.sizes),
    taggedUsers: asArray(readPath(rawMedia, 'features', 'all', 'tags')).map((tagInput) => {
      const tag = asObject(tagInput);
      return {
        userId: asString(tag?.user_id),
        name: asString(tag?.name),
        userName: asString(tag?.screen_name),
        kind: asString(tag?.type),
      };
    }),
    faces: normalizeMediaFaces(rawMedia.features),
    origin: normalizeMediaOrigin(rawMedia, warnings, path),
    details: toOptionalObject({
      title: asString(readPath(rawMedia, 'additional_media_info', 'title')),
      description: asString(readPath(rawMedia, 'additional_media_info', 'description')),
      siteUrl: asString(readPath(rawMedia, 'additional_media_info', 'call_to_actions', 'visit_site', 'url')),
      isEmbeddable: asBoolean(readPath(rawMedia, 'additional_media_info', 'embeddable')),
      isMonetizable: asBoolean(readPath(rawMedia, 'additional_media_info', 'monetizable')),
    }),
    sensitivityWarnings: (() => {
      const values = readActiveStringFlags(rawMedia.sensitive_media_warning);
      return values.length > 0 ? values : undefined;
    })(),
    availability: asString(readPath(rawMedia, 'ext_media_availability', 'status')),
    video: normalizeVideo(rawMedia.video_info),
  };
}

function normalizePlace(placeInput: unknown): normalized.TweetPlace | undefined {
  const place = asObject(placeInput);
  if (!place) return undefined;

  const boundaryPoints = asArray(readPath(place, 'bounding_box', 'coordinates'))
    .flatMap((ring) => (Array.isArray(ring) ? [ring] : []))[0];

  const boundary = Array.isArray(boundaryPoints)
    ? boundaryPoints
        .map((point) => {
          if (!Array.isArray(point) || point.length < 2) return null;
          const longitude = asNumber(point[0]);
          const latitude = asNumber(point[1]);
          if (longitude === undefined || latitude === undefined) return null;
          return { longitude, latitude };
        })
        .filter(Boolean) as normalized.TweetPlaceBoundary
    : undefined;

  return toOptionalObject({
    id: asString(place.id),
    name: asString(place.name),
    fullName: asString(place.full_name),
    country: asString(place.country),
    countryCode: asString(place.country_code),
    kind: asString(place.place_type),
    boundary: boundary && boundary.length > 0 ? boundary : undefined,
  });
}

function normalizeNote(noteTweetInput: unknown): normalized.TweetNote | undefined {
  const result = asObject(readPath(noteTweetInput, 'note_tweet_results', 'result'));
  const text = asString(result?.text);
  if (!result || text === undefined) return undefined;

  return {
    id: asString(result.id),
    text: normalizeAnnotatedTextFromTweetEntities(
      text,
      {
        hashtags: readPath(result, 'entity_set', 'hashtags'),
        urls: readPath(result, 'entity_set', 'urls'),
        user_mentions: readPath(result, 'entity_set', 'user_mentions'),
      },
      undefined,
      normalizeTextStyles(readPath(result, 'richtext')),
    ),
  };
}

function normalizePermalink(
  permalinkInput: unknown,
): normalized.TweetPermalink | undefined {
  const permalink = asObject(permalinkInput);
  const url = asString(permalink?.url);
  const expandedUrl = asString(permalink?.expanded);
  const displayText = asString(permalink?.display);
  if (!url || !expandedUrl || !displayText) return undefined;

  return {
    url,
    expandedUrl,
    displayText,
  };
}

function normalizeAvailableActions(
  limitedActionResultsInput: unknown,
): normalized.TweetActionCode[] | undefined {
  const actions = asArray(readPath(limitedActionResultsInput, 'limited_actions'))
    .map((actionInput) => asString(readPath(actionInput, 'action')))
    .filter(Boolean) as normalized.TweetActionCode[];

  return actions.length > 0 ? actions : undefined;
}

function normalizeCommunityNote(
  pivotInput: unknown,
): normalized.TweetCommunityNote | undefined {
  const pivot = asObject(pivotInput);
  if (!pivot) return undefined;

  return toOptionalObject({
    id: asString(readPath(pivot, 'note', 'rest_id')),
    title: asString(pivot.title),
    shortTitle: asString(pivot.shorttitle),
    subtitle: normalizeAnnotatedTextFromTimelineText(pivot.subtitle),
    footer: normalizeAnnotatedTextFromTimelineText(pivot.footer),
    destinationUrl: asString(pivot.destinationUrl),
  });
}

function normalizeEditInfo(editControlInput: unknown): normalized.TweetEditInfo | undefined {
  const editControl = asObject(editControlInput);
  if (!editControl) return undefined;

  const base = asObject(editControl.edit_control_initial) ?? editControl;

  return {
    versionIds: readStringArray(base.edit_tweet_ids),
    editableUntilAt: normalizeIsoDateTime(asStringLike(base.editable_until_msecs)),
    remainingEdits: asStringLike(base.edits_remaining),
  };
}

function normalizeTweetPolicy(
  data: JsonObject,
  wrapper: JsonObject | undefined,
): normalized.TweetPolicy | undefined {
  return toOptionalObject({
    replyPolicy: asString(readPath(data, 'legacy', 'conversation_control', 'policy')),
    followersOnly: asBoolean(readPath(data, 'legacy', 'scopes', 'followers')),
    isPossiblySensitive: asBoolean(readPath(data, 'legacy', 'possibly_sensitive')),
    availableActions: normalizeAvailableActions(readPath(wrapper, 'limitedActionResults')),
    isMediaVisibilityRestricted: asObject(readPath(wrapper, 'mediaVisibilityResults', 'blurred_image_interstitial')) ? true : undefined,
    paidPromotion: asBoolean(readPath(data, 'content_disclosure', 'advertising_disclosure', 'is_paid_promotion')),
  });
}

function classifyTweetResultNode(node: JsonObject): 'tweet' | 'wrapper' | 'tombstone' | null {
  const typename = asString(node.__typename);

  if (typename === 'TweetTombstone' || asObject(node.tombstone)) {
    return 'tombstone';
  }

  if (
    typename === 'TweetWithVisibilityResults'
    || (asObject(node.tweet) && !asString(node.rest_id) && !asObject(node.legacy))
  ) {
    return 'wrapper';
  }

  if (
    typename === 'Tweet'
    || asString(node.rest_id)
    || asString(readPath(node, 'legacy', 'id_str'))
    || asObject(node.legacy)
  ) {
    return 'tweet';
  }

  return null;
}

function extractTweetIdFromResultInput(input: unknown): string | undefined {
  const node = asObject(input);
  if (!node) return undefined;

  const kind = classifyTweetResultNode(node);
  if (kind === 'tombstone') return undefined;

  const data = kind === 'wrapper' ? asObject(node.tweet) : node;
  return asString(data?.rest_id) ?? asString(readPath(data, 'legacy', 'id_str'));
}

function normalizeTweetData(
  dataInput: unknown,
  wrapperInput: unknown,
  stack: Set<string>,
  warnings: string[],
  path: string,
): normalized.Tweet | null {
  const data = asObject(dataInput);
  const wrapper = asObject(wrapperInput);
  if (!data) {
    appendWarning(warnings, path, 'expected tweet data object');
    return null;
  }

  const tweetId = asString(data.rest_id) ?? asString(readPath(data, 'legacy', 'id_str'));
  if (!tweetId) {
    appendWarning(warnings, path, 'missing tweet id');
    return null;
  }

  const author = normalizeUser(readPath(data, 'core', 'user_results', 'result'), warnings, `${path}.core.user_results.result`);
  if (!author) {
    appendWarning(warnings, path, 'missing valid author');
    return null;
  }

  const createdAt = normalizeIsoDateTime(asStringLike(readPath(data, 'legacy', 'created_at')));
  if (!createdAt) {
    appendWarning(warnings, `${path}.legacy.created_at`, 'unable to normalize created_at');
    return null;
  }

  const conversationId = asString(readPath(data, 'legacy', 'conversation_id_str'));
  if (!conversationId) {
    appendWarning(warnings, `${path}.legacy.conversation_id_str`, 'missing conversation id');
    return null;
  }

  const note = normalizeNote(data.note_tweet);
  const legacyFullText = asString(readPath(data, 'legacy', 'full_text')) ?? '';
  if (!legacyFullText && !note?.text.text) {
    appendWarning(warnings, path, 'missing both legacy full_text and note text');
    return null;
  }

  const contentMediaInputs: Array<{ value: unknown; path: string }> = [];
  const seenMediaIds = new Set<string>();

  for (const [index, item] of asArray(readPath(data, 'legacy', 'extended_entities', 'media')).entries()) {
    const mediaId = asString(readPath(item, 'id_str'));
    if (mediaId) {
      seenMediaIds.add(mediaId);
    }
    contentMediaInputs.push({
      value: item,
      path: `${path}.legacy.extended_entities.media[${index}]`,
    });
  }

  for (const [index, item] of asArray(readPath(data, 'legacy', 'entities', 'media')).entries()) {
    const mediaId = asString(readPath(item, 'id_str'));
    if (mediaId && seenMediaIds.has(mediaId)) {
      continue;
    }
    if (mediaId) {
      seenMediaIds.add(mediaId);
    }
    contentMediaInputs.push({
      value: item,
      path: `${path}.legacy.entities.media[${index}]`,
    });
  }

  const media = contentMediaInputs
    .map((item) => normalizeMedia(item.value, warnings, item.path))
    .filter(Boolean) as normalized.TweetMedia[];

  const quotedResultInput = readPath(data, 'quoted_status_result', 'result');
  const quotedTweet = quotedResultInput === undefined
    ? null
    : normalizeParsedTweetResultInternal(
        quotedResultInput,
        stack,
        warnings,
        `${path}.quoted_status_result.result`,
      );

  const repostResultInput = readPath(data, 'legacy', 'retweeted_status_result', 'result');
  const repostTweet = repostResultInput === undefined
    ? null
    : normalizeParsedTweetResultInternal(
        repostResultInput,
        stack,
        warnings,
        `${path}.legacy.retweeted_status_result.result`,
      );

  const quotedTweetId = asString(readPath(data, 'legacy', 'quoted_status_id_str'))
    ?? quotedTweet?.id
    ?? extractTweetIdFromResultInput(quotedResultInput)
    ?? asString(readPath(data, 'quotedRefResult', 'result', 'rest_id'));

  const candidate: normalized.Tweet = {
    id: tweetId,
    createdAt,
    source: stripHtmlSource(asString(data.source)),
    place: normalizePlace(readPath(data, 'legacy', 'place')),
    author,
    content: {
      legacyText: normalizeAnnotatedTextFromTweetEntities(
        legacyFullText,
        readPath(data, 'legacy', 'entities'),
        readPath(data, 'legacy', 'display_text_range'),
        undefined,
        readPath(data, 'legacy', 'extended_entities', 'media'),
      ),
      note,
      media,
      language: asString(readPath(data, 'legacy', 'lang')),
    },
    conversation: {
      conversationId,
      replyTo: asString(readPath(data, 'legacy', 'in_reply_to_status_id_str'))
        ? {
            tweetId: asString(readPath(data, 'legacy', 'in_reply_to_status_id_str')) as string,
            userId: asString(readPath(data, 'legacy', 'in_reply_to_user_id_str')),
            userName: asString(readPath(data, 'legacy', 'in_reply_to_screen_name')),
          }
        : undefined,
      quote: quotedTweetId
        ? {
            tweetId: quotedTweetId,
            permalink: normalizePermalink(readPath(data, 'legacy', 'quoted_status_permalink')),
            tweet: quotedTweet ?? undefined,
          }
        : undefined,
      repost: repostTweet ?? undefined,
    },
    stats: {
      views: asStringLike(readPath(data, 'views', 'count')),
      replies: asNumber(readPath(data, 'legacy', 'reply_count')),
      reposts: asNumber(readPath(data, 'legacy', 'retweet_count')),
      quotes: asNumber(readPath(data, 'legacy', 'quote_count')),
      likes: asNumber(readPath(data, 'legacy', 'favorite_count')),
      bookmarks: asNumber(readPath(data, 'legacy', 'bookmark_count')),
    },
    edit: normalizeEditInfo(readPath(data, 'edit_control')),
    policy: normalizeTweetPolicy(data, wrapper),
    communityNote: normalizeCommunityNote(readPath(data, 'birdwatch_pivot')),
  };

  try {
    return TweetSchema.parse(candidate);
  } catch (error) {
    appendWarning(warnings, path, `tweet normalization failed: ${formatErrorMessage(error)}`);
    return null;
  }
}

function normalizeParsedTweetResultInternal(
  input: unknown,
  stack: Set<string>,
  warnings: string[],
  path: string,
): normalized.Tweet | null {
  const node = asObject(input);
  if (!node) {
    appendWarning(warnings, path, 'expected tweet result object');
    return null;
  }

  const kind = classifyTweetResultNode(node);
  if (!kind) {
    appendWarning(warnings, path, 'unrecognized tweet result shape');
    return null;
  }

  if (kind === 'tombstone') {
    return null;
  }

  const data = kind === 'wrapper' ? asObject(node.tweet) : node;
  const tweetId = asString(data?.rest_id) ?? asString(readPath(data, 'legacy', 'id_str'));

  if (!tweetId) {
    appendWarning(warnings, path, 'missing tweet id');
    return null;
  }

  if (stack.has(tweetId)) {
    return null;
  }

  stack.add(tweetId);
  try {
    return normalizeTweetData(data, kind === 'wrapper' ? node : undefined, stack, warnings, path);
  } finally {
    stack.delete(tweetId);
  }
}

export function parseAndNormalizeUserResult(
  input: unknown,
  rootPath = 'user',
): ParsedUserResult {
  const warnings: string[] = [];
  const user = normalizeUser(input, warnings, rootPath);
  return { user, warnings };
}

export function parseAndNormalizeTweetResult(
  input: unknown,
  rootPath = 'tweet_results.result',
): ParsedTweetResult {
  const warnings: string[] = [];
  const tweet = normalizeParsedTweetResultInternal(input, new Set<string>(), warnings, rootPath);
  return { tweet, warnings };
}
