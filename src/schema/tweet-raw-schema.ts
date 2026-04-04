import { z } from 'zod';

/**
 * 统一的帖子原始数据模型。
 *
 * 设计原则：
 * 1. 将 `TweetWithVisibilityResults` 预处理为最终 `Tweet` 对象，避免调用方在解析前手动分支。
 * 2. 对核心且稳定的字段做显式建模，对实验性或高频变动字段保留 `passthrough()` 兼容。
 * 3. 对 quoted / retweeted 等帖子递归引用继续使用同一套归一化模型。
 */

function looseObject<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).passthrough();
}

/**
 * 将 GraphQL `tweet_results.result` 统一整理为“最终帖子对象”。
 *
 * 当前抓包中主要存在两种形态：
 * - `Tweet`
 * - `TweetWithVisibilityResults`
 *
 * 对于包装形态，会把包装层的附加字段（如 `limitedActionResults`）并入帖子对象本身。
 */
export function normalizeTweetResultInput(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }

  const value = input as Record<string, unknown>;
  if (value.__typename !== 'TweetWithVisibilityResults') {
    return input;
  }

  const tweet = value.tweet;
  if (!tweet || typeof tweet !== 'object' || Array.isArray(tweet)) {
    return input;
  }

  const { tweet: _tweet, __typename: _typename, ...wrapperRest } = value;

  return {
    ...wrapperRest,
    ...tweet,
    limitedActionResults: wrapperRest.limitedActionResults ?? (tweet as Record<string, unknown>).limitedActionResults,
  };
}

/** 通用的宽松 GraphQL 节点，用于承接少量未完全覆盖的结果类型。 */
export const UnknownGraphqlNodeSchema = looseObject({
  __typename: z.string().optional(),
});
export type UnknownGraphqlNode = z.infer<typeof UnknownGraphqlNodeSchema>;

/** 富文本中的 URL / 深链引用。 */
export const TimelineRefSchema = looseObject({
  type: z.string(),
  url: z.string().optional(),
  urlType: z.string().optional(),
});
export type TimelineRef = z.infer<typeof TimelineRefSchema>;

/** 富文本中的实体区间。 */
export const TimelineTextEntitySchema = looseObject({
  fromIndex: z.number(),
  toIndex: z.number(),
  ref: TimelineRefSchema.optional(),
});
export type TimelineTextEntity = z.infer<typeof TimelineTextEntitySchema>;

/** 一段可携带实体引用的文本。 */
export const TimelineTextSchema = looseObject({
  text: z.string(),
  entities: z.array(TimelineTextEntitySchema).optional(),
  rtl: z.boolean().optional(),
});
export type TimelineText = z.infer<typeof TimelineTextSchema>;

/** 社区注释 / Birdwatch 的简短调用按钮。 */
export const CallToActionSchema = looseObject({
  destinationUrl: z.string(),
  prompt: z.string(),
  title: z.string(),
});
export type CallToAction = z.infer<typeof CallToActionSchema>;

/** 社区注释元信息。 */
export const BirdwatchNoteSchema = looseObject({
  is_community_note_translatable: z.boolean().optional(),
  language: z.string().optional(),
  rest_id: z.string().optional(),
});
export type BirdwatchNote = z.infer<typeof BirdwatchNoteSchema>;

/** 帖子上的社区注释提示。 */
export const BirdwatchPivotSchema = looseObject({
  callToAction: CallToActionSchema.optional(),
  destinationUrl: z.string().optional(),
  footer: TimelineTextSchema.optional(),
  footerIconType: z.string().optional(),
  iconType: z.string().optional(),
  note: BirdwatchNoteSchema.optional(),
  shorttitle: z.string().optional(),
  subtitle: TimelineTextSchema.optional(),
  title: z.string().optional(),
  visualStyle: z.string().optional(),
});
export type BirdwatchPivot = z.infer<typeof BirdwatchPivotSchema>;

/** 墓碑节点，用于表示已删除或不可查看的帖子。 */
export const TweetTombstoneSchema = looseObject({
  __typename: z.literal('TweetTombstone'),
  tombstone: looseObject({
    __typename: z.string().optional(),
    text: TimelineTextSchema.optional(),
  }),
});
export type TweetTombstone = z.infer<typeof TweetTombstoneSchema>;

