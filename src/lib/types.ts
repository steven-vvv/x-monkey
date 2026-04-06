import type * as normalized from '../schema/tweet-schema';

/**
 * 紧凑的用户存储实体。
 * 用户附属结构全部内联保存。
 */
export interface DbUserRecord extends normalized.TweetUser {}

/**
 * 紧凑的媒体溯源信息。
 * 保留 `origin` 语义对象，但不嵌入完整来源用户对象。
 */
export interface DbMediaOriginRecord extends Omit<normalized.TweetMediaOrigin, 'user'> {}

/**
 * 紧凑的媒体存储实体。
 * 除 `faces` 外，其余结构均内联保存。
 */
export interface DbMediaRecord extends Omit<normalized.TweetMedia, 'faces' | 'origin'> {
  origin?: DbMediaOriginRecord;
}

/**
 * Tweet 内容内联结构。
 * 媒体改为以 `mediaIds` 保存引用。
 */
export interface DbTweetContentRecord extends Omit<normalized.TweetContent, 'media'> {
  mediaIds: string[];
}

/**
 * Tweet 引用关系内联结构。
 * 仅保留被引用 tweet ID 与永久链接。
 */
export type DbTweetQuoteRecord = Omit<normalized.TweetQuote, 'tweet'>;

/**
 * Tweet 会话关系内联结构。
 * 回复信息继续内联，转贴改为仅保存 `repostId`。
 */
export interface DbTweetConversationRecord extends Omit<normalized.TweetConversation, 'quote' | 'repost'> {
  quote?: DbTweetQuoteRecord;
  repostId?: string;
}

/**
 * 紧凑的帖子存储实体。
 * 仅保留 `Tweet`、`User`、`Media` 三类独立实体，其余结构全部内联。
 */
export interface DbTweetRecord extends Omit<normalized.Tweet, 'author' | 'content' | 'conversation'> {
  authorId: string;
  content: DbTweetContentRecord;
  conversation: DbTweetConversationRecord;
}

/**
 * 一次响应收敛后的实体集合。
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
