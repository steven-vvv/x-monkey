import { z } from 'zod';

/**
 * 面向业务语义重新整理后的 Tweet 数据模型。
 *
 * 设计原则：
 * 1. 不保留 `legacy`、`core`、`result`、`tweet` 等上游传输层包装。
 * 2. 按业务语义拆分为作者、内容、会话关系、统计、可见性、附注等清晰层级。
 * 3. 对重复字段只保留一个主字段，并在注释中写明原始获取路径。
 * 4. 当前明确不包含 `article` 与 `card`。
 */

function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject(shape);
}

const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();

/**
 * 文本中的区间范围，采用半开区间语义 `[start, end)`。
 */
export const TextRangeSchema = strictObject({
  start: nonNegativeInt,
  end: nonNegativeInt,
});

export type TextRange = z.infer<typeof TextRangeSchema>;

/**
 * 语义化字符串包装。
 * 对值域较稳定或概念边界清晰的字符串，统一保持 `z.string()`，
 * 仅通过命名强调其语义类型，不强制收紧为 `z.enum()`。
 */

/**
 * 富文本样式名称。
 * `dumps` 样本值: `Bold`, `Italic`
 */
export const TweetTextStyleNameSchema = z.string();
export type TweetTextStyleName = z.infer<typeof TweetTextStyleNameSchema>;

/**
 * 用户认证类型。
 * `dumps` 样本值: `Business`, `Government`
 */
export const TweetUserVerificationTypeSchema = z.string();
export type TweetUserVerificationType = z.infer<typeof TweetUserVerificationTypeSchema>;

/**
 * 用户职业账号类型。
 * `dumps` 样本值: `Creator`, `Business`
 */
export const TweetUserProfessionalTypeSchema = z.string();
export type TweetUserProfessionalType = z.infer<typeof TweetUserProfessionalTypeSchema>;

/**
 * 用户账号披露关系类型。
 * 领域值: `affiliated_with`, `operated_by`, `unknown`
 */
export const TweetUserDisclosureRelationSchema = z.string();
export type TweetUserDisclosureRelation = z.infer<typeof TweetUserDisclosureRelationSchema>;

/**
 * 账号声明标签类型。
 * `dumps` 样本值: `None`, `Parody`, `Commentary`, `Fan`
 */
export const TweetUserParodyLabelSchema = z.string();
export type TweetUserParodyLabel = z.infer<typeof TweetUserParodyLabelSchema>;

/**
 * 用户头像形状类型。
 * `dumps` 样本值: `Circle`, `Square`
 */
export const TweetUserAvatarShapeSchema = z.string();
export type TweetUserAvatarShape = z.infer<typeof TweetUserAvatarShapeSchema>;

/**
 * 国家名称。
 * `dumps` 样本值: `United States`, `Canada`, `Japan`, `North Korea`
 */
export const TweetCountryNameSchema = z.string();
export type TweetCountryName = z.infer<typeof TweetCountryNameSchema>;

/**
 * 国家代码。
 * `dumps` 样本值: `US`, `CA`, `JP`, `KP`
 */
export const TweetCountryCodeSchema = z.string();
export type TweetCountryCode = z.infer<typeof TweetCountryCodeSchema>;

/**
 * 语言代码。
 * `dumps` 样本值:
 * `zh`, `en`, `ja`, `qme`, `zxx`, `ar`, `und`, `hu`,
 * `fr`, `es`, `qam`, `pt`, `tr`, `de`, `lt`, `in`, `fi`
 */
export const TweetLanguageCodeSchema = z.string();
export type TweetLanguageCode = z.infer<typeof TweetLanguageCodeSchema>;

/**
 * 媒体可用性状态。
 * `dumps` 样本值: `Available`
 */
export const TweetMediaAvailabilityStatusSchema = z.string();
export type TweetMediaAvailabilityStatus = z.infer<typeof TweetMediaAvailabilityStatusSchema>;

/**
 * 媒体敏感性提示代码。
 * 当前样本值: `adult_content`, `graphic_violence`, `other`
 *
 * 为兼容上游未来新增类别，运行时不收紧为 `z.enum()`。
 */
export const TweetMediaSensitivityCodeSchema = z.string();
export type TweetMediaSensitivityCode = z.infer<typeof TweetMediaSensitivityCodeSchema>;

/**
 * 媒体标签种类。
 * `dumps` 样本值: `user`
 */
export const TweetMediaTagKindSchema = z.string();
export type TweetMediaTagKind = z.infer<typeof TweetMediaTagKindSchema>;

/**
 * 媒体尺寸调整模式。
 * `dumps` 样本值: `fit`, `crop`
 */
export const TweetMediaResizeModeSchema = z.string();
export type TweetMediaResizeMode = z.infer<typeof TweetMediaResizeModeSchema>;