/** 基础颜色值。 */
export const RgbSchema = looseObject({
  red: z.number(),
  green: z.number(),
  blue: z.number(),
});
export type Rgb = z.infer<typeof RgbSchema>;

/** 调色板中的一个颜色采样点。 */
export const PaletteColorSchema = looseObject({
  percentage: z.number(),
  rgb: RgbSchema,
});
export type PaletteColor = z.infer<typeof PaletteColorSchema>;

/** 卡片图片值。 */
export const ImageValueSchema = looseObject({
  height: z.number(),
  width: z.number(),
  url: z.string(),
});
export type ImageValue = z.infer<typeof ImageValueSchema>;

/** 卡片中的图片颜色信息。 */
export const ImageColorValueSchema = looseObject({
  palette: z.array(PaletteColorSchema).optional(),
});
export type ImageColorValue = z.infer<typeof ImageColorValueSchema>;

/** 卡片中的用户引用值。 */
export const CardUserValueSchema = looseObject({
  id_str: z.string(),
  path: z.array(z.unknown()).optional(),
});
export type CardUserValue = z.infer<typeof CardUserValueSchema>;

/** 卡片绑定值的载荷。 */
export const CardBindingPayloadSchema = looseObject({
  type: z.string(),
  scribe_key: z.string().optional(),
  string_value: z.string().optional(),
  image_value: ImageValueSchema.optional(),
  image_color_value: ImageColorValueSchema.optional(),
  user_value: CardUserValueSchema.optional(),
});
export type CardBindingPayload = z.infer<typeof CardBindingPayloadSchema>;

/** 卡片中的一个键值绑定。 */
export const CardBindingValueSchema = looseObject({
  key: z.string(),
  value: CardBindingPayloadSchema,
});
export type CardBindingValue = z.infer<typeof CardBindingValueSchema>;

/** 用户资料链接。 */
export const UrlEntitySchema = looseObject({
  display_url: z.string(),
  expanded_url: z.string(),
  url: z.string(),
  indices: z.array(z.number()).optional(),
});
export type UrlEntity = z.infer<typeof UrlEntitySchema>;

/** 用户资料中的 URL 集合。 */
export const UrlContainerSchema = looseObject({
  urls: z.array(UrlEntitySchema),
});
export type UrlContainer = z.infer<typeof UrlContainerSchema>;

/** 认证信息。 */
export const UserVerificationSchema = looseObject({
  verified: z.boolean().optional(),
  verified_type: z.string().optional(),
});
export type UserVerification = z.infer<typeof UserVerificationSchema>;

/** 职业账号分类。 */
export const ProfessionalCategorySchema = looseObject({
  id: z.number(),
  name: z.string(),
  icon_name: z.string(),
});
export type ProfessionalCategory = z.infer<typeof ProfessionalCategorySchema>;

/** 职业账号信息。 */
export const ProfessionalProfileSchema = looseObject({
  rest_id: z.string().optional(),
  professional_type: z.string().optional(),
  category: z.array(ProfessionalCategorySchema).optional(),
});
export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;

