import type * as normalized from '../schema/tweet-schema';

/**
 * 扁平化后的用户存储实体。
 * 由规范化 Tweet 模型进一步拆分得到，供内存数据库与界面层使用。
 */
export interface DbUserRecord {
  id: string;
  displayName: string;
  userName: string;
  createdAt?: string;
  profile: normalized.TweetUserProfile;
  pinnedTweetIds: string[];
  identity?: normalized.TweetUserIdentity;
  professional?: normalized.TweetUserProfessional;
  stats?: normalized.TweetUserStats;
  features?: normalized.TweetUserFeatures;
}

/**
 * 扁平化后的媒体存储实体。
 * 媒体归属 tweet 通过 `tweetId` 关联，溯源关系改为 ID 引用。
 */
export interface DbMediaRecord {
  id: string;
  tweetId: string;
  type: normalized.TweetMedia['type'];
  displayText?: string;
  expandedUrl?: string;
  url?: string;
  mediaUrl?: string;
  altText?: string;
  grokPostId?: string;
  geometry?: normalized.TweetMediaGeometry;
  variants?: normalized.MediaVariants;
  taggedUsers: normalized.TweetMediaTag[];
  faces?: normalized.TweetMediaFaces;
  originTweetId?: string;
  originUserId?: string;
  details?: normalized.TweetMediaDetails;
  availability?: string;
  video?: normalized.TweetVideo;
}

/**
 * 扁平化后的帖子存储实体。
 * 引用、回复、转贴等递归关系统一改为字符串 ID。
 */
export interface DbTweetRecord {
  id: string;
  createdAt: string;
  source?: string;
  place?: normalized.TweetPlace;
  authorId: string;
  legacyText: normalized.AnnotatedText;
  note?: normalized.TweetNote;
  language?: string;
  mediaIds: string[];
  conversationId: string;
  replyToTweetId?: string;
  replyToUserId?: string;
  replyToUserName?: string;
  quoteTweetId?: string;
  quotePermalink?: normalized.TweetPermalink;
  repostTweetId?: string;
  stats: normalized.TweetStats;
  edit?: normalized.TweetEditInfo;
  policy?: normalized.TweetPolicy;
  communityNote?: normalized.TweetCommunityNote;
}

/**
 * 一次响应扁平化后的实体集合。
 */
export interface ParsedResponse {
  users: Map<string, DbUserRecord>;
  tweets: Map<string, DbTweetRecord>;
  media: Map<string, DbMediaRecord>;
  meta?: {
    instructionPath: string | null;
    warnings: string[];
  };
}

/**
 * 兼容旧调用方的类型别名。
 * 当前仓库后续迁移会逐步改为直接使用 `Db*Record`。
 */
export type XUser = DbUserRecord;
export type XMedia = DbMediaRecord;
export type XTweet = DbTweetRecord;