/**
 * 视频流内容类型。
 * `dumps` 样本值: `video/mp4`, `application/x-mpegURL`
 */
export const TweetVideoContentTypeSchema = z.string();
export type TweetVideoContentType = z.infer<typeof TweetVideoContentTypeSchema>;

/**
 * 地点分类。
 * `dumps` 样本值: `city`, `country`
 */
export const TweetPlaceKindSchema = z.string();
export type TweetPlaceKind = z.infer<typeof TweetPlaceKindSchema>;

/**
 * 回复策略代码。
 * `dumps` 样本值: `ByInvitation`, `MyNetwork`, `Community`
 */
export const TweetReplyPolicyCodeSchema = z.string();
export type TweetReplyPolicyCode = z.infer<typeof TweetReplyPolicyCodeSchema>;

/**
 * 帖子动作代码。
 * `dumps` 样本值:
 * `Reply`, `QuoteTweet`, `CopyLink`, `Like`, `VoteOnPoll`, `AddToMoment`,
 * `PinToProfile`, `ShareTweetVia`, `React`, `Embed`, `Retweet`,
 * `SendViaDm`, `AddToBookmarks`, `HideCommunityTweet`, `ViewTweetActivity`
 */
export const TweetActionCodeSchema = z.string();
export type TweetActionCode = z.infer<typeof TweetActionCodeSchema>;

/**
 * 帖子来源标签。
 * 归一化后为纯文本来源名，原始 `dumps` 字段为 HTML 链接。
 * 归一化样本值:
 * `Twitter Web Client`, `Twitter for iPad`, `Twitter for Android`,
 * `Twitter for iPhone`, `WSC Sports`, `HubSpot`, `Twitter Ads`, `Buffer`
 */
export const TweetSourceLabelSchema = z.string();
export type TweetSourceLabel = z.infer<typeof TweetSourceLabelSchema>;

/**
 * 富文本样式区间。
 * 来源: `note_tweet.note_tweet_results.result.richtext.richtext_tags[]`
 */
export const TextStyleRangeSchema = strictObject({
  range: TextRangeSchema,
  styles: z.array(TweetTextStyleNameSchema),
});

export type TextStyleRange = z.infer<typeof TextStyleRangeSchema>;

/**
 * 不带文本区间的普通链接。
 * 来源汇总:
 * - `url`: `*.url`
 * - `expandedUrl`: `*.expanded_url` / `*.expanded`
 * - `displayText`: `*.display_url` / `*.display`
 */
export const ResolvedUrlSchema = strictObject({
  url: z.string(),
  expandedUrl: z.string(),
  displayText: z.string(),
});

export type ResolvedUrl = z.infer<typeof ResolvedUrlSchema>;

/**
 * 文本中的哈希标签实体。
 */
export const HashtagEntitySchema = strictObject({
  text: z.string(),
  range: TextRangeSchema,
});

export type HashtagEntity = z.infer<typeof HashtagEntitySchema>;

/**
 * 文本中的股票/符号实体。
 */
export const SymbolEntitySchema = strictObject({
  text: z.string(),
  range: TextRangeSchema.optional(),
  ticker: z.string().optional(),
  name: z.string().optional(),
});

export type SymbolEntity = z.infer<typeof SymbolEntitySchema>;

/**
 * 文本中的 URL 实体。
 */
export const UrlEntitySchema = strictObject({
  url: z.string(),
  expandedUrl: z.string(),
  displayText: z.string(),
  range: TextRangeSchema,
});

export type UrlEntity = z.infer<typeof UrlEntitySchema>;

/**
 * 文本中的 @ 提及实体。
 */
export const MentionEntitySchema = strictObject({
  userId: z.string(), // `user_mentions[].id_str`，样本为纯数字用户雪花 ID，可用 BIGINT 存储。
  name: z.string(),
  userName: z.string(),
  range: TextRangeSchema,
});

export type MentionEntity = z.infer<typeof MentionEntitySchema>;

/**
 * 一段文本中包含的可解析实体集合。
 */
export const TextEntitiesSchema = strictObject({
  hashtags: z.array(HashtagEntitySchema),
  symbols: z.array(SymbolEntitySchema),
  urls: z.array(UrlEntitySchema),
  mentions: z.array(MentionEntitySchema),
  media: z.array(z.lazy(() => MediaEntitySchema)),
});

export type TextEntities = z.infer<typeof TextEntitiesSchema>;

