import { z } from 'zod';

/**
 * 统一的帖子原始数据模型。
 *
 * 设计原则：
 * 1. 保持 `Tweet` 与 `TweetWithVisibilityResults` 的原始层级，不再把包装层打平并入帖子对象。
 * 2. 对核心且稳定的字段做显式建模，并通过严格对象校验感知未覆盖字段。
 * 3. quoted / retweeted 等帖子递归引用继续使用同一套原始联合模型。
 */

function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject(shape);
}

/** 最小 GraphQL 节点占位，仅承接当前只识别 `__typename` 的结果类型。 */
export const UnknownGraphqlNodeSchema = strictObject({
  __typename: z.string().optional(),
});
export type UnknownGraphqlNode = z.infer<typeof UnknownGraphqlNodeSchema>;

/** 富文本 @ 提及里引用的最小用户节点。 */
export const TimelineMentionUserSchema = strictObject({
  __typename: z.literal('User'),
  core: strictObject({
    screen_name: z.string().optional(),
  }).optional(),
  rest_id: z.string().optional(),
});
export type TimelineMentionUser = z.infer<typeof TimelineMentionUserSchema>;

/** 富文本 @ 提及结果容器。 */
export const TimelineMentionResultsSchema = strictObject({
  result: TimelineMentionUserSchema.optional(),
});
export type TimelineMentionResults = z.infer<typeof TimelineMentionResultsSchema>;

/** 富文本中的 URL / 深链引用。 */
export const TimelineRefSchema = strictObject({
  mention_results: TimelineMentionResultsSchema.optional(),
  screen_name: z.string().optional(),
  type: z.string(),
  url: z.string().optional(),
  urlType: z.string().optional(),
});
export type TimelineRef = z.infer<typeof TimelineRefSchema>;

/** 富文本中的实体区间。 */
export const TimelineTextEntitySchema = strictObject({
  fromIndex: z.number(),
  toIndex: z.number(),
  ref: TimelineRefSchema.optional(),
});
export type TimelineTextEntity = z.infer<typeof TimelineTextEntitySchema>;

/** 一段可携带实体引用的文本。 */
export const TimelineTextSchema = strictObject({
  text: z.string(),
  entities: z.array(TimelineTextEntitySchema).optional(),
  rtl: z.boolean().optional(),
});
export type TimelineText = z.infer<typeof TimelineTextSchema>;

/** 社区注释 / Birdwatch 的简短调用按钮。 */
export const CallToActionSchema = strictObject({
  destinationUrl: z.string(),
  prompt: z.string(),
  title: z.string(),
});
export type CallToAction = z.infer<typeof CallToActionSchema>;

/** 社区注释元信息。 */
export const BirdwatchNoteSchema = strictObject({
  is_community_note_translatable: z.boolean().optional(),
  language: z.string().optional(),
  rest_id: z.string().optional(),
});
export type BirdwatchNote = z.infer<typeof BirdwatchNoteSchema>;

