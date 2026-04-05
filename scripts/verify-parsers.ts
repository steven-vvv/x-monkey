import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPPORTED_ENDPOINTS, type SupportedEndpointOperationName } from '../src/lib/endpoint-support';
import {
  parseBookmarksResponse,
  parseHomeLatestTimelineResponse,
  parseHomeTimelineResponse,
  parseTweetDetailResponse,
  parseUserMediaResponse,
  parseUserTweetsResponse,
  type TimelineParsedResponse,
} from '../src/lib/parser';
import { clearDb, dbVersion, getTweetCount, runDbBatch, upsertMedia, upsertTweet, upsertUser } from '../src/lib/db-service';
import { clearCaptureState } from '../src/lib/capture-state-service';
import {
  buildTimelineRecordKey,
  clearTimelineState,
  getTimelineCreatedOrder,
  getTimelineCreatedOrderByAlias,
  getTimelineTweetIds,
  getTimelineTweetIdsByAlias,
  getTimelineVersion,
  ingestTimeline,
  resolveTimelineRecordKey,
} from '../src/lib/timeline-store';
import type { ParsedResponse, XMedia, XTweet, XUser } from '../src/lib/types';

interface CaseConfig {
  name: string;
  dir: string;
  parse: (json: unknown) => ParsedResponse | TimelineParsedResponse;
  ordered: boolean;
  supportVersion: number;
}

const ROOT = resolve(process.cwd());
const PARSERS: Record<SupportedEndpointOperationName, (json: unknown) => ParsedResponse | TimelineParsedResponse> = {
  Bookmarks: parseBookmarksResponse,
  HomeLatestTimeline: parseHomeLatestTimelineResponse,
  HomeTimeline: parseHomeTimelineResponse,
  TweetDetail: parseTweetDetailResponse,
  UserMedia: parseUserMediaResponse,
  UserTweets: parseUserTweetsResponse,
};

const CASES: CaseConfig[] = SUPPORTED_ENDPOINTS.map((endpoint) => ({
  name: endpoint.operationName,
  dir: endpoint.dumpDir,
  parse: PARSERS[endpoint.operationName],
  ordered: endpoint.kind === 'timeline',
  supportVersion: endpoint.supportVersion,
}));

function fail(message: string): never {
  throw new Error(message);
}

function isTimelineParsedResponse(parsed: ParsedResponse | TimelineParsedResponse): parsed is TimelineParsedResponse {
  return Array.isArray((parsed as TimelineParsedResponse).tweetIds);
}

function assertTweetShape(tweet: XTweet, caseName: string) {
  if (!tweet.id) fail(`[${caseName}] empty tweet id`);
  if (!tweet.authorId) fail(`[${caseName}] tweet ${tweet.id} missing authorId`);
  if (!tweet.conversationId) fail(`[${caseName}] tweet ${tweet.id} missing conversationId`);
  if (!tweet.note?.text.text && !tweet.body.text) {
    fail(`[${caseName}] tweet ${tweet.id} is missing both body and note text`);
  }
}

function createEmptyTextEntities() {
  return {
    hashtags: [],
    symbols: [],
    urls: [],
    mentions: [],
  };
}

function buildStoredUser(id: string): XUser {
  return {
    id,
    displayName: 'User',
    userName: 'user',
    createdAt: 'Tue Jan 01 00:00:00 +0000 2030',
    profile: {
      avatarUrl: '',
      avatarShape: 'Circle',
      profileLinks: [],
    },
    pinnedTweetIds: [],
    stats: {
      followers: 1,
      following: 1,
      likes: 1,
      mediaPosts: 1,
      tweets: 1,
      listed: 1,
    },
    features: {
      isProtected: false,
    },
  };
}

function buildStoredTweet(id: string, authorId: string, mediaIds: string[] = []): XTweet {
  return {
    id,
    createdAt: 'Tue Jan 01 00:00:00 +0000 2030',
    source: 'Web',
    authorId,
    body: {
      text: 'db tweet',
      entities: createEmptyTextEntities(),
    },
    mediaIds,
    conversationId: id,
    stats: {
      views: '10',
      replies: 1,
      reposts: 1,
      quotes: 1,
      likes: 1,
      bookmarks: 1,
    },
  };
}