/**
 * 一段带实体信息的文本。
 * 来源汇总:
 * - `text`: `legacy.full_text` / `note_tweet.note_tweet_results.result.text` / `legacy.description`
 * - `displayRange`: `legacy.display_text_range`
 * - `entities.hashtags`: `*.entities.hashtags`
 * - `entities.symbols`: `*.entities.symbols`
 * - `entities.urls`: `*.entities.urls`
 * - `entities.mentions`: `*.entities.user_mentions`
 * - `entities.media`: `legacy.entities.media`，缺失时回退到 `legacy.extended_entities.media`
 * - `styles`: `note_tweet.note_tweet_results.result.richtext.richtext_tags`
 */
export const AnnotatedTextSchema = strictObject({
  text: z.string(),
  displayRange: TextRangeSchema.optional(),
  entities: TextEntitiesSchema,
  styles: z.array(TextStyleRangeSchema).optional(),
});

export type AnnotatedText = z.infer<typeof AnnotatedTextSchema>;

/**
 * 用户职业分类。
 * 来源: `professional.category[].id` / `professional.category[].name`
 */
export const TweetUserCategorySchema = strictObject({
  id: z.string(), // `professional.category[].id`，样本为小整数分类编码（如 580/713/1017），非雪花 ID。
  name: z.string(),
});

export type TweetUserCategory = z.infer<typeof TweetUserCategorySchema>;

/**
 * 用户认证信息。
 * 来源汇总:
 * - `isBlueVerified`: `is_blue_verified`
 * - `type`: `verification.verified_type`
 */
export const TweetUserVerificationSchema = strictObject({
  isBlueVerified: z.boolean().optional(),
  type: TweetUserVerificationTypeSchema.optional(),
});

export type TweetUserVerification = z.infer<typeof TweetUserVerificationSchema>;

/**
 * 用户职业账号信息。
 * 来源汇总:
 * - `id`: `professional.rest_id`
 * - `type`: `professional.professional_type`
 * - `categories`: `professional.category`
 */
export const TweetUserProfessionalSchema = strictObject({
  id: z.string().optional(), // `professional.rest_id`，样本为纯数字长 ID，按雪花 ID 处理，可用 BIGINT 存储。
  type: TweetUserProfessionalTypeSchema.optional(),
  categories: z.array(TweetUserCategorySchema),
});

export type TweetUserProfessional = z.infer<typeof TweetUserProfessionalSchema>;

/**
 * 用户交互统计。
 * 来源汇总:
 * - `followers`: `legacy.followers_count`
 * - `following`: `legacy.friends_count`
 * - `likes`: `legacy.favourites_count`
 * - `mediaPosts`: `legacy.media_count`
 * - `tweets`: `legacy.statuses_count`
 * - `listed`: `legacy.listed_count`
 */
export const TweetUserStatsSchema = strictObject({
  followers: nonNegativeInt.optional(),
  following: nonNegativeInt.optional(),
  likes: nonNegativeInt.optional(),
  mediaPosts: nonNegativeInt.optional(),
  tweets: nonNegativeInt.optional(),
  listed: nonNegativeInt.optional(),
});

export type TweetUserStats = z.infer<typeof TweetUserStatsSchema>;

/**
 * 用户可用功能与账户交互特征。
 * 来源汇总:
 * - `canDm`: `dm_permissions.can_dm`
 * - `canTagMedia`: `media_permissions.can_media_tag`
 * - `isProtected`: `privacy.protected`
 * - `canBeSubscribed`: `super_follow_eligible`
 */
export const TweetUserFeaturesSchema = strictObject({
  canDm: z.boolean().optional(),
  canTagMedia: z.boolean().optional(),
  isProtected: z.boolean().optional(),
  canBeSubscribed: z.boolean().optional(),
});

export type TweetUserFeatures = z.infer<typeof TweetUserFeaturesSchema>;

/**
 * 用户账号披露关系。
 * 来源汇总:
 * - `relation`:
 *   - `affiliated_with`: `affiliates_highlighted_label.label.userLabelType = BusinessLabel`
 *   - `operated_by`: `affiliates_highlighted_label.label.userLabelType = AutomatedLabel`
 *   - `unknown`: 其余存在 `label` 但无法归入已知关系的情况
 * - `subjectId`: `affiliates_highlighted_label.label.longDescription.entities[].ref.mention_results.result.rest_id`
 * - `subjectHandle`:
 *   - `affiliates_highlighted_label.label.longDescription.entities[].ref.screen_name`
 *   - 或由 `affiliates_highlighted_label.label.url.url` 推导
 * - `subjectName`: `affiliates_highlighted_label.label.description`
 * - `subjectUrl`: `affiliates_highlighted_label.label.url.url`
 */
export const TweetUserDisclosureSchema = strictObject({
  relation: TweetUserDisclosureRelationSchema,
  subjectId: z.string().optional(),
  subjectHandle: z.string().optional(),
  subjectName: z.string().optional(),
  subjectUrl: z.string().optional(),
});

