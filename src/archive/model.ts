import { z } from 'zod';

/**
 * X 归档模型（v2）。
 *
 * 同一份结构同时用作 x-monkey 内存库记录、提交给 tweet-db 的线上格式，
 * 以及 tweet-db 原样保存的 source object。设计说明见 `design/x-archive-model.md`。
 *
 * 约定：
 * 1. 只有 `User`、`Post`、`Media` 三类独立实体，跨实体只用 ID 引用。
 * 2. 字段缺省表示“未知”：不写 `null`，不写空数组；合并时有值覆盖、缺省保留，数组整体替换。
 * 3. 文本区间为 Unicode 码点的半开区间 `[start, end)`。
 * 4. 时间为 UTC ISO-8601 秒精度；ID 为十进制字符串。
 * 5. 只存事实：不存观察者状态、UI 开关和可由其他字段推出的数据。
 */

function strictObject<T extends z.ZodRawShape>(shape: T) {
  return z.strictObject(shape);
}

const count = z.number().int().nonnegative();

/** X 雪花 ID。 */
export const IdSchema = z.string().regex(/^[1-9]\d*$/);
export type Id = z.infer<typeof IdSchema>;

/** UTC 时间，秒精度，如 `2026-10-05T05:10:30Z`。 */
export const InstantSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
export type Instant = z.infer<typeof InstantSchema>;

/** 码点半开区间 `[start, end)`。 */
export const RangeSchema = z.tuple([count, count]).refine(([start, end]) => end >= start, 'range end before start');
export type Range = z.infer<typeof RangeSchema>;

/** 原图坐标系中的矩形 `[x, y, width, height]`。 */
export const RectSchema = z.tuple([count, count, count, count]);
export type Rect = z.infer<typeof RectSchema>;

/**
 * 正文实体。能从 `text[range]` 推出的信息（t.co 短链、hashtag 文本、@handle、时间戳秒数）不存。
 */
export const EntitySchema = z.discriminatedUnion('type', [
  strictObject({ type: z.literal('url'), range: RangeSchema, expanded: z.string() }),
  strictObject({ type: z.literal('mention'), range: RangeSchema, userId: IdSchema }),
  strictObject({ type: z.literal('hashtag'), range: RangeSchema }),
  strictObject({ type: z.literal('cashtag'), range: RangeSchema, name: z.string().optional() }),
  strictObject({ type: z.literal('timestamp'), range: RangeSchema }),
]);
export type Entity = z.infer<typeof EntitySchema>;

