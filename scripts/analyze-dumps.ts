import { loadDumpFixtures } from './dump-fixtures';

type Json = Record<string, any>;

interface OperationStats {
  responses: number;
  tweets: number;
  instructions: Map<string, number>;
  entries: Map<string, number>;
  features: Map<string, number>;
}

function bump(map: Map<string, number>, key: string, count = 1): void {
  map.set(key, (map.get(key) ?? 0) + count);
}

function formatCounts(map: Map<string, number>): string {
  if (map.size === 0) return '(none)';
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, value]) => `${key}:${value}`).join(', ');
}

function findInstructions(response: Json): Json[] {
  const candidates = [
    response?.data?.user?.result?.timeline?.timeline?.instructions,
    response?.data?.home?.home_timeline_urt?.instructions,
    response?.data?.bookmark_timeline_v2?.timeline?.instructions,
    response?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions,
    response?.data?.threaded_conversation_with_injections_v2?.instructions,
  ];
  return candidates.find(Array.isArray) ?? [];
}

/** Records which notable payload features a tweet result carries. */
function recordTweetFeatures(result: Json, features: Map<string, number>): void {
  const tweet = result?.__typename === 'TweetWithVisibilityResults' ? result.tweet : result;
  if (!tweet?.legacy) {
    bump(features, `typename:${result?.__typename ?? '(unknown)'}`);
    return;
  }
  bump(features, `typename:${result.__typename}`);
  const legacy = tweet.legacy;
  if (tweet.note_tweet) bump(features, 'note_tweet');
  if (tweet.card) bump(features, tweet.card.legacy ? `card:${tweet.card.legacy.name}` : 'card:unexpanded');
  if (tweet.article) bump(features, tweet.article.article_results?.result?.content_state ? 'article:full' : 'article:preview');
  if (tweet.quoted_status_result || legacy.quoted_status_id_str) bump(features, 'quote');
  if (tweet.nested_quoted_tweet_results) bump(features, 'nested_quote');
  if (legacy.retweeted_status_result) bump(features, 'repost');
  if (legacy.in_reply_to_status_id_str) bump(features, 'reply');
  if (tweet.birdwatch_pivot) bump(features, 'community_note');
  if (legacy.place) bump(features, 'place');
  if ((tweet.edit_control?.edit_control_initial ?? tweet.edit_control)?.edit_tweet_ids?.length > 1) bump(features, 'edited');
  if (tweet.content_disclosure?.ai_generated_disclosure) bump(features, 'ai_disclosure');
  if (legacy.extended_entities?.media?.length) bump(features, 'media');
  if (tweet.core?.user_results?.result?.legacy) bump(features, 'user:legacy');
}

function walkTweetResults(value: unknown, visit: (result: Json, promoted: boolean) => void, promoted = false): void {
  if (Array.isArray(value)) {
    for (const item of value) walkTweetResults(item, visit, promoted);
    return;
  }
  if (!value || typeof value !== 'object') return;
  const object = value as Json;
  const isPromoted = promoted || object.promotedMetadata !== undefined;
  if (object.tweet_results?.result) visit(object.tweet_results.result, isPromoted);
  for (const [key, child] of Object.entries(object)) {
    // Nested results (quotes, reposts) are counted through their parent.
    if (key !== 'tweet_results') walkTweetResults(child, visit, isPromoted);
  }
}

function main(): void {
  const fixtures = loadDumpFixtures();
  if (fixtures.length === 0) {
    console.log('No fixtures under dumps/ (the directory is gitignored).');
    return;
  }

  const byOperation = new Map<string, OperationStats>();
  for (const fixture of fixtures) {
    const stats = byOperation.get(fixture.operationName) ?? {
      responses: 0, tweets: 0, instructions: new Map(), entries: new Map(), features: new Map(),
    };
    stats.responses += 1;

    for (const instruction of findInstructions(fixture.response as Json)) {
      bump(stats.instructions, instruction?.type ?? '(unknown)');
      const entries = [...(instruction?.entries ?? []), ...(instruction?.entry ? [instruction.entry] : [])];
      for (const entry of entries) {
        const prefix = String(entry?.entryId ?? '(none)').replace(/-\d.*$/, '').replace(/-[0-9a-f]{16,}.*$/, '');
        bump(stats.entries, prefix);
      }
      if (instruction?.moduleItems) bump(stats.entries, 'moduleItems', instruction.moduleItems.length);
    }

    walkTweetResults(fixture.response, (result, promoted) => {
      stats.tweets += 1;
      if (promoted) bump(stats.features, 'promoted');
      recordTweetFeatures(result, stats.features);
    });
    byOperation.set(fixture.operationName, stats);
  }

  console.log('# Dump Analysis');
  console.log(`- fixtures: ${fixtures.length}`);
  console.log();
  for (const [operationName, stats] of [...byOperation.entries()].sort()) {
    console.log(`## ${operationName}`);
    console.log(`- responses: ${stats.responses}, top-level tweet results: ${stats.tweets}`);
    console.log(`- instructions: ${formatCounts(stats.instructions)}`);
    console.log(`- entries: ${formatCounts(stats.entries)}`);
    console.log(`- features: ${formatCounts(stats.features)}`);
    console.log();
  }
}

main();
