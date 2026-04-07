import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SUPPORTED_ENDPOINTS, getEndpointFixtureDirs, type EndpointKind } from '../src/lib/endpoint-support';

type JsonObject = Record<string, any>;

interface EndpointConfig {
  name: string;
  dirs: readonly string[];
  kind: EndpointKind;
  supportVersion: number | null;
}

interface EndpointStats {
  files: number;
  tweets: number;
  instructionTypes: Map<string, number>;
  tweetPaths: Set<string>;
  typenames: Map<string, number>;
  noteTweet: number;
  noteTweetLonger: number;
  quoted: number;
  quotedFallbackOnly: number;
  retweeted: number;
  card: number;
  article: number;
  userProfileUrl: number;
  userVerifiedType: number;
  userProfessionalType: number;
  userProfileImageShape: number;
}

const ROOT = resolve(process.cwd());
const ENDPOINTS: EndpointConfig[] = [
  ...SUPPORTED_ENDPOINTS.map((endpoint) => ({
    name: endpoint.operationName,
    dirs: getEndpointFixtureDirs(endpoint),
    kind: endpoint.kind,
    supportVersion: endpoint.supportVersion,
  })),
  { name: 'legacy/UserMedia', dirs: ['dumps/legacy/UserMedia'], kind: 'timeline', supportVersion: null },
];