function buildStoredMedia(id: string, tweetId: string): XMedia {
  return {
    id,
    tweetId,
    type: 'photo',
    mediaUrl: 'https://pbs.twimg.com/media/m-db.jpg',
    geometry: {
      width: 1200,
      height: 800,
      focusRects: [],
    },
    taggedUsers: [],
  };
}

function buildUser(id: string): Record<string, any> {
  return {
    __typename: 'User',
    rest_id: id,
    core: {
      name: `User ${id}`,
      screen_name: `user_${id}`,
      created_at: 'Tue Jan 01 00:00:00 +0000 2030',
    },
    legacy: {
      description: '',
      followers_count: 1,
      friends_count: 2,
      favourites_count: 3,
      statuses_count: 4,
      media_count: 5,
      listed_count: 6,
      pinned_tweet_ids_str: [],
      entities: {
        url: {
          urls: [],
        },
      },
    },
    avatar: {
      image_url: '',
    },
    location: {
      location: '',
    },
    privacy: {
      protected: false,
    },
    profile_image_shape: 'Circle',
  };
}

function buildMedia(id: string): Record<string, any> {
  return {
    id_str: id,
    media_key: `3_${id}`,
    media_url_https: `https://pbs.twimg.com/media/${id}.jpg`,
    original_info: {
      width: 1200,
      height: 800,
    },
    type: 'photo',
  };
}

function buildTweet(id: string, userId: string, overrides: Record<string, any> = {}): Record<string, any> {
  const media = overrides.media === undefined ? [] : overrides.media;

  return {
    __typename: 'Tweet',
    rest_id: id,
    core: {
      user_results: {
        result: buildUser(userId),
      },
    },
    legacy: {
      id_str: id,
      user_id_str: userId,
      conversation_id_str: id,
      full_text: overrides.fullText ?? `tweet-${id}`,
      lang: overrides.lang ?? 'en',
      created_at: overrides.createdAt ?? 'Tue Jan 01 00:00:00 +0000 2030',
      is_quote_status: overrides.isQuoteStatus ?? false,
      favorite_count: overrides.favoriteCount ?? 1,
      retweet_count: overrides.retweetCount ?? 2,
      reply_count: overrides.replyCount ?? 3,
      quote_count: overrides.quoteCount ?? 4,
      bookmark_count: overrides.bookmarkCount ?? 5,
      entities: {
        media,
      },
      extended_entities: media.length > 0 ? { media } : undefined,
    },
    source: overrides.source ?? '<a href="https://x.com" rel="nofollow">Web</a>',
    views: overrides.views ?? { count: '12' },
  };
}

