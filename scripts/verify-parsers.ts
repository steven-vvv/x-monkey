import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parseHomeLatestTimelineResponse,
  parseHomeTimelineResponse,
  parseTweetDetailResponse,
  parseUserMediaResponse,
  parseUserTweetsResponse,
  type TimelineParsedResponse,
} from '../src/lib/parser';
import type { ParsedResponse, XTweet } from '../src/lib/types';

interface CaseConfig {
  name: string;
  dir: string;
  parse: (json: unknown) => ParsedResponse | TimelineParsedResponse;
  ordered: boolean;
}

const ROOT = resolve(process.cwd());
const CASES: CaseConfig[] = [
  { name: 'HomeTimeline', dir: 'dumps/HomeTimeline', parse: parseHomeTimelineResponse, ordered: true },
  { name: 'HomeLatestTimeline', dir: 'dumps/HomeLatestTimeline', parse: parseHomeLatestTimelineResponse, ordered: true },
  { name: 'UserTweets', dir: 'dumps/UserTweets', parse: parseUserTweetsResponse, ordered: true },
  { name: 'UserMedia', dir: 'dumps/UserMedia', parse: parseUserMediaResponse, ordered: true },
  { name: 'TweetDetail', dir: 'dumps/legacy/TweetDetail', parse: parseTweetDetailResponse, ordered: false },
];

function fail(message: string): never {
  throw new Error(message);
}

function isTimelineParsedResponse(parsed: ParsedResponse | TimelineParsedResponse): parsed is TimelineParsedResponse {
  return Array.isArray((parsed as TimelineParsedResponse).tweetIds);
}

function assertTweetShape(tweet: XTweet, caseName: string) {
  if (!tweet.id) fail(`[${caseName}] empty tweet id`);
  if (!tweet.authorId) fail(`[${caseName}] tweet ${tweet.id} missing authorId`);
  if (tweet.noteText && tweet.fullText !== tweet.noteText) {
    fail(`[${caseName}] tweet ${tweet.id} noteText was not promoted to fullText`);
  }
  if (!tweet.noteText && tweet.fullText !== tweet.legacyFullText) {
    fail(`[${caseName}] tweet ${tweet.id} fullText diverged from legacyFullText without noteText`);
  }
}

function main() {
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
    console.log(`${testCase.name}: files=${files.length}, tweets=${caseTweets}, media=${caseMedia}, users=${caseUsers}${orderedText}`);
  }

  console.log(`Totals: tweets=${totalTweets}, media=${totalMedia}`);
}

main();