export type TweetUserDisclosure = z.infer<typeof TweetUserDisclosureSchema>;

/**
 * 用户身份标识。
 * 来源汇总:
 * - `verification`: `verification` / `is_blue_verified`
 * - `disclosure`: `affiliates_highlighted_label.label`
 * - `parodyLabel`: `parody_commentary_fan_label`
 * - `hasCompletedNewAccountReview`: `has_graduated_access`
 * - `isPossiblySensitive`: `legacy.possibly_sensitive`
 */
export const TweetUserIdentitySchema = strictObject({
  verification: TweetUserVerificationSchema.optional(),
  disclosure: TweetUserDisclosureSchema.optional(),
  parodyLabel: TweetUserParodyLabelSchema.optional(),
  hasCompletedNewAccountReview: z.boolean().optional(),
  isPossiblySensitive: z.boolean().optional(),
});

export type TweetUserIdentity = z.infer<typeof TweetUserIdentitySchema>;

/**
 * 用户资料信息。
 * 来源汇总:
 * - `displayName`: `core.name`
 * - `userName`: `core.screen_name`
 * - `avatarUrl`: `avatar.image_url`
 * - `usesDefaultAvatar`: `legacy.default_profile_image`
 * - `avatarShape`: `profile_image_shape`
 * - `bannerUrl`: `legacy.profile_banner_url`
 * - `bio`: `legacy.description` + `legacy.entities.description.urls`
 * - `profileLinks`: `legacy.entities.url.urls`
 * - `location`: `location.location`
 */
export const TweetUserProfileSchema = strictObject({
  displayName: z.string(),
  userName: z.string(),
  avatarUrl: z.string().optional(),
  usesDefaultAvatar: z.boolean().optional(),
  avatarShape: TweetUserAvatarShapeSchema.optional(),
  bannerUrl: z.string().optional(),
  location: z.string().optional(),
  bio: AnnotatedTextSchema.optional(),
  profileLinks: z.array(ResolvedUrlSchema),
});

export type TweetUserProfile = z.infer<typeof TweetUserProfileSchema>;

/**
 * Tweet 关联用户。
 * 该类型本身是用户语义对象，在 `Tweet.author` 中作为作者使用。
 *
 * 来源汇总:
 * - `id`: `rest_id`
 * - `createdAt`: `core.created_at`
 * - `pinnedTweetIds`: `legacy.pinned_tweet_ids_str`
 * - `profile`: `core` / `avatar` / `legacy` / `location` / `profile_image_shape`
 * - `identity`: `verification` / `is_blue_verified` / `affiliates_highlighted_label`
 *   / `parody_commentary_fan_label` / `has_graduated_access` / `legacy.possibly_sensitive`
 * - `professional`: `professional`
 * - `stats`: `legacy.*_count`
 * - `features`: `dm_permissions` / `media_permissions` / `privacy` / `super_follow_eligible`
 */
export const TweetUserSchema = strictObject({
  id: z.string(), // `rest_id`，样本为纯数字用户雪花 ID，可用 BIGINT 存储。
  createdAt: z.string().optional(),
  profile: TweetUserProfileSchema,
  pinnedTweetIds: z.array(z.string()), // `pinned_tweet_ids_str`，帖子雪花 ID 列表，可用 BIGINT 存储。
  identity: TweetUserIdentitySchema.optional(),
  professional: TweetUserProfessionalSchema.optional(),
  stats: TweetUserStatsSchema.optional(),
  features: TweetUserFeaturesSchema.optional(),
});

export type TweetUser = z.infer<typeof TweetUserSchema>;

/**
 * 媒体中的矩形区域，例如焦点区域或面部框。
 */
export const MediaRectSchema = strictObject({
  x: nonNegativeInt,
  y: nonNegativeInt,
  width: positiveInt,
  height: positiveInt,
});

export type MediaRect = z.infer<typeof MediaRectSchema>;

/**
 * 媒体按尺寸区分的图片信息。
 */
export const MediaVariantSchema = strictObject({
  width: positiveInt,
  height: positiveInt,
  resizeMode: TweetMediaResizeModeSchema,
});

export type MediaVariant = z.infer<typeof MediaVariantSchema>;

/**
 * 媒体各尺寸版本。
 */
export const MediaVariantsSchema = strictObject({
  large: MediaVariantSchema.optional(),
  medium: MediaVariantSchema.optional(),
  small: MediaVariantSchema.optional(),
  thumb: MediaVariantSchema.optional(),
});

export type MediaVariants = z.infer<typeof MediaVariantsSchema>;

/**
 * 媒体中圈出的用户。
 */