/** 长推文富文本样式，样本值 `Bold`、`Italic`。 */
export const TextStyleSchema = strictObject({
  range: RangeSchema,
  styles: z.array(z.string()).min(1),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

/**
 * 带实体的文本。`text` 为用户实际写下的文本（已还原 X 的 HTML 转义）。
 * `visible` 缺省表示全文可见；回复时自动补全的 `@` 前缀与末尾媒体链接位于区间外。
 */
export const RichTextSchema = strictObject({
  text: z.string(),
  visible: RangeSchema.optional(),
  entities: z.array(EntitySchema).min(1).optional(),
  styles: z.array(TextStyleSchema).min(1).optional(),
});
export type RichText = z.infer<typeof RichTextSchema>;

export const UserCountsSchema = strictObject({
  followers: count.optional(),
  following: count.optional(),
  posts: count.optional(),
  mediaPosts: count.optional(),
  likes: count.optional(),
});
export type UserCounts = z.infer<typeof UserCountsSchema>;

/** 账号标签，来源 `affiliates_highlighted_label.label`。 */
export const AffiliationSchema = strictObject({
  name: z.string(),
  url: z.string().optional(),
  badgeUrl: z.string().optional(),
  /** `BusinessLabel`、`AutomatedLabel` 等。 */
  kind: z.string().optional(),
  /** 自动化账号的运营者。 */
  ownerId: IdSchema.optional(),
});
export type Affiliation = z.infer<typeof AffiliationSchema>;

export const UserSchema = strictObject({
  id: IdSchema,
  handle: z.string(),
  name: z.string(),
  createdAt: InstantSchema.optional(),
  avatarUrl: z.string().optional(),
  /** `Circle`、`Square`、`Hexagon`。 */
  avatarShape: z.string().optional(),
  bannerUrl: z.string().optional(),
  bio: RichTextSchema.optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  pinnedPostIds: z.array(IdSchema).min(1).optional(),
  protected: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  verified: strictObject({
    blue: z.boolean().optional(),
    /** `Business`、`Government`。 */
    type: z.string().optional(),
  }).optional(),
  affiliation: AffiliationSchema.optional(),
  /** `Parody`、`Commentary`、`Fan`。 */
  parody: z.string().optional(),
  professional: strictObject({
    type: z.string().optional(),
    categories: z.array(z.string()).min(1).optional(),
  }).optional(),
  counts: UserCountsSchema.optional(),
});
export type User = z.infer<typeof UserSchema>;

export const VideoVariantSchema = strictObject({
  url: z.string(),
  /** `video/mp4`、`application/x-mpegURL`。 */
  type: z.string(),
  bitrate: count.optional(),
});
export type VideoVariant = z.infer<typeof VideoVariantSchema>;

export const MediaSchema = strictObject({
  id: IdSchema,
  type: z.enum(['photo', 'video', 'gif']),
  /** 图片地址；视频与 GIF 为封面图。 */
  url: z.string(),
  width: count.optional(),
  height: count.optional(),
  alt: z.string().optional(),
  /** 平台给出的裁切建议框，来源 `original_info.focus_rects`。 */
  crops: z.array(RectSchema).min(1).optional(),
  /** 原图尺寸下的人脸框，来源 `features.orig.faces`。 */
  faces: z.array(RectSchema).min(1).optional(),
  tags: z.array(strictObject({ userId: IdSchema, handle: z.string().optional() })).min(1).optional(),
  video: strictObject({
    durationMs: count.optional(),
    variants: z.array(VideoVariantSchema).min(1),
  }).optional(),
  /** 媒体最初所在的帖子与作者（引用他人帖子里的媒体时存在）。 */
  sourcePostId: IdSchema.optional(),
  sourceUserId: IdSchema.optional(),
  /** `adult_content`、`graphic_violence`、`other`。 */
  sensitive: z.array(z.string()).min(1).optional(),
  /** `ext_media_availability.status` 不为 `Available` 时记录。 */
  unavailable: z.string().optional(),
  /** 发布方视频的标题、描述与跳转链接，来源 `additional_media_info`。 */
  title: z.string().optional(),
  description: z.string().optional(),
  link: z.string().optional(),
});
export type Media = z.infer<typeof MediaSchema>;

export const CardSchema = strictObject({
  /** 卡片模板名，样本值：`summary`、`summary_large_image`、`player`、`unified_card`。 */
  type: z.string(),
  /** 卡片对应的 t.co 链接，与正文中的 `url` 实体对应。 */
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  image: strictObject({
    url: z.string(),
    width: count.optional(),
    height: count.optional(),
    alt: z.string().optional(),
  }).optional(),
  siteUserId: IdSchema.optional(),
  creatorUserId: IdSchema.optional(),
  player: strictObject({
    url: z.string(),
    width: count.optional(),
    height: count.optional(),
  }).optional(),
  /** 其余未建模的字符串绑定值（如 `app_*`、`unified_card`），保证信息不丢。 */
  extra: z.record(z.string(), z.string()).optional(),
});
export type Card = z.infer<typeof CardSchema>;

/** Draft.js 区间 `[offset, length, value]`，单位与 X 原始数据一致。 */
const ArticleSpanSchema = <T extends z.ZodType>(value: T) => z.tuple([count, count, value]);

export const ArticleBlockSchema = strictObject({
  /** `unstyled`、`header-two`、`unordered-list-item`、`atomic` 等。 */
  type: z.string(),
  text: z.string(),
  styles: z.array(ArticleSpanSchema(z.string())).min(1).optional(),
  /** 第三项为 `Article.entities` 的下标。 */
  entities: z.array(ArticleSpanSchema(count)).min(1).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type ArticleBlock = z.infer<typeof ArticleBlockSchema>;

export const ArticleSchema = strictObject({
  id: IdSchema,
  title: z.string(),
  preview: z.string().optional(),
  coverMediaId: IdSchema.optional(),
  publishedAt: InstantSchema.optional(),
  modifiedAt: InstantSchema.optional(),
  /** 正文，仅推文详情响应提供。 */
  blocks: z.array(ArticleBlockSchema).min(1).optional(),
  /** Draft.js entityMap：`LINK`、`MEDIA`、`MARKDOWN`、`TWEMOJI` 等。 */
  entities: z.array(strictObject({ type: z.string(), data: z.record(z.string(), z.unknown()) })).min(1).optional(),
  mediaIds: z.array(IdSchema).min(1).optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const PlaceSchema = strictObject({
  id: z.string(),
  name: z.string().optional(),
  fullName: z.string().optional(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  /** `city`、`country`、`poi` 等。 */
  type: z.string().optional(),
  /** `[west, south, east, north]`。 */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

export const PostCountsSchema = strictObject({
  replies: count.optional(),
  reposts: count.optional(),
  quotes: count.optional(),
  likes: count.optional(),
  bookmarks: count.optional(),
  views: count.optional(),
});
export type PostCounts = z.infer<typeof PostCountsSchema>;

export const PostSchema = strictObject({
  id: IdSchema,
  authorId: IdSchema,
  createdAt: InstantSchema,
  /** 纯转帖只有 `id`、`authorId`、`createdAt`、`repostOf`；其余内容以原帖为准。 */
  repostOf: IdSchema.optional(),
  /** 缺省表示会话根即自身。 */
  conversationId: IdSchema.optional(),
  replyTo: strictObject({
    postId: IdSchema,
    userId: IdSchema.optional(),
    handle: z.string().optional(),
  }).optional(),
  quote: strictObject({
    postId: IdSchema,
    /** 被引帖子的永久链接，被引帖子不可见时用于保留出处。 */
    url: z.string().optional(),
  }).optional(),
  text: RichTextSchema.optional(),
  lang: z.string().optional(),
  /** 发布客户端名称。 */
  source: z.string().optional(),
  mediaIds: z.array(IdSchema).min(1).optional(),
  card: CardSchema.optional(),
  article: ArticleSchema.optional(),
  place: PlaceSchema.optional(),
  counts: PostCountsSchema.optional(),
  /** 编辑链的全部版本（含自身），仅编辑过时存在。 */
  editIds: z.array(IdSchema).min(2).optional(),
  communityNote: strictObject({
    id: IdSchema.optional(),
    title: z.string().optional(),
    text: RichTextSchema,
    url: z.string().optional(),
  }).optional(),
  sensitive: z.boolean().optional(),
  /** `ByInvitation`、`Community`、`Following`、`Verified` 等。 */
  replyPolicy: z.string().optional(),
  paidPromotion: z.boolean().optional(),
  aiGenerated: strictObject({
    media: z.boolean(),
    /** `C2paClient`、`UserDeclared`。 */
    source: z.string(),
  }).optional(),
});
export type Post = z.infer<typeof PostSchema>;

/** 一次采集或提交的实体集合。 */
export interface ArchiveBatch {
  users: User[];
  posts: Post[];
  media: Media[];
}
