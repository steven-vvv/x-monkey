import type * as normalized from '../schema/tweet-schema';
import { mergeEntity } from './entity-merge';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord, ParsedResponse } from './types';

function createParsedMaps(): ParsedResponse {
  return {
    users: new Map<string, DbUserRecord>(),
    tweets: new Map<string, DbTweetRecord>(),
    media: new Map<string, DbMediaRecord>(),
  };
}

function upsertEntity<T extends { id: string }>(map: Map<string, T>, entity: T): void {
  const existing = map.get(entity.id);
  if (existing) {
    mergeEntity(existing as Record<string, unknown>, entity as Record<string, unknown>);
    return;
  }
  map.set(entity.id, entity);
}

function toDbUser(user: normalized.TweetUser): DbUserRecord {
  return {
    id: user.id,
    displayName: user.displayName,
    userName: user.userName,
    createdAt: user.createdAt,
    profile: user.profile,
    pinnedTweetIds: [...user.pinnedTweetIds],
    identity: user.identity,
    professional: user.professional,
    stats: user.stats,
    features: user.features,
  };
}

function toDbMedia(tweetId: string, media: normalized.TweetMedia): DbMediaRecord {
  return {
    id: media.id,
    tweetId,
    type: media.type,
    displayText: media.displayText,
    expandedUrl: media.expandedUrl,
    url: media.url,
    mediaUrl: media.mediaUrl,
    altText: media.altText,
    grokPostId: media.grokPostId,
    geometry: media.geometry,
    variants: media.variants,
    taggedUsers: [...media.taggedUsers],
    faces: media.faces,
    originTweetId: media.origin?.tweetId,
    originUserId: media.origin?.user?.id ?? media.origin?.userId,
    details: media.details,
    availability: media.availability,
    video: media.video,
  };
}

function toDbTweet(tweet: normalized.Tweet): DbTweetRecord {
  return {
    id: tweet.id,
    createdAt: tweet.createdAt,
    source: tweet.source,
    place: tweet.place,
    authorId: tweet.author.id,
    legacyText: tweet.content.legacyText,
    note: tweet.content.note,
    language: tweet.content.language,
    mediaIds: tweet.content.media.map((media) => media.id),
    conversationId: tweet.conversation.conversationId,
    replyToTweetId: tweet.conversation.replyTo?.tweetId,
    replyToUserId: tweet.conversation.replyTo?.userId,
    replyToUserName: tweet.conversation.replyTo?.userName,
    quoteTweetId: tweet.conversation.quote?.tweet?.id ?? tweet.conversation.quote?.tweetId,
    quotePermalink: tweet.conversation.quote?.permalink,
    repostTweetId: tweet.conversation.repost?.id,
    stats: tweet.stats,
    edit: tweet.edit,
    policy: tweet.policy,
    communityNote: tweet.communityNote,
  };
}

export function flattenTweet(rootTweet: normalized.Tweet): ParsedResponse {
  const parsed = createParsedMaps();
  const seenTweets = new Set<string>();
  const seenUsers = new Set<string>();

  function visitUser(user: normalized.TweetUser): void {
    upsertEntity(parsed.users, toDbUser(user));
    seenUsers.add(user.id);
  }

  function visitMedia(tweetId: string, media: normalized.TweetMedia): void {
    upsertEntity(parsed.media, toDbMedia(tweetId, media));
    if (media.origin?.user && !seenUsers.has(media.origin.user.id)) {
      visitUser(media.origin.user);
    }
  }

  function visitTweet(tweet: normalized.Tweet): void {
    upsertEntity(parsed.tweets, toDbTweet(tweet));
    if (seenTweets.has(tweet.id)) {
      return;
    }

    seenTweets.add(tweet.id);
    visitUser(tweet.author);

    for (const media of tweet.content.media) {
      visitMedia(tweet.id, media);
    }

    if (tweet.conversation.quote?.tweet) {
      visitTweet(tweet.conversation.quote.tweet);
    }

    if (tweet.conversation.repost) {
      visitTweet(tweet.conversation.repost);
    }
  }

  visitTweet(rootTweet);
  return parsed;
}