export const TweetMediaTagSchema = strictObject({
  userId: z.string().optional(), // `features.*.tags[].user_id`，样本为纯数字用户雪花 ID，可用 BIGINT 存储。
  name: z.string().optional(),
  userName: z.string().optional(),
  kind: TweetMediaTagKindSchema.optional(),
});

export type TweetMediaTag = z.infer<typeof TweetMediaTagSchema>;

/**
 * 按尺寸划分的人脸检测结果。
 */
export const TweetMediaFacesSchema = strictObject({
  large: z.array(MediaRectSchema).optional(),
  medium: z.array(MediaRectSchema).optional(),
  small: z.array(MediaRectSchema).optional(),
  thumb: z.array(MediaRectSchema).optional(),
  original: z.array(MediaRectSchema).optional(),
});

export type TweetMediaFaces = z.infer<typeof TweetMediaFacesSchema>;

/**
 * 视频流变体。
 */
export const TweetVideoVariantSchema = strictObject({
  contentType: TweetVideoContentTypeSchema,
  bitrate: nonNegativeInt.optional(),
  url: z.string(),
});

export type TweetVideoVariant = z.infer<typeof TweetVideoVariantSchema>;

/**
 * 视频附加信息。
 */
export const TweetVideoSchema = strictObject({
  aspectRatio: z.tuple([positiveInt, positiveInt]).optional(),
  durationMs: nonNegativeInt.optional(),
  variants: z.array(TweetVideoVariantSchema),
});

export type TweetVideo = z.infer<typeof TweetVideoSchema>;

/**
 * 媒体几何信息。
 */
export const TweetMediaGeometrySchema = strictObject({
  width: positiveInt,
  height: positiveInt,
  focusRects: z.array(MediaRectSchema),
});

export type TweetMediaGeometry = z.infer<typeof TweetMediaGeometrySchema>;

/**
 * 文本媒体引用中的来源信息。
 * 来源汇总:
 * - `tweetId`: `extended_entities.media[].source_status_id_str`
 * - `userId`: `extended_entities.media[].source_user_id_str`
 */
export const MediaEntityOriginSchema = strictObject({
  tweetId: z.string().optional(), // `source_status_id_str`，样本为纯数字帖子雪花 ID，可用 BIGINT 存储。
  userId: z.string().optional(), // `source_user_id_str`，样本为纯数字用户雪花 ID，可用 BIGINT 存储。
});

export type MediaEntityOrigin = z.infer<typeof MediaEntityOriginSchema>;

/**
 * 媒体溯源信息。
 * 来源汇总:
 * - `tweetId`: `extended_entities.media[].source_status_id_str`
 * - `userId`: `extended_entities.media[].source_user_id_str`
 * - `user`: `extended_entities.media[].additional_media_info.source_user.user_results.result`
 */
export const TweetMediaOriginSchema = strictObject({
  tweetId: z.string().optional(), // `source_status_id_str`，样本为纯数字帖子雪花 ID，可用 BIGINT 存储。
  userId: z.string().optional(), // `source_user_id_str`，样本为纯数字用户雪花 ID，可用 BIGINT 存储。
  user: TweetUserSchema.optional(),
});

export type TweetMediaOrigin = z.infer<typeof TweetMediaOriginSchema>;

/**
 * 文本中的媒体引用实体。
 * 来源汇总:
 * - `mediaId`: `*.entities.media[].id_str`
 * - `range`: `*.entities.media[].indices`
 * - `displayText`: `*.entities.media[].display_url`
 * - `expandedUrl`: `*.entities.media[].expanded_url`
 * - `url`: `*.entities.media[].url`
 * - `origin`: `*.entities.media[].source_status_id_str` / `*.entities.media[].source_user_id_str`
 */
export const MediaEntitySchema = strictObject({
  mediaId: z.string(), // `entities.media[].id_str`，样本为纯数字长媒体 ID，按雪花 ID 处理，可用 BIGINT 存储。
  range: TextRangeSchema.optional(),
  displayText: z.string().optional(),
  expandedUrl: z.string().optional(),
  url: z.string().optional(),
  origin: MediaEntityOriginSchema.optional(),
});

export type MediaEntity = z.infer<typeof MediaEntitySchema>;

/**
 * 媒体附加信息。
 */
export const TweetMediaDetailsSchema = strictObject({
  title: z.string().optional(),
  description: z.string().optional(),
  siteUrl: z.string().optional(),
  isEmbeddable: z.boolean().optional(),
  isMonetizable: z.boolean().optional(),
});

export type TweetMediaDetails = z.infer<typeof TweetMediaDetailsSchema>;

