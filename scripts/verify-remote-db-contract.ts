import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildRemoteDbSubmissionBatch,
  compareRemoteDbTweetBundle,
} from '../src/lib/remote-db/adapter';
import type { DbMedia, DbTweet, DbUser } from '../src/lib/db-service';
import type {
  RemoteDbQueryResponse,
  RemoteDbSubmitMedia,
  RemoteDbSubmitTweet,
  RemoteDbSubmitUser,
  RemoteDbTweetBundle,
} from '../src/lib/remote-db/types';

interface SubmitFixture {
  users: RemoteDbSubmitUser[];
  tweets: RemoteDbSubmitTweet[];
  media: RemoteDbSubmitMedia[];
}

const ROOT = resolve(process.cwd());
const TWEET_DB_FIXTURE_DIR = resolve(ROOT, '../tweet-db/server/test-fixtures');
const SUBMIT_FIXTURE = resolve(TWEET_DB_FIXTURE_DIR, 'x_monkey_remote_db_submit_payload.json');
const QUERY_FIXTURE = resolve(TWEET_DB_FIXTURE_DIR, 'x_monkey_remote_db_query_response.json');

function fail(message: string): never {
  throw new Error(message);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return entry;
    }

    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  });
}

function withoutFetchedAt<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => withoutFetchedAt(item)) as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'fetchedAt') continue;
      next[key] = withoutFetchedAt(entry);
    }
    return next as T;
  }

  return value;
}

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toLocalUser(user: RemoteDbSubmitUser): DbUser {
  const profileFetchedAt = (user.profile as { fetchedAt?: string } | undefined)?.fetchedAt;
  const statsFetchedAt = (user.stats as { fetchedAt?: string } | undefined)?.fetchedAt;

  return {
    id: user.id,
    createdAt: user.registeredAt,
    profile: user.profile
      ? {
          displayName: user.profile.displayName,
          userName: user.profile.userName,
          avatarUrl: user.profile.avatarUrl,
          usesDefaultAvatar: user.profile.usesDefaultAvatar,
          avatarShape: user.profile.avatarShape,
          bannerUrl: user.profile.bannerUrl,
          location: user.profile.location,
          bio: user.profile.bio,
          profileLinks: user.profile.profileLinks,
        }
      : {
          displayName: '',
          userName: '',
          profileLinks: [],
        },
    pinnedTweetIds: user.pinnedTweetIds,
    identity: user.identity,
    professional: user.professional,
    stats: user.stats
      ? {
          followers: user.stats.followers,
          following: user.stats.following,
          likes: user.stats.likes,
          mediaPosts: user.stats.mediaPosts,
          tweets: user.stats.tweets,
          listed: user.stats.listed,
        }
      : undefined,
    features: user.features,
    _ts: timestamp(profileFetchedAt ?? statsFetchedAt ?? user.registeredAt),
  };
}

function toLocalTweet(tweet: RemoteDbSubmitTweet): DbTweet {
  return {
    id: tweet.id,
    createdAt: tweet.publishedAt,
    source: tweet.source,
    place: tweet.place,
    authorId: tweet.authorId,
    content: {
      legacyText: tweet.content.legacyText,
      note: tweet.content.note && tweet.content.note.text
        ? {
            id: tweet.content.note.id,
            text: tweet.content.note.text,
          }
        : undefined,
      mediaIds: tweet.content.mediaIds,
      language: tweet.content.language,
    },
    conversation: tweet.conversation,
    stats: {
      views: tweet.stats?.views,
      replies: tweet.stats?.replies,
      reposts: tweet.stats?.reposts,
      quotes: tweet.stats?.quotes,
      likes: tweet.stats?.likes,
      bookmarks: tweet.stats?.bookmarks,
    },
    edit: tweet.edit,
    policy: tweet.policy,
    communityNote: tweet.communityNote,
    _ts: timestamp(tweet.publishedAt),
  };
}

function toLocalMedia(media: RemoteDbSubmitMedia): DbMedia {
  return {
    id: media.id,
    type: media.type,
    mediaUrl: media.mediaUrl,
    altText: media.altText,
    grokPostId: media.grokPostId,
    geometry: media.geometry,
    variants: media.variants,
    taggedUsers: media.taggedUsers,
    sensitivityWarnings: media.sensitivityWarnings,
    availability: media.availability,
    video: media.video,
    origin: media.origin,
    details: media.details,
    _ts: 0,
  };
}

function assertNoLegacyRemoteDbShape(value: unknown): void {
  const json = stableJson(value);
  for (const legacyKey of [
    'sourceKind',
    'fullText',
    'legacyFullText',
    'mediaKey',
    'thumbUrl',
    'sourceUrl',
    'allowDownload',
    'videoVariants',
  ]) {
    if (json.includes(`"${legacyKey}"`)) {
      fail(`remote-db payload still contains legacy key ${legacyKey}`);
    }
  }
}

function assertSubmissionAdapterMatchesFixtureSubset(fixture: SubmitFixture): void {
  const localUsers = new Map(fixture.users.map((user) => [user.id, toLocalUser(user)]));
  const localMedia = new Map(fixture.media.map((media) => [media.id, toLocalMedia(media)]));
  const localTweets = fixture.tweets.map((tweet) => toLocalTweet(tweet));
  const result = buildRemoteDbSubmissionBatch(localTweets.map((tweet) => ({
    tweet,
    author: localUsers.get(tweet.authorId),
    media: tweet.content.mediaIds
      .map((mediaId) => localMedia.get(mediaId))
      .filter(Boolean) as DbMedia[],
  })));

  if (!result.submission) {
    fail(`adapter failed to build submission: ${JSON.stringify(result)}`);
  }

  assertNoLegacyRemoteDbShape(result.submission);

  const expected = withoutFetchedAt(fixture);
  if (stableJson(result.submission) !== stableJson(expected)) {
    fail('adapter submission does not match the tweet-db v2 fixture subset');
  }
}

function assertQueryFixtureComparesInSync(
  submitFixture: SubmitFixture,
  queryFixture: RemoteDbQueryResponse,
): void {
  const localUser = toLocalUser(submitFixture.users[0]);
  const localTweet = toLocalTweet(submitFixture.tweets[0]);
  const localMedia = submitFixture.media.map((media) => toLocalMedia(media));
  const bundle: RemoteDbTweetBundle = {
    summary: queryFixture.summary,
    tweet: queryFixture.tweets[0],
    author: queryFixture.users[0],
    media: queryFixture.media,
  };

  const comparison = compareRemoteDbTweetBundle(localTweet, localUser, localMedia, bundle);
  if (comparison.overallStatus !== 'in_sync') {
    fail(`query fixture should compare in sync, got ${comparison.overallStatus}: ${comparison.message ?? '(no message)'}`);
  }
}

function main(): void {
  const submitFixture = readJson<SubmitFixture>(SUBMIT_FIXTURE);
  const queryFixture = readJson<RemoteDbQueryResponse>(QUERY_FIXTURE);

  assertSubmissionAdapterMatchesFixtureSubset(submitFixture);
  assertQueryFixtureComparesInSync(submitFixture, queryFixture);

  console.log('remote-db contract: tweet-db v2 fixtures match x-monkey adapter');
}

main();
