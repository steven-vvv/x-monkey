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
    ...user,
    pinnedTweetIds: [...user.pinnedTweetIds],
  };
}

function toDbMedia(media: normalized.TweetMedia): DbMediaRecord {
  const originUserId = media.origin?.user?.id ?? media.origin?.userId;
  const origin = media.origin?.tweetId || originUserId
    ? {
        tweetId: media.origin?.tweetId,
        userId: originUserId,
      }
    : undefined;

  return {
    id: media.id,
    type: media.type,
    mediaUrl: media.mediaUrl,
    altText: media.altText,
    grokPostId: media.grokPostId,
    geometry: media.geometry,
    variants: media.variants,
    taggedUsers: [...media.taggedUsers],
    origin,
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
    content: {
      legacyText: tweet.content.legacyText,
      note: tweet.content.note,
      mediaIds: tweet.content.media.map((media) => media.id),
      language: tweet.content.language,
    },
    conversation: {
      conversationId: tweet.conversation.conversationId,
      replyTo: tweet.conversation.replyTo
        ? { ...tweet.conversation.replyTo }
        : undefined,
      quote: tweet.conversation.quote
        ? {
            tweetId: tweet.conversation.quote.tweet?.id ?? tweet.conversation.quote.tweetId,
            permalink: tweet.conversation.quote.permalink,
          }
        : undefined,
      repostId: tweet.conversation.repost?.id,
    },
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

  function visitMedia(media: normalized.TweetMedia): void {
    upsertEntity(parsed.media, toDbMedia(media));
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
      visitMedia(media);
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