/**
 * Tweet 媒体对象。
 * 来源汇总:
 * - `id`: `legacy.extended_entities.media[].id_str`
 * - `type`: `legacy.extended_entities.media[].type`
 * - `mediaUrl`: `legacy.extended_entities.media[].media_url_https`
 * - `altText`: `legacy.extended_entities.media[].ext_alt_text`
 * - `grokPostId`: `legacy.extended_entities.media[].grok_post_id`
 * - `geometry`: `legacy.extended_entities.media[].original_info`
 * - `variants`: `legacy.extended_entities.media[].sizes`
 * - `taggedUsers`: `legacy.extended_entities.media[].features.all.tags`
 * - `faces`: `legacy.extended_entities.media[].features.large|medium|small|thumb|orig.faces`
 * - `origin`: `legacy.extended_entities.media[].source_status_id_str` / `legacy.extended_entities.media[].source_user_id_str`
 *   / `legacy.extended_entities.media[].additional_media_info.source_user.user_results.result`
 * - `details`: `legacy.extended_entities.media[].additional_media_info`（不含 `source_user`）
 * - `sensitivityWarnings`: `legacy.extended_entities.media[].sensitive_media_warning` 中值为 `true` 的键列表
 * - `availability`: `legacy.extended_entities.media[].ext_media_availability.status`
 * - `video`: `legacy.extended_entities.media[].video_info`
 */
export const TweetMediaSchema = strictObject({
  id: z.string(), // `extended_entities.media[].id_str`，样本为纯数字长媒体 ID，按雪花 ID 处理，可用 BIGINT 存储。
  type: z.enum(['photo', 'video', 'animated_gif']),
  mediaUrl: z.string().optional(),
  altText: z.string().optional(),
  grokPostId: z.string().optional(), // `grok_post_id`，样本为 UUID 风格字符串，非雪花 ID。
  geometry: TweetMediaGeometrySchema.optional(),
  variants: MediaVariantsSchema.optional(),
  taggedUsers: z.array(TweetMediaTagSchema),
  faces: TweetMediaFacesSchema.optional(),
  origin: TweetMediaOriginSchema.optional(),
  details: TweetMediaDetailsSchema.optional(),
  sensitivityWarnings: z.array(TweetMediaSensitivityCodeSchema).optional(),
  availability: TweetMediaAvailabilityStatusSchema.optional(),
  video: TweetVideoSchema.optional(),
});

export type TweetMedia = z.infer<typeof TweetMediaSchema>;

/**
 * 地理坐标点。经纬度顺序采用平台原始顺序：先经度，后纬度。
 */
export const GeoPointSchema = strictObject({
  longitude: z.number(),
  latitude: z.number(),
});

export type GeoPoint = z.infer<typeof GeoPointSchema>;

/**
 * 地点边界。
 */
export const TweetPlaceBoundarySchema = z.array(GeoPointSchema);

export type TweetPlaceBoundary = z.infer<typeof TweetPlaceBoundarySchema>;

/**
 * 帖子地点信息。
 * 来源汇总:
 * - `id`: `legacy.place.id`
 * - `name`: `legacy.place.name`
 * - `fullName`: `legacy.place.full_name`
 * - `country`: `legacy.place.country`
 * - `countryCode`: `legacy.place.country_code`
 * - `kind`: `legacy.place.place_type`
 * - `boundary`: `legacy.place.bounding_box.coordinates[0][]`
 */
export const TweetPlaceSchema = strictObject({
  id: z.string().optional(), // `legacy.place.id`，当前按地点字符串标识处理，非雪花 ID。
  name: z.string().optional(),
  fullName: z.string().optional(),
  country: TweetCountryNameSchema.optional(),
  countryCode: TweetCountryCodeSchema.optional(),
  kind: TweetPlaceKindSchema.optional(),
  boundary: TweetPlaceBoundarySchema.optional(),
});

export type TweetPlace = z.infer<typeof TweetPlaceSchema>;

/**
 * Note Tweet 长文内容。
 * 来源汇总:
 * - `id`: `note_tweet.note_tweet_results.result.id`
 * - `text`: `note_tweet.note_tweet_results.result.text`
 * - `text.entities`: `note_tweet.note_tweet_results.result.entity_set`
 * - `text.styles`: `note_tweet.note_tweet_results.result.richtext.richtext_tags`
 */
export const TweetNoteSchema = strictObject({
  id: z.string().optional(), // `note_tweet.note_tweet_results.result.id`，样本为 `Tm90ZVR3ZWV0:...` Base64 风格字符串，非雪花 ID。
  text: AnnotatedTextSchema,
});

export type TweetNote = z.infer<typeof TweetNoteSchema>;

/**
 * 帖子正文内容。
 * 来源汇总:
 * - `legacyText`: `legacy.full_text` + `legacy.entities`
 * - `note`: `note_tweet.note_tweet_results.result`
 * - `media`: `legacy.extended_entities.media`，缺失时回退到 `legacy.entities.media`
 * - `language`: `legacy.lang`
 */