/** 帖子上的社区注释提示。 */
export const BirdwatchPivotSchema = strictObject({
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
export const TweetTombstoneSchema = strictObject({
  __typename: z.literal('TweetTombstone'),
  tombstone: strictObject({
    __typename: z.string().optional(),
    text: TimelineTextSchema.optional(),
  }),
});
export type TweetTombstone = z.infer<typeof TweetTombstoneSchema>;

/** 基础颜色值。 */
export const RgbSchema = strictObject({
  red: z.number(),
  green: z.number(),
  blue: z.number(),
});
export type Rgb = z.infer<typeof RgbSchema>;

/** 调色板中的一个颜色采样点。 */
export const PaletteColorSchema = strictObject({
  percentage: z.number(),
  rgb: RgbSchema,
});
export type PaletteColor = z.infer<typeof PaletteColorSchema>;

/** 卡片图片值。 */
export const ImageValueSchema = strictObject({
  alt: z.string().optional(),
  height: z.number(),
  width: z.number(),
  url: z.string(),
});
export type ImageValue = z.infer<typeof ImageValueSchema>;

/** 卡片中的图片颜色信息。 */
export const ImageColorValueSchema = strictObject({
  palette: z.array(PaletteColorSchema).optional(),
});
export type ImageColorValue = z.infer<typeof ImageColorValueSchema>;

/** 卡片中的用户引用值。 */
export const CardUserValueSchema = strictObject({
  id_str: z.string(),
  path: z.array(z.unknown()).optional(),
});
export type CardUserValue = z.infer<typeof CardUserValueSchema>;

/** 卡片绑定值的载荷。 */
export const CardBindingPayloadSchema = strictObject({
  boolean_value: z.boolean().optional(),
  type: z.string(),
  scribe_key: z.string().optional(),
  string_value: z.string().optional(),
  image_value: ImageValueSchema.optional(),
  image_color_value: ImageColorValueSchema.optional(),
  user_value: CardUserValueSchema.optional(),
});
export type CardBindingPayload = z.infer<typeof CardBindingPayloadSchema>;

/** 卡片中的一个键值绑定。 */
export const CardBindingValueSchema = strictObject({
  key: z.string(),
  value: CardBindingPayloadSchema,
});
export type CardBindingValue = z.infer<typeof CardBindingValueSchema>;

/** 用户资料链接。 */
export const UrlEntitySchema = strictObject({
  display_url: z.string(),
  expanded_url: z.string(),
  url: z.string(),
  indices: z.array(z.number()).optional(),
});
export type UrlEntity = z.infer<typeof UrlEntitySchema>;

/** 金融/符号实体中的标的信息。 */
export const SymbolInfoSchema = strictObject({
  name: z.string().optional(),
  ticker: z.string().optional(),
});
export type SymbolInfo = z.infer<typeof SymbolInfoSchema>;

/** 金融/符号实体中的标签包装层。 */
export const SymbolTagSchema = strictObject({
  info: strictObject({
    info: SymbolInfoSchema.optional(),
  }).optional(),
});
export type SymbolTag = z.infer<typeof SymbolTagSchema>;

/** 帖子中的金融/符号实体。 */
export const SymbolEntitySchema = strictObject({
  indices: z.array(z.number()).optional(),
  tag: SymbolTagSchema.optional(),
  text: z.string().optional(),
});
export type SymbolEntity = z.infer<typeof SymbolEntitySchema>;

/** 用户资料中的 URL 集合。 */
export const UrlContainerSchema = strictObject({
  urls: z.array(UrlEntitySchema),
});
export type UrlContainer = z.infer<typeof UrlContainerSchema>;

/** 认证信息。 */
export const UserVerificationSchema = strictObject({
  verified: z.boolean().optional(),
  verified_type: z.string().optional(),
});
export type UserVerification = z.infer<typeof UserVerificationSchema>;

/** 职业账号分类。 */
export const ProfessionalCategorySchema = strictObject({
  id: z.number(),
  name: z.string(),
  icon_name: z.string(),
});
export type ProfessionalCategory = z.infer<typeof ProfessionalCategorySchema>;

/** 职业账号信息。 */
export const ProfessionalProfileSchema = strictObject({
  rest_id: z.string().optional(),
  professional_type: z.string().optional(),
  category: z.array(ProfessionalCategorySchema).optional(),
});
export type ProfessionalProfile = z.infer<typeof ProfessionalProfileSchema>;

/** 账号标签信息。 */
export const UserLabelSchema = strictObject({
  badge: strictObject({
    url: z.string().optional(),
  }).optional(),
  description: z.string().optional(),
  longDescription: TimelineTextSchema.optional(),
  url: strictObject({
    url: z.string().optional(),
    urlType: z.string().optional(),
  }).optional(),
  userLabelDisplayType: z.string().optional(),
  userLabelType: z.string().optional(),
});
export type UserLabel = z.infer<typeof UserLabelSchema>;

/** 商业或组织标签。 */
export const AffiliatesHighlightedLabelSchema = strictObject({
  label: UserLabelSchema.optional(),
});
export type AffiliatesHighlightedLabel = z.infer<typeof AffiliatesHighlightedLabelSchema>;

/** 用户 legacy 实体。 */
export const UserLegacyEntitiesSchema = strictObject({
  description: UrlContainerSchema.optional(),
  url: UrlContainerSchema.optional(),
});
export type UserLegacyEntities = z.infer<typeof UserLegacyEntitiesSchema>;

/** 用户 legacy 主体。 */
export const UserLegacySchema = strictObject({
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
export const UserSchema = strictObject({
  __typename: z.literal('User'),
  id: z.string().optional(),
  rest_id: z.string().optional(),
  affiliates_highlighted_label: AffiliatesHighlightedLabelSchema.optional(),
  avatar: strictObject({
    image_url: z.string(),
  }).optional(),
  core: strictObject({
    created_at: z.string().optional(),
    name: z.string().optional(),
    screen_name: z.string().optional(),
  }).optional(),
  dm_permissions: strictObject({
    can_dm: z.boolean(),
  }).optional(),
  follow_request_sent: z.boolean().optional(),
  has_graduated_access: z.boolean().optional(),
  is_blue_verified: z.boolean().optional(),
  legacy: UserLegacySchema.optional(),
  location: strictObject({
    location: z.string(),
  }).optional(),
  media_permissions: strictObject({
    can_media_tag: z.boolean(),
  }).optional(),
  parody_commentary_fan_label: z.string().optional(),
  privacy: strictObject({
    protected: z.boolean(),
  }).optional(),
  professional: ProfessionalProfileSchema.optional(),
  profile_bio: strictObject({
    description: z.string(),
  }).optional(),
  profile_description_language: z.string().optional(),
  profile_image_shape: z.string().optional(),
  relationship_perspectives: strictObject({
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
export const UserResultContainerSchema = strictObject({
  result: UserSchema,
});
export type UserResultContainer = z.infer<typeof UserResultContainerSchema>;

/** 帖子内哈希标签。 */
export const HashtagEntitySchema = strictObject({
  indices: z.array(z.number()),
  text: z.string(),
});
export type HashtagEntity = z.infer<typeof HashtagEntitySchema>;

/** 帖子内提及用户。 */
export const UserMentionSchema = strictObject({
  id_str: z.string(),
  indices: z.array(z.number()),
  name: z.string(),
  screen_name: z.string(),
});
export type UserMention = z.infer<typeof UserMentionSchema>;

/** 媒体上的人脸框。 */
export const MediaFaceSchema = strictObject({
  x: z.number(),
  y: z.number(),
  h: z.number(),
  w: z.number(),
});
export type MediaFace = z.infer<typeof MediaFaceSchema>;

/** 媒体特征中的人物标注。 */
export const MediaTagSchema = strictObject({
  name: z.string().optional(),
  screen_name: z.string().optional(),
  type: z.string().optional(),
  user_id: z.string().optional(),
});
export type MediaTag = z.infer<typeof MediaTagSchema>;

/** 媒体特征集合。 */
export const MediaFeatureBucketSchema = strictObject({
  faces: z.array(MediaFaceSchema).optional(),
  tags: z.array(MediaTagSchema).optional(),
});
export type MediaFeatureBucket = z.infer<typeof MediaFeatureBucketSchema>;

/** 媒体特征。 */
export const MediaFeaturesSchema = strictObject({
  all: MediaFeatureBucketSchema.optional(),
  large: MediaFeatureBucketSchema.optional(),
  medium: MediaFeatureBucketSchema.optional(),
  small: MediaFeatureBucketSchema.optional(),
  orig: MediaFeatureBucketSchema.optional(),
});
export type MediaFeatures = z.infer<typeof MediaFeaturesSchema>;

/** 媒体焦点框。 */
export const FocusRectSchema = strictObject({
  x: z.number(),
  y: z.number(),
  h: z.number(),
  w: z.number(),
});
export type FocusRect = z.infer<typeof FocusRectSchema>;

/** 媒体尺寸。 */
export const MediaSizeSchema = strictObject({
  h: z.number(),
  w: z.number(),
  resize: z.string(),
});
export type MediaSize = z.infer<typeof MediaSizeSchema>;

/** 媒体尺寸集合。 */
export const MediaSizesSchema = strictObject({
  large: MediaSizeSchema.optional(),
  medium: MediaSizeSchema.optional(),
  small: MediaSizeSchema.optional(),
  thumb: MediaSizeSchema.optional(),
});
export type MediaSizes = z.infer<typeof MediaSizesSchema>;

/** 原图信息。 */
export const OriginalInfoSchema = strictObject({
  height: z.number(),
  width: z.number(),
  focus_rects: z.array(FocusRectSchema).optional(),
});
export type OriginalInfo = z.infer<typeof OriginalInfoSchema>;

/** 媒体结果的轻量引用。 */
export const MediaResultSchema = strictObject({
  media_key: z.string().optional(),
});
export type MediaResult = z.infer<typeof MediaResultSchema>;

/** 视频码率变体。 */
export const VideoVariantSchema = strictObject({
  bitrate: z.number().optional(),
  content_type: z.string(),
  url: z.string(),
});
export type VideoVariant = z.infer<typeof VideoVariantSchema>;

/** 视频信息。 */
export const VideoInfoSchema = strictObject({
  aspect_ratio: z.array(z.number()).optional(),
  duration_millis: z.number().optional(),
  variants: z.array(VideoVariantSchema).optional(),
});
export type VideoInfo = z.infer<typeof VideoInfoSchema>;

/** 媒体附加信息中的站点跳转动作。 */
export const MediaVisitSiteSchema = strictObject({
  url: z.string().optional(),
});
export type MediaVisitSite = z.infer<typeof MediaVisitSiteSchema>;

/** 媒体附加信息中的调用动作集合。 */
export const MediaCallToActionsSchema = strictObject({
  visit_site: MediaVisitSiteSchema.optional(),
});
export type MediaCallToActions = z.infer<typeof MediaCallToActionsSchema>;

/** 扩展媒体信息。 */
export const AdditionalMediaInfoSchema = strictObject({
  call_to_actions: MediaCallToActionsSchema.optional(),
  description: z.string().optional(),
  embeddable: z.boolean().optional(),
  monetizable: z.boolean().optional(),
  source_user: strictObject({
    user_results: UserResultContainerSchema.optional(),
  }).optional(),
  title: z.string().optional(),
});
export type AdditionalMediaInfo = z.infer<typeof AdditionalMediaInfoSchema>;

/** 帖子媒体。 */
export const MediaSchema = strictObject({
  id_str: z.string(),
  indices: z.array(z.number()).optional(),
  display_url: z.string().optional(),
  expanded_url: z.string().optional(),
  grok_post_id: z.string().optional(),
  media_key: z.string().optional(),
  media_results: strictObject({
    result: MediaResultSchema.optional(),
  }).optional(),
  media_url_https: z.string().optional(),
  original_info: OriginalInfoSchema.optional(),
  sizes: MediaSizesSchema.optional(),
  source_status_id_str: z.string().optional(),
  source_user_id_str: z.string().optional(),
  type: z.string(),
  url: z.string().optional(),
  ext_alt_text: z.string().optional(),
  ext_media_availability: strictObject({
    status: z.string().optional(),
  }).optional(),
  features: MediaFeaturesSchema.optional(),
  additional_media_info: AdditionalMediaInfoSchema.optional(),
  allow_download_status: strictObject({
    allow_download: z.boolean().optional(),
  }).optional(),
  video_info: VideoInfoSchema.optional(),
});
export type Media = z.infer<typeof MediaSchema>;

/** 图片 / 视频 URL 的引用信息。 */
export const QuotedStatusPermalinkSchema = strictObject({
  display: z.string(),
  expanded: z.string(),
  url: z.string(),
});
export type QuotedStatusPermalink = z.infer<typeof QuotedStatusPermalinkSchema>;

/** 帖子实体集合。 */
export const TweetEntitiesSchema = strictObject({
  hashtags: z.array(HashtagEntitySchema).optional(),
  media: z.array(MediaSchema).optional(),
  smarttags: z.array(z.unknown()).optional(),
  symbols: z.array(SymbolEntitySchema).optional(),
  timestamps: z.array(z.unknown()).optional(),
  urls: z.array(UrlEntitySchema).optional(),
  user_mentions: z.array(UserMentionSchema).optional(),
});
export type TweetEntities = z.infer<typeof TweetEntitiesSchema>;

/** Note Tweet 富文本中的样式区间。 */
export const NoteTweetRichTextTagSchema = strictObject({
  from_index: z.number(),
  richtext_types: z.array(z.string()),
  to_index: z.number(),
});
export type NoteTweetRichTextTag = z.infer<typeof NoteTweetRichTextTagSchema>;

/** Note Tweet 富文本。 */
export const NoteTweetRichTextSchema = strictObject({
  richtext_tags: z.array(NoteTweetRichTextTagSchema).optional(),
});
export type NoteTweetRichText = z.infer<typeof NoteTweetRichTextSchema>;

/** Note Tweet 中复用的实体集合。 */
export const NoteTweetEntitySetSchema = strictObject({
  hashtags: z.array(HashtagEntitySchema).optional(),
  symbols: z.array(z.unknown()).optional(),
  timestamps: z.array(z.unknown()).optional(),
  urls: z.array(UrlEntitySchema).optional(),
  user_mentions: z.array(UserMentionSchema).optional(),
});
export type NoteTweetEntitySet = z.infer<typeof NoteTweetEntitySetSchema>;

/** Note Tweet 中的内联媒体。当前抓包仅观察到空数组。 */
export const NoteTweetMediaSchema = strictObject({
  inline_media: z.array(z.unknown()).optional(),
});
export type NoteTweetMedia = z.infer<typeof NoteTweetMediaSchema>;

/** Note Tweet 的正文结果。 */
export const NoteTweetResultSchema = strictObject({
  entity_set: NoteTweetEntitySetSchema.optional(),
  id: z.string().optional(),
  media: NoteTweetMediaSchema.optional(),
  richtext: NoteTweetRichTextSchema.optional(),
  text: z.string(),
});
export type NoteTweetResult = z.infer<typeof NoteTweetResultSchema>;

/** Note Tweet 容器。 */
export const NoteTweetSchema = strictObject({
  is_expandable: z.boolean().optional(),
  note_tweet_results: strictObject({
    result: NoteTweetResultSchema,
  }),
});
export type NoteTweet = z.infer<typeof NoteTweetSchema>;

/** 浏览量。 */
export const ViewsSchema = strictObject({
  count: z.string().optional(),
  state: z.string().optional(),
});
export type Views = z.infer<typeof ViewsSchema>;

/** 编辑权限基础字段。 */
export const EditControlBaseSchema = strictObject({
  edit_tweet_ids: z.array(z.string()),
  editable_until_msecs: z.string().optional(),
  edits_remaining: z.string().optional(),
  is_edit_eligible: z.boolean().optional(),
});
export type EditControlBase = z.infer<typeof EditControlBaseSchema>;

/** 编辑权限。存在直接形态与 `edit_control_initial` 包裹形态。 */
export const EditControlSchema = z.union([
  EditControlBaseSchema,
  strictObject({
    edit_control_initial: EditControlBaseSchema,
    initial_tweet_id: z.string(),
  }),
]);
export type EditControl = z.infer<typeof EditControlSchema>;

/** 推广相关资格。 */
export const QuickPromoteEligibilitySchema = strictObject({
  eligibility: z.string().optional(),
});
export type QuickPromoteEligibility = z.infer<typeof QuickPromoteEligibilitySchema>;

/** Grok 相关扩展。 */
export const GrokAnnotationsSchema = strictObject({
  is_image_editable_by_grok: z.boolean().optional(),
});
export type GrokAnnotations = z.infer<typeof GrokAnnotationsSchema>;

/** 自动翻译附带的数据内容。 */
export const GrokTranslatedPostDataSchema = strictObject({
  associated_data: strictObject({}).optional(),
  destination_language: z.string().optional(),
  entities: TweetEntitiesSchema.optional(),
  source_language: z.string().optional(),
  translation: z.string().optional(),
});
export type GrokTranslatedPostData = z.infer<typeof GrokTranslatedPostDataSchema>;

/** 自动翻译可用性。 */
export const GrokTranslatedPostAvailabilitySchema = strictObject({
  data: GrokTranslatedPostDataSchema.optional(),
  is_available: z.boolean().optional(),
});
export type GrokTranslatedPostAvailability = z.infer<typeof GrokTranslatedPostAvailabilitySchema>;

/** 媒体可见性遮罩中的提示内容。 */
export const MediaVisibilityInterstitialSchema = strictObject({
  opacity: z.number().optional(),
  text: TimelineTextSchema.optional(),
  title: TimelineTextSchema.optional(),
});
export type MediaVisibilityInterstitial = z.infer<typeof MediaVisibilityInterstitialSchema>;

/** 媒体可见性结果。 */
export const MediaVisibilityResultsSchema = strictObject({
  blurred_image_interstitial: MediaVisibilityInterstitialSchema.optional(),
});
export type MediaVisibilityResults = z.infer<typeof MediaVisibilityResultsSchema>;

/** 旧计数，用于展示修订前后的互动数。 */
export const PreviousCountsSchema = strictObject({
  bookmark_count: z.number().optional(),
  favorite_count: z.number().optional(),
  quote_count: z.number().optional(),
  reply_count: z.number().optional(),
  retweet_count: z.number().optional(),
});
export type PreviousCounts = z.infer<typeof PreviousCountsSchema>;

/** 广告披露。 */
export const ContentDisclosureSchema = strictObject({
  advertising_disclosure: strictObject({
    is_paid_promotion: z.boolean().optional(),
  }).optional(),
});
export type ContentDisclosure = z.infer<typeof ContentDisclosureSchema>;

/** unmention hydrate 里的轻量用户结果。 */
export const UnmentionedUserResultSchema = strictObject({
  rest_id: z.string().optional(),
});
export type UnmentionedUserResult = z.infer<typeof UnmentionedUserResultSchema>;

/** unmention_data.hydrate。 */
export const UnmentionHydrateSchema = strictObject({
  unmentioned_users_results: z.array(UnmentionedUserResultSchema).optional(),
});
export type UnmentionHydrate = z.infer<typeof UnmentionHydrateSchema>;

/** 当前抓包中的 unmention_data。 */
export const UnmentionDataSchema = strictObject({
  hydrate: UnmentionHydrateSchema.optional(),
});
export type UnmentionData = z.infer<typeof UnmentionDataSchema>;

/** 谁可以回复等限制动作。 */
export const LimitedActionPromptSchema = strictObject({
  __typename: z.string().optional(),
  cta_type: z.string().optional(),
  headline: TimelineTextSchema.optional(),
  subtext: TimelineTextSchema.optional(),
});
export type LimitedActionPrompt = z.infer<typeof LimitedActionPromptSchema>;

/** 一条限制动作。 */
export const LimitedActionSchema = strictObject({
  action: z.string(),
  prompt: LimitedActionPromptSchema.optional(),
});
export type LimitedAction = z.infer<typeof LimitedActionSchema>;

/** 限制动作集合。 */
export const LimitedActionResultsSchema = strictObject({
  limited_actions: z.array(LimitedActionSchema),
});
export type LimitedActionResults = z.infer<typeof LimitedActionResultsSchema>;

/** 会话控制（谁可以回复）。 */
export const ConversationControlSchema = strictObject({
  conversation_owner_results: strictObject({
    result: UserSchema.optional(),
  }).optional(),
  policy: z.string().optional(),
});
export type ConversationControl = z.infer<typeof ConversationControlSchema>;

/** 文章实体中的 media item。 */
export const ArticleMediaItemSchema = strictObject({
  localMediaId: z.string().optional(),
  mediaCategory: z.string().optional(),
  mediaId: z.string().optional(),
});
export type ArticleMediaItem = z.infer<typeof ArticleMediaItemSchema>;

/** 文章实体中的 entity range。 */
export const ArticleEntityRangeSchema = strictObject({
  key: z.number(),
  length: z.number(),
  offset: z.number(),
});
export type ArticleEntityRange = z.infer<typeof ArticleEntityRangeSchema>;

/** 文章实体中的样式区间。 */
export const ArticleInlineStyleRangeSchema = strictObject({
  length: z.number(),
  offset: z.number(),
  style: z.string(),
});
export type ArticleInlineStyleRange = z.infer<typeof ArticleInlineStyleRangeSchema>;

/** 文章正文中的 block。 */
export const ArticleContentBlockSchema = strictObject({
  data: strictObject({}).optional(),
  entityRanges: z.array(ArticleEntityRangeSchema).optional(),
  inlineStyleRanges: z.array(ArticleInlineStyleRangeSchema).optional(),
  key: z.string().optional(),
  text: z.string().optional(),
  type: z.string().optional(),
});
export type ArticleContentBlock = z.infer<typeof ArticleContentBlockSchema>;

/** 文章实体映射项。 */
export const ArticleEntityMapItemSchema = strictObject({
  key: z.string(),
  value: strictObject({
    data: strictObject({
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
export const ArticleContentStateSchema = strictObject({
  blocks: z.array(ArticleContentBlockSchema).optional(),
  entityMap: z.array(ArticleEntityMapItemSchema).optional(),
});
export type ArticleContentState = z.infer<typeof ArticleContentStateSchema>;

/** 文章封面图。 */
export const ApiImageSchema = strictObject({
  __typename: z.string().optional(),
  color_info: strictObject({
    palette: z.array(PaletteColorSchema).optional(),
  }).optional(),
  original_img_height: z.number().optional(),
  original_img_url: z.string().optional(),
  original_img_width: z.number().optional(),
});
export type ApiImage = z.infer<typeof ApiImageSchema>;

/** 文章使用的媒体引用。 */
export const ArticleMediaSchema = strictObject({
  id: z.string().optional(),
  media_id: z.string().optional(),
  media_info: ApiImageSchema.optional(),
  media_key: z.string().optional(),
});
export type ArticleMedia = z.infer<typeof ArticleMediaSchema>;

/** 文章结果。 */
export const ArticleResultSchema = strictObject({
  content_state: ArticleContentStateSchema.optional(),
  cover_media: ArticleMediaSchema.optional(),
  id: z.string().optional(),
  is_grok_summary_eligible: z.boolean().optional(),
  lifecycle_state: strictObject({
    modified_at_secs: z.number().optional(),
  }).optional(),
  media_entities: z.array(ArticleMediaSchema).optional(),
  metadata: strictObject({
    first_published_at_secs: z.number().optional(),
  }).optional(),
  preview_text: z.string().optional(),
  rest_id: z.string().optional(),
  summary_text: z.string().optional(),
  title: z.string().optional(),
});
export type ArticleResult = z.infer<typeof ArticleResultSchema>;

/** 文章对象。 */
export const ArticleSchema = strictObject({
  article_results: strictObject({
    result: ArticleResultSchema.optional(),
  }),
});
export type Article = z.infer<typeof ArticleSchema>;

/** 卡片平台设备信息。 */
export const CardPlatformSchema = strictObject({
  platform: strictObject({
    audience: strictObject({
      name: z.string().optional(),
    }).optional(),
    device: strictObject({
      name: z.string().optional(),
      version: z.string().optional(),
    }).optional(),
  }).optional(),
});
export type CardPlatform = z.infer<typeof CardPlatformSchema>;

/** 卡片 legacy。 */
export const CardLegacySchema = strictObject({
  binding_values: z.array(CardBindingValueSchema).optional(),
  card_platform: CardPlatformSchema.optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  user_refs_results: z.array(UserResultContainerSchema).optional(),
});
export type CardLegacy = z.infer<typeof CardLegacySchema>;

/** 帖子卡片。 */
export const CardSchema = strictObject({
  legacy: CardLegacySchema,
  rest_id: z.string(),
});
export type Card = z.infer<typeof CardSchema>;

/** 轻量帖子引用。常见于 `quotedRefResult`。 */
export const TweetReferenceSchema = strictObject({
  __typename: z.literal('Tweet'),
  rest_id: z.string(),
});
export type TweetReference = z.infer<typeof TweetReferenceSchema>;

/** 轻量帖子引用容器。 */
export const TweetReferenceEnvelopeSchema = strictObject({
  result: TweetReferenceSchema,
});
export type TweetReferenceEnvelope = z.infer<typeof TweetReferenceEnvelopeSchema>;

/** 地点边界框。 */
export const PlaceBoundingBoxSchema = strictObject({
  coordinates: z.array(z.array(z.array(z.number()))).optional(),
  type: z.string().optional(),
});
export type PlaceBoundingBox = z.infer<typeof PlaceBoundingBoxSchema>;

/** 地点对象。 */
export const PlaceSchema = strictObject({
  bounding_box: PlaceBoundingBoxSchema.optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
  full_name: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  place_type: z.string().optional(),
  url: z.string().optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

export const TweetResultEnvelopeSchema: z.ZodType<TweetResultEnvelope> = z.lazy(() => strictObject({
  result: TweetResultSchema,
}));

export const OptionalTweetResultEnvelopeSchema: z.ZodType<OptionalTweetResultEnvelope> = z.lazy(() => strictObject({
  result: TweetResultSchema.optional(),
}));

/** 帖子 core，目前核心是作者用户结果。 */
export const TweetCoreSchema = strictObject({
  user_results: UserResultContainerSchema,
});
export type TweetCore = z.infer<typeof TweetCoreSchema>;

/** 帖子 legacy 载荷。 */
export const TweetLegacySchema: z.ZodType<TweetLegacy> = z.lazy(() => strictObject({
  bookmark_count: z.number().optional(),
  bookmarked: z.boolean().optional(),
  conversation_control: ConversationControlSchema.optional(),
  conversation_id_str: z.string(),
  created_at: z.string(),
  display_text_range: z.array(z.number()).optional(),
  entities: TweetEntitiesSchema,
  extended_entities: strictObject({
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
  place: PlaceSchema.optional(),
  possibly_sensitive: z.boolean().optional(),
  possibly_sensitive_editable: z.boolean().optional(),
  quote_count: z.number().optional(),
  quoted_status_id_str: z.string().optional(),
  quoted_status_permalink: QuotedStatusPermalinkSchema.optional(),
  reply_count: z.number().optional(),
  retweet_count: z.number().optional(),
  retweeted: z.boolean().optional(),
  retweeted_status_result: TweetResultEnvelopeSchema.optional(),
  scopes: strictObject({
    followers: z.boolean().optional(),
  }).optional(),
  user_id_str: z.string(),
}));

function createTweetDataShape() {
  return {
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
  note_tweet: NoteTweetSchema.optional(),
  previous_counts: PreviousCountsSchema.optional(),
  quotedRefResult: TweetReferenceEnvelopeSchema.optional(),
  quick_promote_eligibility: QuickPromoteEligibilitySchema.optional(),
  quoted_status_result: OptionalTweetResultEnvelopeSchema.optional(),
  rest_id: z.string(),
  source: z.string().optional(),
  unmention_data: UnmentionDataSchema.optional(),
  views: ViewsSchema.optional(),
  };
}

/**
 * 原始帖子载荷。
 *
 * 注意：在 `TweetWithVisibilityResults.tweet` 中，当前样本未出现 `__typename`。
 */
export const TweetDataSchema = z.lazy(() => strictObject(createTweetDataShape()));

/** 原始 `Tweet` 对象。 */
export const TweetSchema = z.lazy(() => strictObject({
  __typename: z.literal('Tweet'),
  ...createTweetDataShape(),
}));

/**
 * `TweetWithVisibilityResults` 包装对象。
 *
 * 当前样本中，包装层额外字段位于与 `tweet` 同级的位置。
 */
export const TweetWithVisibilityResultsSchema: z.ZodType<TweetWithVisibilityResults> = z.lazy(() => strictObject({
  __typename: z.literal('TweetWithVisibilityResults'),
  limitedActionResults: LimitedActionResultsSchema.optional(),
  mediaVisibilityResults: MediaVisibilityResultsSchema.optional(),
  tweet: TweetDataSchema,
}));

/**
 * `tweet_results.result` 的原始联合入口：
 * - 允许直接传入 `Tweet`
 * - 允许直接传入 `TweetWithVisibilityResults`
 * - 允许传入 `TweetTombstone`
 */
export const TweetResultSchema: z.ZodType<TweetResult> = z.lazy(() => z.union([
  TweetSchema,
  TweetWithVisibilityResultsSchema,
  TweetTombstoneSchema,
]));

//#region

/**
 * 递归结果容器。
 *
 * quoted / retweeted 结构都会包装成 `result` 字段，因此统一复用这一层容器。
 */
export interface TweetResultEnvelope {
  result: TweetResult;
}

export interface OptionalTweetResultEnvelope {
  result?: TweetResult;
}

/** 原始帖子 legacy 结构。 */
export interface TweetLegacy {
  bookmark_count?: number;
  bookmarked?: boolean;
  conversation_control?: ConversationControl;
  conversation_id_str: string;
  created_at: string;
  display_text_range?: number[];
  entities: TweetEntities;
  extended_entities?: {
    media: Media[];
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
  place?: Place;
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
  };
  user_id_str: string;
}

/** 原始帖子载荷。 */
export interface TweetData {
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
  note_tweet?: NoteTweet;
  previous_counts?: PreviousCounts;
  quotedRefResult?: TweetReferenceEnvelope;
  quick_promote_eligibility?: QuickPromoteEligibility;
  quoted_status_result?: OptionalTweetResultEnvelope;
  rest_id: string;
  source?: string;
  unmention_data?: UnmentionData;
  views?: Views;
}

/** 原始 `Tweet` 对象。 */
export interface Tweet extends TweetData {
  __typename: 'Tweet';
}

/** 原始 `TweetWithVisibilityResults` 包装对象。 */
export interface TweetWithVisibilityResults {
  __typename: 'TweetWithVisibilityResults';
  limitedActionResults?: LimitedActionResults;
  mediaVisibilityResults?: MediaVisibilityResults;
  tweet: TweetData;
}

/** `tweet_results.result` 最终可能返回的联合结果。 */
export type TweetResult = Tweet | TweetWithVisibilityResults | TweetTombstone;

/** 从原始联合结果中提取最终帖子对象；墓碑结果返回 `null`。 */
export function getTweetFromResult(result: TweetResult): TweetData | null {
  if (result.__typename === 'Tweet') return result;
  if (result.__typename === 'TweetWithVisibilityResults') return result.tweet;
  return null;
}

/** 便于直接解析单个 `tweet_results.result` 节点。 */
export function parseTweetResult(input: unknown): TweetResult {
  return TweetResultSchema.parse(input);
}

//#endregion