function readJson(filePath: string): JsonObject {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function normalizeTweetResult(result: any): JsonObject | null {
  if (!result || typeof result !== 'object') return null;
  if (result.__typename === 'TweetWithVisibilityResults' && result.tweet) {
    return { __typename: 'Tweet', ...result.tweet };
  }
  return result;
}

function collectTimelineTweets(json: JsonObject) {
  const instructions = json?.data?.user?.result?.timeline?.timeline?.instructions
    ?? json?.data?.home?.home_timeline_urt?.instructions
    ?? json?.data?.bookmark_timeline_v2?.timeline?.instructions;

  const tweets: JsonObject[] = [];
  const instructionTypes = new Map<string, number>();
  const tweetPaths = new Set<string>();

  if (!Array.isArray(instructions)) {
    return { instructions: [], tweets, instructionTypes, tweetPaths };
  }

  const visitResult = (result: any, pathLabel: string) => {
    const normalized = normalizeTweetResult(result);
    if (!normalized) return;
    tweets.push(normalized);
    tweetPaths.add(pathLabel);
  };

  for (const instruction of instructions) {
    const type = typeof instruction?.type === 'string' ? instruction.type : '(unknown)';
    instructionTypes.set(type, (instructionTypes.get(type) ?? 0) + 1);

    if (Array.isArray(instruction?.entries)) {
      for (const entry of instruction.entries) {
        if (entry?.content?.itemContent?.tweet_results?.result) {
          visitResult(entry.content.itemContent.tweet_results.result, 'entries[].content.itemContent.tweet_results.result');
        }
        if (Array.isArray(entry?.content?.items)) {
          for (const item of entry.content.items) {
            if (item?.item?.itemContent?.tweet_results?.result) {
              visitResult(item.item.itemContent.tweet_results.result, 'entries[].content.items[].item.itemContent.tweet_results.result');
            }
          }
        }
      }
    }

    if (Array.isArray(instruction?.moduleItems)) {
      for (const item of instruction.moduleItems) {
        if (item?.item?.itemContent?.tweet_results?.result) {
          visitResult(item.item.itemContent.tweet_results.result, 'moduleItems[].item.itemContent.tweet_results.result');
        }
      }
    }

    if (instruction?.entry?.content?.itemContent?.tweet_results?.result) {
      visitResult(instruction.entry.content.itemContent.tweet_results.result, 'entry.content.itemContent.tweet_results.result');
    }
  }

  return { instructions, tweets, instructionTypes, tweetPaths };
}

function collectTweetDetailTweets(json: JsonObject) {
  const instructions = json?.data?.threaded_conversation_with_injections_v2?.instructions;
  const tweets: JsonObject[] = [];
  const instructionTypes = new Map<string, number>();
  const tweetPaths = new Set<string>();

  if (!Array.isArray(instructions)) {
    return { instructions: [], tweets, instructionTypes, tweetPaths };
  }

  const visitResult = (result: any, pathLabel: string) => {
    const normalized = normalizeTweetResult(result);
    if (!normalized) return;
    tweets.push(normalized);
    tweetPaths.add(pathLabel);
  };

  for (const instruction of instructions) {
    const type = typeof instruction?.type === 'string' ? instruction.type : '(unknown)';
    instructionTypes.set(type, (instructionTypes.get(type) ?? 0) + 1);

    if (!Array.isArray(instruction?.entries)) continue;
    for (const entry of instruction.entries) {
      if (entry?.content?.itemContent?.tweet_results?.result) {
        visitResult(entry.content.itemContent.tweet_results.result, 'entries[].content.itemContent.tweet_results.result');
      }
      if (Array.isArray(entry?.content?.items)) {
        for (const item of entry.content.items) {
          if (item?.item?.itemContent?.tweet_results?.result) {
            visitResult(item.item.itemContent.tweet_results.result, 'entries[].content.items[].item.itemContent.tweet_results.result');
          }
        }
      }
    }
  }

  return { instructions, tweets, instructionTypes, tweetPaths };
}

function collectStats(config: EndpointConfig): EndpointStats {
  const stats: EndpointStats = {
    files: 0,
    tweets: 0,
    instructionTypes: new Map(),
    tweetPaths: new Set(),
    typenames: new Map(),
    noteTweet: 0,
    noteTweetLonger: 0,
    quoted: 0,
    quotedFallbackOnly: 0,
    retweeted: 0,
    card: 0,
    article: 0,
    userProfileUrl: 0,
    userVerifiedType: 0,
    userProfessionalType: 0,
    userProfileImageShape: 0,
  };

  for (const relativeDir of config.dirs) {
    const dir = join(ROOT, relativeDir);
    const files = readdirSync(dir).filter((file) => file.endsWith('.json')).sort();
    stats.files += files.length;

    for (const file of files) {
      const json = readJson(join(dir, file));
      const collector = config.kind === 'timeline' ? collectTimelineTweets(json) : collectTweetDetailTweets(json);

      for (const [type, count] of collector.instructionTypes) {
        stats.instructionTypes.set(type, (stats.instructionTypes.get(type) ?? 0) + count);
      }
      for (const pathLabel of collector.tweetPaths) {
        stats.tweetPaths.add(pathLabel);
      }

      for (const rawTweet of collector.tweets) {
        stats.tweets++;
        const typename = typeof rawTweet.__typename === 'string' ? rawTweet.__typename : '(unknown)';
        stats.typenames.set(typename, (stats.typenames.get(typename) ?? 0) + 1);

        const legacyText = typeof rawTweet?.legacy?.full_text === 'string' ? rawTweet.legacy.full_text : '';
        const noteText = typeof rawTweet?.note_tweet?.note_tweet_results?.result?.text === 'string'
          ? rawTweet.note_tweet.note_tweet_results.result.text
          : null;
        const quotedResult = rawTweet?.quoted_status_result?.result;
        const retweetedResult = rawTweet?.retweeted_status_result?.result ?? rawTweet?.legacy?.retweeted_status_result?.result;
        const author = rawTweet?.core?.user_results?.result;
        const profileUrl = author?.legacy?.entities?.url?.urls?.find((item: any) => typeof item?.expanded_url === 'string')?.expanded_url;

        if (noteText) stats.noteTweet++;
        if (noteText && noteText.length > legacyText.length) stats.noteTweetLonger++;
        if (quotedResult || rawTweet?.legacy?.quoted_status_id_str) stats.quoted++;
        if (!quotedResult && rawTweet?.legacy?.quoted_status_id_str) stats.quotedFallbackOnly++;
        if (retweetedResult) stats.retweeted++;
        if (rawTweet?.card) stats.card++;
        if (rawTweet?.article) stats.article++;
        if (profileUrl) stats.userProfileUrl++;
        if (author?.verification?.verified_type) stats.userVerifiedType++;
        if (author?.professional?.professional_type) stats.userProfessionalType++;
        if (author?.profile_image_shape) stats.userProfileImageShape++;
      }
    }
  }

  return stats;
}

function mapToInline(map: Map<string, number>): string {
  if (map.size === 0) return '(none)';
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

function setToInline(set: Set<string>): string {
  if (set.size === 0) return '(none)';
  return [...set].sort().join(', ');
}

function printEndpoint(config: EndpointConfig, stats: EndpointStats) {
  console.log(`## ${config.name}`);
  console.log(`- support-version: ${config.supportVersion == null ? 'n/a' : `v${config.supportVersion}`}`);
  console.log(`- files: ${stats.files}`);
  console.log(`- tweets: ${stats.tweets}`);
  console.log(`- instruction-types: ${mapToInline(stats.instructionTypes)}`);
  console.log(`- tweet-paths: ${setToInline(stats.tweetPaths)}`);
  console.log(`- tweet-typenames: ${mapToInline(stats.typenames)}`);
  console.log(`- note-tweet: ${stats.noteTweet} (longer-than-legacy: ${stats.noteTweetLonger})`);
  console.log(`- quoted: ${stats.quoted} (fallback-only: ${stats.quotedFallbackOnly})`);
  console.log(`- retweeted-status-result: ${stats.retweeted}`);
  console.log(`- card/article: ${stats.card}/${stats.article}`);
  console.log(`- user-model-coverage: profileUrl=${stats.userProfileUrl}, verifiedType=${stats.userVerifiedType}, professionalType=${stats.userProfessionalType}, profileImageShape=${stats.userProfileImageShape}`);
  console.log();
}

function printConclusions(statsByName: Map<string, EndpointStats>) {
  const bookmarks = statsByName.get('Bookmarks');
  const newUserMedia = statsByName.get('UserMedia');
  const legacyUserMedia = statsByName.get('legacy/UserMedia');
  const homeTimeline = statsByName.get('HomeTimeline');
  const homeLatestTimeline = statsByName.get('HomeLatestTimeline');
  const userTweets = statsByName.get('UserTweets');

  console.log('## Conclusions');

  if (homeTimeline && homeLatestTimeline && userTweets && newUserMedia) {
    console.log(`- New endpoints share the same timeline traversal pattern as UserMedia: tweet nodes are consistently under itemContent/module items, so one generic timeline parser is sufficient.`);
    console.log(`- Timeline pin entries exist in UserTweets (${userTweets.instructionTypes.get('TimelinePinEntry') ?? 0}), so parser coverage must include instruction.entry in addition to entries/moduleItems.`);
  }

  if (bookmarks) {
    console.log(`- Bookmarks uses a dedicated root path (data.bookmark_timeline_v2.timeline.instructions), but its tweet packaging still matches the generic timeline walker.`);
  }

  if (newUserMedia && legacyUserMedia) {
    console.log(`- UserMedia did not introduce a new entity model. The main change is timeline packaging: new dumps split between TimelineAddEntries and TimelineAddToModule, while the tweet/media payload remains compatible with legacy parsing.`);
    console.log(`- Note Tweet text remains relevant for UserMedia: legacy longer-text cases ${legacyUserMedia.noteTweetLonger}, new longer-text cases ${newUserMedia.noteTweetLonger}.`);
  }

  const noteTweetLongerTotal = [...statsByName.values()].reduce((sum, stats) => sum + stats.noteTweetLonger, 0);
  const quotedFallbackTotal = [...statsByName.values()].reduce((sum, stats) => sum + stats.quotedFallbackOnly, 0);
  const retweetedTotal = [...statsByName.values()].reduce((sum, stats) => sum + stats.retweeted, 0);
  const userProfileUrlTotal = [...statsByName.values()].reduce((sum, stats) => sum + stats.userProfileUrl, 0);

  console.log(`- Suggested tweet-model updates: prefer note_tweet text (${noteTweetLongerTotal} longer-text cases), keep quoted_status_id_str fallback (${quotedFallbackTotal} fallback-only cases), and parse retweeted_status_result (${retweetedTotal} cases).`);
  console.log(`- Suggested user-model updates: profile URL, verified type, professional type, and profile image shape are already present in payloads and can be stored now for later profile pages (${userProfileUrlTotal} profile URLs observed).`);
}

function main() {
  console.log('# Dump Endpoint Analysis');
  console.log();

  const statsByName = new Map<string, EndpointStats>();

  for (const endpoint of ENDPOINTS) {
    const stats = collectStats(endpoint);
    statsByName.set(endpoint.name, stats);
    printEndpoint(endpoint, stats);
  }

  printConclusions(statsByName);
}

main();