export const TweetContentSchema = strictObject({
  legacyText: AnnotatedTextSchema,
  note: TweetNoteSchema.optional(),
  media: z.array(TweetMediaSchema),
  language: TweetLanguageCodeSchema.optional(),
});

export type TweetContent = z.infer<typeof TweetContentSchema>;

/**
 * 回复目标。
 */
export const TweetReplyTargetSchema = strictObject({
  tweetId: z.string(), // `in_reply_to_status_id_str`，样本为纯数字帖子雪花 ID，可用 BIGINT 存储。
  userId: z.string().optional(), // `in_reply_to_user_id_str`，样本为纯数字用户雪花 ID，可用 BIGINT 存储。
  userName: z.string().optional(),
});

export type TweetReplyTarget = z.infer<typeof TweetReplyTargetSchema>;

/**
 * 引用推文的链接。
 */
export const TweetPermalinkSchema = strictObject({
  url: z.string(),
  expandedUrl: z.string(),
  displayText: z.string(),
});

export type TweetPermalink = z.infer<typeof TweetPermalinkSchema>;

/**
 * 引用关系。
 */
export interface TweetQuote {
  /**
   * 被引用帖子 ID。
   * 来源: `legacy.quoted_status_id_str` / `quotedRefResult.result.rest_id` / `quoted_status_result.result.rest_id` / `quoted_status_result.result.legacy.id_str`
   * 类型说明: 样本为纯数字帖子雪花 ID，可用 BIGINT 存储。
   */
  tweetId: string; // 帖子雪花 ID，可用 BIGINT 存储。

  /**
   * 被引用帖子的链接信息。
   * 来源: `legacy.quoted_status_permalink`
   */
  permalink?: TweetPermalink;

  /**
   * 被引用帖子的完整对象。
   * 来源: `quoted_status_result.result`
   *
   * 当上游为了避免继续展开嵌套而仅返回 `quotedRefResult` 时，此字段为空，
   * 此时仅通过 `tweetId` 表示下一层引用目标。
   */
  tweet?: Tweet;
}

/**
 * 会话关系。
 */
export interface TweetConversation {
  /**
   * 会话主 ID。
   * 来源: `legacy.conversation_id_str`
   * 类型说明: 样本为纯数字帖子雪花 ID；通常等于会话根帖 ID，可用 BIGINT 存储。
   */
  conversationId: string; // 会话根帖雪花 ID，可用 BIGINT 存储。

  /**
   * 当前帖子回复到的目标。
   * 来源: `legacy.in_reply_to_status_id_str` / `legacy.in_reply_to_user_id_str` / `legacy.in_reply_to_screen_name`
   */
  replyTo?: TweetReplyTarget;

  /**
   * 当前帖子引用的目标。
   */
  quote?: TweetQuote;

  /**
   * 当前帖子转贴的目标。
   * 来源: `legacy.retweeted_status_result.result`
   */
  repost?: Tweet;
}

/**
 * 统计信息。
 * 来源汇总:
 * - `views`: `views.count`
 * - `replies`: `legacy.reply_count`
 * - `reposts`: `legacy.retweet_count`
 * - `quotes`: `legacy.quote_count`
 * - `likes`: `legacy.favorite_count`
 * - `bookmarks`: `legacy.bookmark_count`
 */
export const TweetStatsSchema = strictObject({
  views: z.string().optional(),
  replies: nonNegativeInt.optional(),
  reposts: nonNegativeInt.optional(),
  quotes: nonNegativeInt.optional(),
  likes: nonNegativeInt.optional(),
  bookmarks: nonNegativeInt.optional(),
});

export type TweetStats = z.infer<typeof TweetStatsSchema>;

/**
 * 编辑信息。
 * 来源汇总:
 * - `versionIds`: `edit_control.edit_tweet_ids`
 * - `editableUntilAt`: `edit_control.editable_until_msecs`
 * - `remainingEdits`: `edit_control.edits_remaining`
 */
export const TweetEditInfoSchema = strictObject({
  versionIds: z.array(z.string()), // `edit_tweet_ids`，帖子历史版本雪花 ID 列表，可用 BIGINT 存储。
  editableUntilAt: z.string().optional(),
  remainingEdits: z.string().optional(),
});

export type TweetEditInfo = z.infer<typeof TweetEditInfoSchema>;