/** 账号标签信息。 */
export const UserLabelSchema = looseObject({
  badge: looseObject({
    url: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  url: looseObject({
    url: z.string().optional(),
    urlType: z.string().optional(),
  }).optional(),
  userLabelDisplayType: z.string().optional(),
  userLabelType: z.string().optional(),
});
export type UserLabel = z.infer<typeof UserLabelSchema>;

/** 商业或组织标签。 */
export const AffiliatesHighlightedLabelSchema = looseObject({
  label: UserLabelSchema.optional(),
});
export type AffiliatesHighlightedLabel = z.infer<typeof AffiliatesHighlightedLabelSchema>;

/** 用户 legacy 实体。 */
export const UserLegacyEntitiesSchema = looseObject({
  description: UrlContainerSchema.optional(),
  url: UrlContainerSchema.optional(),
});
export type UserLegacyEntities = z.infer<typeof UserLegacyEntitiesSchema>;

/** 用户 legacy 主体。 */
export const UserLegacySchema = looseObject({
  default_profile: z.boolean().optional(),
  default_profile_image: z.boolean().optional(),
  description: z.string().optional(),
  entities: UserLegacyEntitiesSchema.optional(),
  fast_followers_count: z.number().optional(),
  favourites_count: z.number().optional(),
  follow_request_sent: z.boolean().optional(),
  followers_count: z.number().optional(),
  friends_count: z.number().optional(),
  has_custom_timelines: z.boolean().optional(),
  is_translator: z.boolean().optional(),
  listed_count: z.number().optional(),
  media_count: z.number().optional(),
  normal_followers_count: z.number().optional(),
  notifications: z.boolean().optional(),
  pinned_tweet_ids_str: z.array(z.string()).optional(),
  possibly_sensitive: z.boolean().optional(),
  profile_banner_url: z.string().optional(),
  profile_interstitial_type: z.string().optional(),
  statuses_count: z.number().optional(),
  translator_type: z.string().optional(),
  url: z.string().optional(),
  want_retweets: z.boolean().optional(),
  withheld_in_countries: z.array(z.string()).optional(),
});
export type UserLegacy = z.infer<typeof UserLegacySchema>;

/** 用户节点。 */
export const UserSchema = looseObject({
  __typename: z.literal('User'),
  id: z.string().optional(),
  rest_id: z.string().optional(),
  affiliates_highlighted_label: AffiliatesHighlightedLabelSchema.optional(),
  avatar: looseObject({
    image_url: z.string(),
  }).optional(),
  core: looseObject({
    created_at: z.string().optional(),
    name: z.string().optional(),
    screen_name: z.string().optional(),
  }).optional(),
  dm_permissions: looseObject({
    can_dm: z.boolean(),
  }).optional(),
  follow_request_sent: z.boolean().optional(),
  has_graduated_access: z.boolean().optional(),
  is_blue_verified: z.boolean().optional(),
  legacy: UserLegacySchema.optional(),
  location: looseObject({
    location: z.string(),
  }).optional(),
  media_permissions: looseObject({
    can_media_tag: z.boolean(),
  }).optional(),
  parody_commentary_fan_label: z.string().optional(),
  privacy: looseObject({
    protected: z.boolean(),
  }).optional(),
  professional: ProfessionalProfileSchema.optional(),
  profile_bio: looseObject({
    description: z.string(),
  }).optional(),
  profile_description_language: z.string().optional(),
  profile_image_shape: z.string().optional(),
  relationship_perspectives: looseObject({
    blocked_by: z.boolean().optional(),
    blocking: z.boolean().optional(),
    followed_by: z.boolean().optional(),
    following: z.boolean().optional(),
    muting: z.boolean().optional(),
  }).optional(),
  super_follow_eligible: z.boolean().optional(),
  super_followed_by: z.boolean().optional(),
  super_following: z.boolean().optional(),
  verification: UserVerificationSchema.optional(),
});
export type User = z.infer<typeof UserSchema>;

/** 用户结果容器。 */
export const UserResultContainerSchema = looseObject({
  result: z.union([UserSchema, UnknownGraphqlNodeSchema]),
});
export type UserResultContainer = z.infer<typeof UserResultContainerSchema>;

/** 帖子内哈希标签。 */
export const HashtagEntitySchema = looseObject({
  indices: z.array(z.number()),
  text: z.string(),
});
export type HashtagEntity = z.infer<typeof HashtagEntitySchema>;

/** 帖子内提及用户。 */
export const UserMentionSchema = looseObject({
  id_str: z.string(),
  indices: z.array(z.number()),
  name: z.string(),
  screen_name: z.string(),
});
export type UserMention = z.infer<typeof UserMentionSchema>;

/** 媒体上的人脸框。 */
export const MediaFaceSchema = looseObject({
  x: z.number(),
  y: z.number(),
  h: z.number(),
  w: z.number(),
});
export type MediaFace = z.infer<typeof MediaFaceSchema>;

/** 媒体特征集合。 */
export const MediaFeatureBucketSchema = looseObject({
  faces: z.array(MediaFaceSchema).optional(),
});
export type MediaFeatureBucket = z.infer<typeof MediaFeatureBucketSchema>;

/** 媒体特征。 */
export const MediaFeaturesSchema = looseObject({
  large: MediaFeatureBucketSchema.optional(),
  medium: MediaFeatureBucketSchema.optional(),
  small: MediaFeatureBucketSchema.optional(),
  orig: MediaFeatureBucketSchema.optional(),
});
export type MediaFeatures = z.infer<typeof MediaFeaturesSchema>;

/** 媒体焦点框。 */
export const FocusRectSchema = looseObject({
  x: z.number(),
  y: z.number(),
  h: z.number(),
  w: z.number(),
});
export type FocusRect = z.infer<typeof FocusRectSchema>;

/** 媒体尺寸。 */
export const MediaSizeSchema = looseObject({
  h: z.number(),
  w: z.number(),
  resize: z.string(),
});
export type MediaSize = z.infer<typeof MediaSizeSchema>;

/** 媒体尺寸集合。 */
export const MediaSizesSchema = looseObject({
  large: MediaSizeSchema.optional(),
  medium: MediaSizeSchema.optional(),
  small: MediaSizeSchema.optional(),
  thumb: MediaSizeSchema.optional(),
});
export type MediaSizes = z.infer<typeof MediaSizesSchema>;

/** 原图信息。 */
export const OriginalInfoSchema = looseObject({
  height: z.number(),
  width: z.number(),
  focus_rects: z.array(FocusRectSchema).optional(),
});
export type OriginalInfo = z.infer<typeof OriginalInfoSchema>;

/** 媒体结果的轻量引用。 */
export const MediaResultSchema = looseObject({
  media_key: z.string().optional(),
});
export type MediaResult = z.infer<typeof MediaResultSchema>;

/** 视频码率变体。 */
export const VideoVariantSchema = looseObject({
  bitrate: z.number().optional(),
  content_type: z.string(),
  url: z.string(),
});
export type VideoVariant = z.infer<typeof VideoVariantSchema>;

/** 视频信息。 */
export const VideoInfoSchema = looseObject({
  aspect_ratio: z.array(z.number()).optional(),
  duration_millis: z.number().optional(),
  variants: z.array(VideoVariantSchema).optional(),
});
export type VideoInfo = z.infer<typeof VideoInfoSchema>;

/** 媒体颜色扩展。 */
export const MediaColorExtSchema = looseObject({
  mediaColor: looseObject({
    r: looseObject({
      ok: looseObject({
        palette: z.array(PaletteColorSchema).optional(),
      }).optional(),
    }).optional(),
  }).optional(),
  ttl: z.number().optional(),
});
export type MediaColorExt = z.infer<typeof MediaColorExtSchema>;

/** 扩展媒体信息。 */
export const AdditionalMediaInfoSchema = looseObject({
  monetizable: z.boolean().optional(),
  source_user: looseObject({
    user_results: UserResultContainerSchema.optional(),
  }).optional(),
});
export type AdditionalMediaInfo = z.infer<typeof AdditionalMediaInfoSchema>;

/** 帖子媒体。 */
export const MediaSchema = looseObject({
  id: z.number().optional(),
  id_str: z.string(),
  indices: z.array(z.number()).optional(),
  display_url: z.string().optional(),
  expanded_url: z.string().optional(),
  media_key: z.string().optional(),
  media_results: looseObject({
    result: MediaResultSchema.optional(),
  }).optional(),
  media_url: z.string().optional(),
  media_url_https: z.string().optional(),
  original_info: OriginalInfoSchema.optional(),
  sizes: MediaSizesSchema.optional(),
  source_status_id_str: z.string().optional(),
  source_user_id: z.number().optional(),
  source_user_id_str: z.string().optional(),
  type: z.string(),
  url: z.string().optional(),
  ext_alt_text: z.string().optional(),
  ext_media_availability: looseObject({
    status: z.string().optional(),
  }).optional(),
  features: MediaFeaturesSchema.optional(),
  additional_media_info: AdditionalMediaInfoSchema.optional(),
  allow_download_status: looseObject({
    allow_download: z.boolean().optional(),
  }).optional(),
  video_info: VideoInfoSchema.optional(),
  ext: MediaColorExtSchema.optional(),
});
export type Media = z.infer<typeof MediaSchema>;

/** 图片 / 视频 URL 的引用信息。 */
export const QuotedStatusPermalinkSchema = looseObject({
  display: z.string(),
  expanded: z.string(),
  url: z.string(),
});
export type QuotedStatusPermalink = z.infer<typeof QuotedStatusPermalinkSchema>;

/** 帖子实体集合。 */
export const TweetEntitiesSchema = looseObject({
  hashtags: z.array(HashtagEntitySchema).optional(),
  media: z.array(MediaSchema).optional(),
  symbols: z.array(z.unknown()).optional(),
  timestamps: z.array(z.unknown()).optional(),
  urls: z.array(UrlEntitySchema).optional(),
  user_mentions: z.array(UserMentionSchema).optional(),
});
export type TweetEntities = z.infer<typeof TweetEntitiesSchema>;

/** Note Tweet 的正文结果。 */
export const NoteTweetResultSchema = looseObject({
  entity_set: looseObject({
    hashtags: z.array(z.unknown()).optional(),
    symbols: z.array(z.unknown()).optional(),
    urls: z.array(z.unknown()).optional(),
    user_mentions: z.array(z.unknown()).optional(),
  }).optional(),
  richtext: TimelineTextSchema.optional(),
  text: z.string(),
});
export type NoteTweetResult = z.infer<typeof NoteTweetResultSchema>;

/** Note Tweet 容器。 */
export const NoteTweetSchema = looseObject({
  is_expandable: z.boolean().optional(),
  note_tweet_results: looseObject({
    result: NoteTweetResultSchema,
  }),
});
export type NoteTweet = z.infer<typeof NoteTweetSchema>;

/** 浏览量。 */
export const ViewsSchema = looseObject({
  count: z.string().optional(),
  state: z.string().optional(),
});
export type Views = z.infer<typeof ViewsSchema>;

/** 编辑权限。 */
export const EditControlSchema = looseObject({
  edit_tweet_ids: z.array(z.string()),
  editable_until_msecs: z.string().optional(),
  edits_remaining: z.string().optional(),
  is_edit_eligible: z.boolean().optional(),
});
export type EditControl = z.infer<typeof EditControlSchema>;

/** 推广相关资格。 */
export const QuickPromoteEligibilitySchema = looseObject({
  eligibility: z.string().optional(),
});
export type QuickPromoteEligibility = z.infer<typeof QuickPromoteEligibilitySchema>;

/** Grok 相关扩展。 */
export const GrokAnnotationsSchema = looseObject({
  is_image_editable_by_grok: z.boolean().optional(),
});
export type GrokAnnotations = z.infer<typeof GrokAnnotationsSchema>;

/** 自动翻译可用性。 */
export const GrokTranslatedPostAvailabilitySchema = looseObject({
  is_available: z.boolean().optional(),
});
export type GrokTranslatedPostAvailability = z.infer<typeof GrokTranslatedPostAvailabilitySchema>;

/** 旧计数，用于展示修订前后的互动数。 */
export const PreviousCountsSchema = looseObject({
  bookmark_count: z.number().optional(),
  favorite_count: z.number().optional(),
  quote_count: z.number().optional(),
  reply_count: z.number().optional(),
  retweet_count: z.number().optional(),
});
export type PreviousCounts = z.infer<typeof PreviousCountsSchema>;

/** 广告披露。 */
export const ContentDisclosureSchema = looseObject({
  advertising_disclosure: looseObject({
    is_paid_promotion: z.boolean().optional(),
  }).optional(),
});
export type ContentDisclosure = z.infer<typeof ContentDisclosureSchema>;

/** 仅用于容纳当前抓包中基本为空的 unmention_data。 */
export const UnmentionDataSchema = looseObject({});
export type UnmentionData = z.infer<typeof UnmentionDataSchema>;

/** 谁可以回复等限制动作。 */
export const LimitedActionPromptSchema = looseObject({
  __typename: z.string().optional(),
  cta_type: z.string().optional(),
  headline: TimelineTextSchema.optional(),
  subtext: TimelineTextSchema.optional(),
});
export type LimitedActionPrompt = z.infer<typeof LimitedActionPromptSchema>;

/** 一条限制动作。 */
export const LimitedActionSchema = looseObject({
  action: z.string(),
  prompt: LimitedActionPromptSchema.optional(),
});
export type LimitedAction = z.infer<typeof LimitedActionSchema>;

/** 限制动作集合。 */
export const LimitedActionResultsSchema = looseObject({
  limited_actions: z.array(LimitedActionSchema),
});
export type LimitedActionResults = z.infer<typeof LimitedActionResultsSchema>;

/** 会话控制（谁可以回复）。 */
export const ConversationControlSchema = looseObject({
  conversation_owner_results: looseObject({
    result: z.union([UserSchema, UnknownGraphqlNodeSchema]).optional(),
  }).optional(),
  policy: z.string().optional(),
});
export type ConversationControl = z.infer<typeof ConversationControlSchema>;

/** 文章实体中的 media item。 */
export const ArticleMediaItemSchema = looseObject({
  localMediaId: z.string().optional(),
  mediaCategory: z.string().optional(),
  mediaId: z.string().optional(),
});
export type ArticleMediaItem = z.infer<typeof ArticleMediaItemSchema>;

/** 文章实体中的 entity range。 */
export const ArticleEntityRangeSchema = looseObject({
  key: z.number(),
  length: z.number(),
  offset: z.number(),
});
export type ArticleEntityRange = z.infer<typeof ArticleEntityRangeSchema>;

/** 文章实体中的样式区间。 */
export const ArticleInlineStyleRangeSchema = looseObject({
  length: z.number(),
  offset: z.number(),
  style: z.string(),
});
export type ArticleInlineStyleRange = z.infer<typeof ArticleInlineStyleRangeSchema>;

/** 文章正文中的 block。 */
export const ArticleContentBlockSchema = looseObject({
  data: looseObject({}).optional(),
  entityRanges: z.array(ArticleEntityRangeSchema).optional(),
  inlineStyleRanges: z.array(ArticleInlineStyleRangeSchema).optional(),
  key: z.string().optional(),
  text: z.string().optional(),
  type: z.string().optional(),
});
export type ArticleContentBlock = z.infer<typeof ArticleContentBlockSchema>;

/** 文章实体映射项。 */
export const ArticleEntityMapItemSchema = looseObject({
  key: z.string(),
  value: looseObject({
    data: looseObject({
      caption: z.string().optional(),
      entityKey: z.string().optional(),
      markdown: z.string().optional(),
      mediaItems: z.array(ArticleMediaItemSchema).optional(),
      tweetId: z.string().optional(),
      url: z.string().optional(),
    }).optional(),
    mutability: z.string().optional(),
    type: z.string().optional(),
  }).optional(),
});
export type ArticleEntityMapItem = z.infer<typeof ArticleEntityMapItemSchema>;

/** 文章正文内容。 */
export const ArticleContentStateSchema = looseObject({
  blocks: z.array(ArticleContentBlockSchema).optional(),
  entityMap: z.array(ArticleEntityMapItemSchema).optional(),
});
export type ArticleContentState = z.infer<typeof ArticleContentStateSchema>;

/** 文章封面图。 */
export const ApiImageSchema = looseObject({
  __typename: z.string().optional(),
  color_info: looseObject({
    palette: z.array(PaletteColorSchema).optional(),
  }).optional(),
  original_img_height: z.number().optional(),
  original_img_url: z.string().optional(),
  original_img_width: z.number().optional(),
});
export type ApiImage = z.infer<typeof ApiImageSchema>;

/** 文章使用的媒体引用。 */
export const ArticleMediaSchema = looseObject({
  id: z.string().optional(),
  media_id: z.string().optional(),
  media_info: ApiImageSchema.optional(),
  media_key: z.string().optional(),
});
export type ArticleMedia = z.infer<typeof ArticleMediaSchema>;

/** 文章结果。 */
export const ArticleResultSchema = looseObject({
  content_state: ArticleContentStateSchema.optional(),
  cover_media: ArticleMediaSchema.optional(),
  id: z.string().optional(),
  is_grok_summary_eligible: z.boolean().optional(),
  lifecycle_state: looseObject({
    modified_at_secs: z.number().optional(),
  }).optional(),
  media_entities: z.array(ArticleMediaSchema).optional(),
  metadata: looseObject({
    first_published_at_secs: z.number().optional(),
  }).optional(),
  preview_text: z.string().optional(),
  rest_id: z.string().optional(),
  summary_text: z.string().optional(),
  title: z.string().optional(),
});
export type ArticleResult = z.infer<typeof ArticleResultSchema>;

/** 文章对象。 */
export const ArticleSchema = looseObject({
  article_results: looseObject({
    result: ArticleResultSchema.optional(),
  }),
});
export type Article = z.infer<typeof ArticleSchema>;

/** 卡片平台设备信息。 */
export const CardPlatformSchema = looseObject({
  platform: looseObject({
    audience: looseObject({
      name: z.string().optional(),
    }).optional(),
    device: looseObject({
      name: z.string().optional(),
      version: z.string().optional(),
    }).optional(),
  }).optional(),
});
export type CardPlatform = z.infer<typeof CardPlatformSchema>;

/** 卡片 legacy。 */
export const CardLegacySchema = looseObject({
  binding_values: z.array(CardBindingValueSchema).optional(),
  card_platform: CardPlatformSchema.optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  user_refs_results: z.array(UserResultContainerSchema).optional(),
});
export type CardLegacy = z.infer<typeof CardLegacySchema>;

/** 帖子卡片。 */
export const CardSchema = looseObject({
  legacy: CardLegacySchema,
  rest_id: z.string(),
});
export type Card = z.infer<typeof CardSchema>;

/**
 * 递归结果容器。
 *
 * quoted / retweeted 结构都会包装成 `result` 字段，因此统一复用这一层容器。
 */
export interface TweetResultEnvelope extends Record<string, unknown> {
  result: TweetResult;
}

export interface TweetLegacy extends Record<string, unknown> {
  bookmark_count?: number;
  bookmarked?: boolean;
  conversation_control?: ConversationControl;
  conversation_id_str: string;
  created_at: string;
  display_text_range?: number[];
  entities: TweetEntities;
  extended_entities?: {
    media: Media[];
    [key: string]: unknown;
  };
  favorite_count?: number;
  favorited?: boolean;
  full_text: string;
  id_str: string;
  in_reply_to_screen_name?: string | null;
  in_reply_to_status_id_str?: string | null;
  in_reply_to_user_id_str?: string | null;
  is_quote_status: boolean;
  lang?: string;
  place?: Record<string, unknown>;
  possibly_sensitive?: boolean;
  possibly_sensitive_editable?: boolean;
  quote_count?: number;
  quoted_status_id_str?: string;
  quoted_status_permalink?: QuotedStatusPermalink;
  reply_count?: number;
  retweet_count?: number;
  retweeted?: boolean;
  retweeted_status_result?: TweetResultEnvelope;
  scopes?: {
    followers?: boolean;
    [key: string]: unknown;
  };
  user_id_str: string;
}

export interface Tweet extends Record<string, unknown> {
  __typename: 'Tweet';
  article?: Article;
  birdwatch_pivot?: BirdwatchPivot;
  card?: Card;
  content_disclosure?: ContentDisclosure;
  core: TweetCore;
  edit_control?: EditControl;
  grok_analysis_button?: boolean;
  grok_annotations?: GrokAnnotations;
  grok_translated_post_with_availability?: GrokTranslatedPostAvailability;
  has_birdwatch_notes?: boolean;
  is_translatable?: boolean;
  legacy: TweetLegacy;
  limitedActionResults?: LimitedActionResults;
  note_tweet?: NoteTweet;
  previous_counts?: PreviousCounts;
  quick_promote_eligibility?: QuickPromoteEligibility;
  quoted_status_result?: TweetResultEnvelope;
  rest_id: string;
  retweeted_status_result?: TweetResultEnvelope;
  source?: string;
  unmention_data?: UnmentionData;
  views?: Views;
}

export type TweetResult = Tweet | TweetTombstone | UnknownGraphqlNode;

export const TweetResultEnvelopeSchema: z.ZodType<TweetResultEnvelope> = z.lazy(() => looseObject({
  result: TweetResultSchema,
}));

/** 帖子 core，目前核心是作者用户结果。 */
export const TweetCoreSchema = looseObject({
  user_results: UserResultContainerSchema,
});
export type TweetCore = z.infer<typeof TweetCoreSchema>;

/** 帖子 legacy 载荷。 */
export const TweetLegacySchema: z.ZodType<TweetLegacy> = z.lazy(() => looseObject({
  bookmark_count: z.number().optional(),
  bookmarked: z.boolean().optional(),
  conversation_control: ConversationControlSchema.optional(),
  conversation_id_str: z.string(),
  created_at: z.string(),
  display_text_range: z.array(z.number()).optional(),
  entities: TweetEntitiesSchema,
  extended_entities: looseObject({
    media: z.array(MediaSchema),
  }).optional(),
  favorite_count: z.number().optional(),
  favorited: z.boolean().optional(),
  full_text: z.string(),
  id_str: z.string(),
  in_reply_to_screen_name: z.string().nullable().optional(),
  in_reply_to_status_id_str: z.string().nullable().optional(),
  in_reply_to_user_id_str: z.string().nullable().optional(),
  is_quote_status: z.boolean(),
  lang: z.string().optional(),
  place: looseObject({}).optional(),
  possibly_sensitive: z.boolean().optional(),
  possibly_sensitive_editable: z.boolean().optional(),
  quote_count: z.number().optional(),
  quoted_status_id_str: z.string().optional(),
  quoted_status_permalink: QuotedStatusPermalinkSchema.optional(),
  reply_count: z.number().optional(),
  retweet_count: z.number().optional(),
  retweeted: z.boolean().optional(),
  retweeted_status_result: TweetResultEnvelopeSchema.optional(),
  scopes: looseObject({
    followers: z.boolean().optional(),
  }).optional(),
  user_id_str: z.string(),
}));

/**
 * 统一后的最终帖子对象。
 *
 * 注意：
 * - 这里的 `__typename` 固定视为 `Tweet`
 * - 输入若为 `TweetWithVisibilityResults`，会先经由 `normalizeTweetResultInput()` 拆包后再校验
 */
export const TweetSchema: z.ZodType<Tweet> = z.lazy(() => looseObject({
  __typename: z.literal('Tweet'),
  article: ArticleSchema.optional(),
  birdwatch_pivot: BirdwatchPivotSchema.optional(),
  card: CardSchema.optional(),
  content_disclosure: ContentDisclosureSchema.optional(),
  core: TweetCoreSchema,
  edit_control: EditControlSchema.optional(),
  grok_analysis_button: z.boolean().optional(),
  grok_annotations: GrokAnnotationsSchema.optional(),
  grok_translated_post_with_availability: GrokTranslatedPostAvailabilitySchema.optional(),
  has_birdwatch_notes: z.boolean().optional(),
  is_translatable: z.boolean().optional(),
  legacy: TweetLegacySchema,
  limitedActionResults: LimitedActionResultsSchema.optional(),
  note_tweet: NoteTweetSchema.optional(),
  previous_counts: PreviousCountsSchema.optional(),
  quick_promote_eligibility: QuickPromoteEligibilitySchema.optional(),
  quoted_status_result: TweetResultEnvelopeSchema.optional(),
  rest_id: z.string(),
  retweeted_status_result: TweetResultEnvelopeSchema.optional(),
  source: z.string().optional(),
  unmention_data: UnmentionDataSchema.optional(),
  views: ViewsSchema.optional(),
}));

/**
 * `tweet_results.result` 的统一入口：
 * - 允许直接传入 `Tweet`
 * - 允许直接传入 `TweetWithVisibilityResults`
 * - 允许传入 `TweetTombstone`
 */
export const TweetResultSchema: z.ZodType<TweetResult> = z.lazy(() => z.preprocess(
  normalizeTweetResultInput,
  z.union([TweetSchema, TweetTombstoneSchema, UnknownGraphqlNodeSchema]),
));

/** 便于直接解析单个 `tweet_results.result` 节点。 */
export function parseTweetResult(input: unknown): TweetResult {
  return TweetResultSchema.parse(input);
}
