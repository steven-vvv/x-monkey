/**
 * X 用户实体（来自 TweetDetail GraphQL 响应中的用户节点）。
 *
 * 主要由 `parser.ts -> parseUser()` 填充，后续会被写入内存数据库（db-service）。
 */
export interface XUser {
  /** 用户唯一 ID（来源：`raw.rest_id`）。 */
  id: string;

  /** 用户显示名（来源：`raw.core.name`）。 */
  name: string;

  /** 用户名/handle，不含 @（来源：`raw.core.screen_name`）。 */
  screenName: string;

  /** 个人简介（来源：`raw.legacy.description`）。 */
  description: string;

  /** 地理位置文本（来源：`raw.location.location`）。 */
  location: string;

  /** 头像 URL（来源：`raw.avatar.image_url`，通常为 `_normal` 尺寸）。 */
  avatarUrl: string;

  /** 头图 URL，若无头图则为 null（来源：`raw.legacy.profile_banner_url`）。 */
  bannerUrl: string | null;

  /** 是否蓝标认证（来源：`raw.is_blue_verified`）。 */
  isBlueVerified: boolean;

  /** 是否受保护账号（来源：`raw.privacy.protected`）。 */
  isProtected: boolean;

  /** 粉丝数（来源：`raw.legacy.followers_count`）。 */
  followersCount: number;

  /** 关注数（来源：`raw.legacy.friends_count`）。 */
  friendsCount: number;

  /** 点赞总数（来源：`raw.legacy.favourites_count`）。 */
  favouritesCount: number;

  /** 发帖总数（来源：`raw.legacy.statuses_count`）。 */
  statusesCount: number;

  /** 媒体推文总数（来源：`raw.legacy.media_count`）。 */
  mediaCount: number;

  /** 被加入列表次数（来源：`raw.legacy.listed_count`）。 */
  listedCount: number;

  /** 账号创建时间（来源：`raw.core.created_at`，原始字符串）。 */
  createdAt: string;
}

/** 媒体类型（来源：`raw.type`）。 */
export type MediaType = 'photo' | 'video' | 'animated_gif';

/**
 * 视频编码变体（同一视频的不同码率/容器）。
 * 来源：`raw.video_info.variants[]`。
 */
export interface VideoVariant {
  /** 视频码率（bps），某些流可能为空（如 m3u8），此时为 null。 */
  bitrate: number | null;

  /** MIME 类型，如 `video/mp4`、`application/x-mpegURL`。 */
  contentType: string;

  /** 变体直链 URL（解析时会去除 query 参数）。 */
  url: string;
}

/**
 * 推文媒体实体（图片/视频/GIF）。
 *
 * 由 `parser.ts -> parseMediaItem()` 生成，部分字段用于下载与溯源。
 */
export interface XMedia {
  /** 媒体 ID（来源：`raw.id_str`）。 */
  id: string;

  /** X 媒体键（来源：`raw.media_key`）。 */
  mediaKey: string;

  /** 所属推文 ID（来源：当前解析上下文 tweetId）。 */
  tweetId: string;

  /** 媒体类型（来源：`raw.type`）。 */
  type: MediaType;

  /** 原始媒体 URL（来源：`raw.media_url_https`）。 */
  mediaUrl: string;

  /** 缩略图 URL（由 `mediaUrl` 派生为 `name=small`）。 */
  thumbUrl: string;

  /**
   * 下载/原图优先 URL：
   * - photo: `name=orig`
   * - video/gif: 最高码率 mp4（若无则回退 mediaUrl）
   */
  sourceUrl: string;

  /** 原始宽度（来源：`raw.original_info.width`）。 */
  width: number;

  /** 原始高度（来源：`raw.original_info.height`）。 */
  height: number;

  /** 无障碍替代文本（来源：`raw.ext_alt_text`）。 */
  altText: string | null;

  /** 是否允许下载（来源：`raw.allow_download_status.allow_download`）。 */
  allowDownload: boolean;

  /** 溯源状态 ID（转载媒体时出现，来源：`raw.source_status_id_str`）。 */
  sourceStatusId: string | null;

  /** 溯源用户 ID（转载媒体时出现，来源：`raw.source_user_id_str`）。 */
  sourceUserId: string | null;

  /** 视频时长毫秒（来源：`raw.video_info.duration_millis`）。 */
  durationMs: number | null;

  /** 视频变体列表（来源：`raw.video_info.variants[]`）。 */
  videoVariants: VideoVariant[];
}

/**
 * 推文实体（来自 TweetDetail 及其递归引用，如 quoted tweet）。
 *
 * 由 `parser.ts -> parseTweet()` 生成。
 */
export interface XTweet {
  /** 推文 ID（来源：`raw.rest_id`）。 */
  id: string;

  /** 作者用户 ID（来源：`raw.legacy.user_id_str`）。 */
  authorId: string;

  /** 会话 ID（来源：`raw.legacy.conversation_id_str`）。 */
  conversationId: string;

  /** 推文完整文本（来源：`raw.legacy.full_text`）。 */
  fullText: string;

  /** 语言代码（来源：`raw.legacy.lang`）。 */
  lang: string;

  /** 创建时间（来源：`raw.legacy.created_at`，原始字符串）。 */
  createdAt: string;

  /** 被回复的父推文 ID（来源：`raw.legacy.in_reply_to_status_id_str`）。 */
  inReplyToTweetId: string | null;

  /** 被回复的父用户 ID（来源：`raw.legacy.in_reply_to_user_id_str`）。 */
  inReplyToUserId: string | null;

  /** 引用推文 ID（递归解析 `quoted_status_result` 后得到）。 */
  quotedTweetId: string | null;

  /** 浏览量（来源：`raw.views.count`，不可解析时为 null）。 */
  viewCount: number | null;

  /** 点赞数（来源：`raw.legacy.favorite_count`）。 */
  favoriteCount: number;

  /** 转推数（来源：`raw.legacy.retweet_count`）。 */
  retweetCount: number;

  /** 回复数（来源：`raw.legacy.reply_count`）。 */
  replyCount: number;

  /** 引用数（来源：`raw.legacy.quote_count`）。 */
  quoteCount: number;

  /** 书签数（来源：`raw.legacy.bookmark_count`）。 */
  bookmarkCount: number;

  /** 关联媒体 ID 列表（来源：`legacy.extended_entities.media[]` 解析结果）。 */
  mediaIds: string[];

  /** 客户端来源文本（来源：`legacy.source/raw.source`，HTML 去标签后）。 */
  source: string;
}

/**
 * 一次 TweetDetail 响应解析结果。
 *
 * - key 为实体 ID
 * - value 为去重后的规范化实体对象
 */
export interface ParsedResponse {
  /** 用户集合（由 parseTweet / parseMediaItem 过程中持续填充）。 */
  users: Map<string, XUser>;

  /** 推文集合（由 parseTweet 递归遍历填充）。 */
  tweets: Map<string, XTweet>;

  /** 媒体集合（由 parseMediaItem 填充）。 */
  media: Map<string, XMedia>;
}