/**
 * 帖子策略。
 *
 * 该对象统一承载平台对帖子的访问范围、互动限制、敏感内容标记、
 * 媒体遮罩提示与商业披露等策略性信息。
 *
 * 来源汇总:
 * - `replyPolicy`: `legacy.conversation_control.policy`
 * - `followersOnly`: `legacy.scopes.followers`
 * - `isPossiblySensitive`: `legacy.possibly_sensitive`
 * - `availableActions`: `limitedActionResults.limited_actions[].action`
 * - `isMediaVisibilityRestricted`: `mediaVisibilityResults.blurred_image_interstitial`
 * - `paidPromotion`: `content_disclosure.advertising_disclosure.is_paid_promotion`
 */
export const TweetPolicySchema = strictObject({
  replyPolicy: TweetReplyPolicyCodeSchema.optional(),
  followersOnly: z.boolean().optional(),
  isPossiblySensitive: z.boolean().optional(),
  availableActions: z.array(TweetActionCodeSchema).optional(),
  isMediaVisibilityRestricted: z.boolean().optional(),
  paidPromotion: z.boolean().optional(),
});

export type TweetPolicy = z.infer<typeof TweetPolicySchema>;

/**
 * 社区附注展示信息。
 * 来源汇总:
 * - `id`: `birdwatch_pivot.note.rest_id`
 * - `title`: `birdwatch_pivot.title`
 * - `shortTitle`: `birdwatch_pivot.shorttitle`
 * - `subtitle`: `birdwatch_pivot.subtitle`
 * - `footer`: `birdwatch_pivot.footer`
 * - `destinationUrl`: `birdwatch_pivot.destinationUrl`
 */
export const TweetCommunityNoteSchema = strictObject({
  id: z.string().optional(), // `birdwatch_pivot.note.rest_id`，样本为纯数字长 ID，按雪花 ID 处理，可用 BIGINT 存储。
  title: z.string().optional(),
  shortTitle: z.string().optional(),
  subtitle: AnnotatedTextSchema.optional(),
  footer: AnnotatedTextSchema.optional(),
  destinationUrl: z.string().optional(),
});

export type TweetCommunityNote = z.infer<typeof TweetCommunityNoteSchema>;

/**
 * 重新整理后的 Tweet 领域模型。
 */
export interface Tweet {
  /**
   * 帖子唯一 ID。
   * 来源: `rest_id` / `legacy.id_str`
   * 类型说明: 样本为纯数字帖子雪花 ID，可用 BIGINT 存储。
   */
  id: string; // 帖子雪花 ID，可用 BIGINT 存储。

  /**
   * 标准化后的创建时间字符串。
   * 来源: `legacy.created_at`
   */
  createdAt: string;

  /**
   * 来源名称，建议提取为纯文本。
   * 来源: `source`
   */
  source?: TweetSourceLabel;

  /**
   * 地点信息。
   * 来源: `legacy.place`
   */
  place?: TweetPlace;

  /**
   * 作者信息。
   * 来源: `core.user_results.result`
   */
  author: TweetUser;

  /**
   * 正文、长文、媒体与语言等内容信息。
   */
  content: TweetContent;

  /**
   * 回复、引用、转贴等会话关系。
   */
  conversation: TweetConversation;

  /**
   * 互动统计。
   */
  stats: TweetStats;

  /**
   * 编辑相关信息。
   */
  edit?: TweetEditInfo;

  /**
   * 帖子策略信息。
   */
  policy?: TweetPolicy;

  /**
   * 社区附注。
   */
  communityNote?: TweetCommunityNote;
}

export const TweetQuoteSchema: z.ZodType<TweetQuote> = z.lazy(() => strictObject({
  tweetId: z.string(), // 帖子雪花 ID，可用 BIGINT 存储。
  permalink: TweetPermalinkSchema.optional(),
  tweet: TweetSchema.optional(),
}));

export const TweetConversationSchema: z.ZodType<TweetConversation> = z.lazy(() => strictObject({
  conversationId: z.string(), // 会话根帖雪花 ID，可用 BIGINT 存储。
  replyTo: TweetReplyTargetSchema.optional(),
  quote: TweetQuoteSchema.optional(),
  repost: TweetSchema.optional(),
}));

export const TweetSchema: z.ZodType<Tweet> = z.lazy(() => strictObject({
  id: z.string(), // 帖子雪花 ID，可用 BIGINT 存储。
  createdAt: z.string(),
  source: TweetSourceLabelSchema.optional(),
  place: TweetPlaceSchema.optional(),
  author: TweetUserSchema,
  content: TweetContentSchema,
  conversation: TweetConversationSchema,
  stats: TweetStatsSchema,
  edit: TweetEditInfoSchema.optional(),
  policy: TweetPolicySchema.optional(),
  communityNote: TweetCommunityNoteSchema.optional(),
}));

/**
 * 便于直接校验单个 Tweet 对象。
 */
export function parseTweet(input: unknown): Tweet {
  return TweetSchema.parse(input);
}