function assertInlineParserScenarios() {
  const bookmarksFixture = {
    data: {
      bookmark_timeline_v2: {
        timeline: {
          instructions: [
            {
              type: 'TimelineAddEntries',
              entries: [
                {
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: buildTweet('t-bookmark', 'u-bookmark'),
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };

  const bookmarksParsed = parseBookmarksResponse(bookmarksFixture);
  if (bookmarksParsed.tweetIds.join(',') !== 't-bookmark') {
    fail(`[inline] bookmark traversal failed: ${bookmarksParsed.tweetIds.join(',')}`);
  }
  if (bookmarksParsed.meta?.instructionPath !== 'data.bookmark_timeline_v2.timeline.instructions') {
    fail(`[inline] bookmark instruction path mismatch: ${bookmarksParsed.meta?.instructionPath ?? '(null)'}`);
  }

  const structuralFixture = {
    data: {
      home: {
        home_timeline_urt: {
          instructions: [
            {
              type: 'TimelineWeirdEntries',
              entries: [
                {
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: buildTweet('t-entries', 'u-1'),
                      },
                    },
                  },
                },
              ],
            },
            {
              type: 'TimelineWeirdModule',
              moduleItems: [
                {
                  item: {
                    itemContent: {
                      tweet_results: {
                        result: buildTweet('t-module', 'u-2'),
                      },
                    },
                  },
                },
              ],
            },
            {
              type: 'TimelineUnknownPin',
              entry: {
                content: {
                  itemContent: {
                    tweet_results: {
                      result: buildTweet('t-entry', 'u-3'),
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  };

  const structuralParsed = parseHomeTimelineResponse(structuralFixture);
  if (structuralParsed.tweetIds.join(',') !== 't-entries,t-module,t-entry') {
    fail(`[inline] structural traversal failed: ${structuralParsed.tweetIds.join(',')}`);
  }

  const duplicateFixture = {
    data: {
      home: {
        home_timeline_urt: {
          instructions: [
            {
              type: 'TimelineAddEntries',
              entries: [
                {
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: buildTweet('t-merge', 'u-merge', {
                          fullText: 'kept text',
                          source: '<a href="https://x.com" rel="nofollow">Rich Web</a>',
                          media: [buildMedia('m-merge')],
                        }),
                      },
                    },
                  },
                },
              ],
            },
            {
              type: 'TimelineAddToModule',
              moduleItems: [
                {
                  item: {
                    itemContent: {
                      tweet_results: {
                        result: buildTweet('t-merge', 'u-merge', {
                          fullText: '',
                          source: '',
                          media: [],
                        }),
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    },
  };

  const duplicateParsed = parseHomeTimelineResponse(duplicateFixture);
  const mergedTweet = duplicateParsed.tweets.get('t-merge');
  if (!mergedTweet) fail('[inline] duplicate merge tweet missing');
  if (mergedTweet.body.text !== 'kept text') fail('[inline] duplicate merge lost body text');
  if (mergedTweet.source !== 'Rich Web') fail('[inline] duplicate merge lost source');
  if (mergedTweet.mediaIds.join(',') !== 'm-merge') fail('[inline] duplicate merge lost media ids');

  const emptyParsed = parseHomeTimelineResponse({});
  if (!emptyParsed.meta?.warnings?.length) fail('[inline] empty timeline response should emit warnings');
}

function assertDbBatchScenario() {
  clearDb();
  const startVersion = dbVersion.value;

  const user = buildStoredUser('u-db');
  const tweet = buildStoredTweet('t-db', 'u-db', ['m-db']);
  const media = buildStoredMedia('m-db', 't-db');

  runDbBatch(() => {
    upsertUser(user);
    upsertTweet(tweet);
    upsertMedia(media);
  });

  if (dbVersion.value - startVersion !== 1) {
    fail(`[inline] db batch should bump version exactly once, got ${dbVersion.value - startVersion}`);
  }
}

function assertTimelineStoreScenario() {
  clearTimelineState();

  const screenNameKey = buildTimelineRecordKey('UserMedia', 'InlineUser');
  const userIdKey = buildTimelineRecordKey('UserMedia', 'u-inline');

  const firstIngest = ingestTimeline({
    key: screenNameKey,
    operationName: 'UserMedia',
    tweetIds: ['t1', 't2', 't1'],
    aliases: ['InlineUser'],
  });

  if (firstIngest.key !== screenNameKey) {
    fail('[inline] timeline store should preserve the first canonical key');
  }
  if (getTimelineTweetIds(screenNameKey).join(',') !== 't1,t2') {
    fail('[inline] timeline store lost order or dedupe');
  }
  if (getTimelineTweetIdsByAlias('UserMedia', 'inlineuser').join(',') !== 't1,t2') {
    fail('[inline] timeline store should resolve aliases case-insensitively');
  }
  if (getTimelineVersion(screenNameKey) !== 1) {
    fail('[inline] timeline store should bump version once for new ids');
  }
  if (getTimelineCreatedOrder(screenNameKey) == null) {
    fail('[inline] timeline store should record timeline creation order');
  }

  const secondIngest = ingestTimeline({
    key: userIdKey,
    operationName: 'UserMedia',
    tweetIds: ['t3'],
    aliases: ['u-inline', 'InlineUser'],
  });

  if (secondIngest.key !== screenNameKey) {
    fail('[inline] timeline store should merge alternate aliases into the existing record');
  }
  if (resolveTimelineRecordKey('UserMedia', 'u-inline') !== screenNameKey) {
    fail('[inline] timeline store should index secondary aliases');
  }
  if (getTimelineTweetIdsByAlias('UserMedia', 'u-inline').join(',') !== 't1,t2,t3') {
    fail('[inline] timeline store should append new ids onto the merged record');
  }

  const versionAfterDuplicate = getTimelineVersion(screenNameKey);
  ingestTimeline({
    key: userIdKey,
    operationName: 'UserMedia',
    tweetIds: ['t2'],
    aliases: ['u-inline'],
  });
  if (getTimelineVersion(screenNameKey) !== versionAfterDuplicate) {
    fail('[inline] timeline store should ignore duplicate-only ingest');
  }

  const homeKey = buildTimelineRecordKey('HomeTimeline');
  ingestTimeline({
    key: homeKey,
    operationName: 'HomeTimeline',
    tweetIds: ['h1', 'h2'],
    insertMode: 'prepend',
  });
  ingestTimeline({
    key: homeKey,
    operationName: 'HomeTimeline',
    tweetIds: ['h3', 'h2'],
    insertMode: 'prepend',
  });
  if (getTimelineTweetIds(homeKey).join(',') !== 'h3,h1,h2') {
    fail('[inline] prepend mode should insert new timeline ids at the top');
  }
  if (getTimelineCreatedOrderByAlias('HomeTimeline') == null) {
    fail('[inline] timeline store should resolve created order without aliases');
  }
}

function assertCaptureStateClearScenario() {
  clearCaptureState();

  runDbBatch(() => {
    upsertUser({
      ...buildStoredUser('u-clear'),
      stats: {
        followers: 0,
        following: 0,
        likes: 0,
        mediaPosts: 0,
        tweets: 0,
        listed: 0,
      },
    });
    upsertTweet({
      ...buildStoredTweet('t-clear', 'u-clear'),
      body: {
        text: 'clear',
        entities: createEmptyTextEntities(),
      },
      stats: {
        views: undefined,
        replies: 0,
        reposts: 0,
        quotes: 0,
        likes: 0,
        bookmarks: 0,
      },
    });
  });

  ingestTimeline({
    key: buildTimelineRecordKey('UserMedia', 'clear-user'),
    operationName: 'UserMedia',
    tweetIds: ['t-clear'],
    aliases: ['clear-user'],
  });

  clearCaptureState();

  if (getTweetCount() !== 0) {
    fail('[inline] clearCaptureState should empty the database');
  }
  if (getTimelineTweetIdsByAlias('UserMedia', 'clear-user').length !== 0) {
    fail('[inline] clearCaptureState should empty timeline state');
  }
}

function main() {
  assertInlineParserScenarios();
  assertDbBatchScenario();
  assertTimelineStoreScenario();
  assertCaptureStateClearScenario();

  let totalTweets = 0;
  let totalMedia = 0;

  for (const testCase of CASES) {
    const dir = join(ROOT, testCase.dir);
    const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort();

    let caseTweets = 0;
    let caseMedia = 0;
    let caseUsers = 0;
    let caseOrdered = 0;

    for (const file of files) {
      const json = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      const parsed = testCase.parse(json);

      for (const tweet of parsed.tweets.values()) {
        assertTweetShape(tweet, `${testCase.name}/${file}`);
      }

      for (const media of parsed.media.values()) {
        if (!parsed.tweets.has(media.tweetId)) {
          fail(`[${testCase.name}/${file}] media ${media.id} references missing tweet ${media.tweetId}`);
        }
      }

      if (isTimelineParsedResponse(parsed)) {
        for (const tweetId of parsed.tweetIds) {
          if (!parsed.tweets.has(tweetId)) {
            fail(`[${testCase.name}/${file}] ordered tweet id ${tweetId} missing from parsed.tweets`);
          }
        }
        caseOrdered += parsed.tweetIds.length;
      }

      caseTweets += parsed.tweets.size;
      caseMedia += parsed.media.size;
      caseUsers += parsed.users.size;
    }

    if (caseTweets === 0) {
      fail(`[${testCase.name}] parser produced zero tweets across all fixtures`);
    }

    totalTweets += caseTweets;
    totalMedia += caseMedia;

    const orderedText = testCase.ordered ? `, ordered=${caseOrdered}` : '';
    console.log(`${testCase.name}@v${testCase.supportVersion}: files=${files.length}, tweets=${caseTweets}, media=${caseMedia}, users=${caseUsers}${orderedText}`);
  }

  console.log(`Totals: tweets=${totalTweets}, media=${totalMedia}`);
}

main();
