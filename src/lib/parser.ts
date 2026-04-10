import { mergeEntity } from './entity-merge';
import { flattenTweet, flattenUser } from './tweet-flattener';
import { parseAndNormalizeTweetResult, parseAndNormalizeUserResult } from './tweet-normalizer';
import type { ParsedResponse } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function createParsedResponse(instructionPath: string | null = null, warnings: string[] = []): ParsedResponse {
  return {
    users: new Map(),
    tweets: new Map(),
    media: new Map(),
    meta: {
      instructionPath,
      warnings: [...warnings],
    },
  };
}

function appendWarnings(ctx: ParsedResponse, warnings: string[]): void {
  if (!ctx.meta || warnings.length === 0) return;
  ctx.meta.warnings.push(...warnings);
}

function upsertParsedEntity<T extends { id: string }>(map: Map<string, T>, entity: T): void {
  const existing = map.get(entity.id);
  if (existing) {
    mergeEntity(existing as Record<string, unknown>, entity as Record<string, unknown>);
    return;
  }
  map.set(entity.id, entity);
}

function mergeParsedResponse(target: ParsedResponse, source: ParsedResponse): void {
  for (const user of source.users.values()) {
    upsertParsedEntity(target.users, user);
  }
  for (const tweet of source.tweets.values()) {
    upsertParsedEntity(target.tweets, tweet);
  }
  for (const media of source.media.values()) {
    upsertParsedEntity(target.media, media);
  }
}

function parseAndCollectTweet(
  result: unknown,
  resultPath: string,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  const parsed = parseAndNormalizeTweetResult(result, resultPath);
  appendWarnings(ctx, parsed.warnings);

  if (!parsed.tweet) return;

  mergeParsedResponse(ctx, flattenTweet(parsed.tweet));

  if (!orderedIds || !seenIds || seenIds.has(parsed.tweet.id)) return;
  seenIds.add(parsed.tweet.id);
  orderedIds.push(parsed.tweet.id);
}

function parseAndCollectUser(
  result: unknown,
  resultPath: string,
  ctx: ParsedResponse,
): void {
  const parsed = parseAndNormalizeUserResult(result, resultPath);
  appendWarnings(ctx, parsed.warnings);
  if (!parsed.user) return;

  mergeParsedResponse(ctx, flattenUser(parsed.user));
}

function walkModuleItem(
  item: unknown,
  itemPath: string,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  const tweetResult = (item as {
    item?: {
      itemContent?: {
        tweet_results?: { result?: unknown };
      };
    };
  })?.item?.itemContent?.tweet_results?.result;

  if (tweetResult !== undefined) {
    parseAndCollectTweet(tweetResult, `${itemPath}.item.itemContent.tweet_results.result`, ctx, orderedIds, seenIds);
  }
}

function walkEntryContent(
  content: unknown,
  contentPath: string,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  if (!isPlainObject(content)) return;

  const itemResult = (content as {
    itemContent?: {
      tweet_results?: { result?: unknown };
    };
    items?: unknown[];
  }).itemContent?.tweet_results?.result;

  if (itemResult !== undefined) {
    parseAndCollectTweet(itemResult, `${contentPath}.itemContent.tweet_results.result`, ctx, orderedIds, seenIds);
  }

  const items = (content as { items?: unknown[] }).items;
  if (Array.isArray(items)) {
    for (const [index, item] of items.entries()) {
      walkModuleItem(item, `${contentPath}.items[${index}]`, ctx, orderedIds, seenIds);
    }
  }
}

function walkEntry(
  entry: unknown,
  entryPath: string,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  const content = (entry as { content?: unknown })?.content;
  if (content !== undefined) {
    walkEntryContent(content, `${entryPath}.content`, ctx, orderedIds, seenIds);
  }
}

interface InstructionCandidate {
  path: string;
  read: (response: Record<string, unknown>) => unknown;
}

interface InstructionExtraction {
  instructions: unknown[];
  instructionPath: string | null;
  warnings: string[];
}

const TIMELINE_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  {
    path: 'data.user.result.timeline.timeline.instructions',
    read: (response) => (response as any)?.data?.user?.result?.timeline?.timeline?.instructions,
  },
  {
    path: 'data.user.result.timeline_v2.timeline.instructions',
    read: (response) => (response as any)?.data?.user?.result?.timeline_v2?.timeline?.instructions,
  },
  {
    path: 'data.home.home_timeline_urt.instructions',
    read: (response) => (response as any)?.data?.home?.home_timeline_urt?.instructions,
  },
  {
    path: 'data.bookmark_timeline_v2.timeline.instructions',
    read: (response) => (response as any)?.data?.bookmark_timeline_v2?.timeline?.instructions,
  },
  {
    path: 'data.search_by_raw_query.search_timeline.timeline.instructions',
    read: (response) => (response as any)?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions,
  },
];

const TWEET_DETAIL_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  {
    path: 'data.threaded_conversation_with_injections_v2.instructions',
    read: (response) => (response as any)?.data?.threaded_conversation_with_injections_v2?.instructions,
  },
];

function extractInstructionArray(
  json: unknown,
  candidates: InstructionCandidate[],
  label: string,
): InstructionExtraction {
  if (!isPlainObject(json)) {
    return {
      instructions: [],
      instructionPath: null,
      warnings: [`${label} response was not an object`],
    };
  }

  const response = json as Record<string, unknown>;

  for (const candidate of candidates) {
    const value = candidate.read(response);
    if (Array.isArray(value)) {
      return {
        instructions: value,
        instructionPath: candidate.path,
        warnings: [],
      };
    }
  }

  const warnings: string[] = [];
  for (const candidate of candidates) {
    const value = candidate.read(response);
    if (value !== undefined) {
      warnings.push(`${label} instructions at ${candidate.path} were not an array`);
    }
  }
  warnings.push(`No ${label} instructions found at known paths`);

  return {
    instructions: [],
    instructionPath: null,
    warnings,
  };
}

function walkInstruction(
  instruction: unknown,
  instructionPath: string,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  if (!instruction || typeof instruction !== 'object') return;

  const instructionObject = instruction as {
    entries?: unknown[];
    entry?: unknown;
    moduleItems?: unknown[];
  };

  if (Array.isArray(instructionObject.entries)) {
    for (const [index, entry] of instructionObject.entries.entries()) {
      walkEntry(entry, `${instructionPath}.entries[${index}]`, ctx, orderedIds, seenIds);
    }
  }

  if (instructionObject.entry !== undefined) {
    walkEntry(instructionObject.entry, `${instructionPath}.entry`, ctx, orderedIds, seenIds);
  }

  if (Array.isArray(instructionObject.moduleItems)) {
    for (const [index, item] of instructionObject.moduleItems.entries()) {
      walkModuleItem(item, `${instructionPath}.moduleItems[${index}]`, ctx, orderedIds, seenIds);
    }
  }
}

export interface TimelineParsedResponse extends ParsedResponse {
  tweetIds: string[];
}

export interface UserMediaParsedResponse extends TimelineParsedResponse {}

export interface BookmarksParsedResponse extends TimelineParsedResponse {}

function parseTimelineResponse(json: unknown): TimelineParsedResponse {
  const extracted = extractInstructionArray(json, TIMELINE_INSTRUCTION_CANDIDATES, 'timeline');
  const ctx: TimelineParsedResponse = {
    ...createParsedResponse(extracted.instructionPath, extracted.warnings),
    tweetIds: [],
  };

  const seenOrderedIds = new Set<string>();
  for (const [index, instruction] of extracted.instructions.entries()) {
    const instructionPath = extracted.instructionPath
      ? `${extracted.instructionPath}[${index}]`
      : `instructions[${index}]`;
    walkInstruction(instruction, instructionPath, ctx, ctx.tweetIds, seenOrderedIds);
  }

  return ctx;
}

export function parseHomeTimelineResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseHomeLatestTimelineResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseUserTweetsResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseUserTweetsAndRepliesResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseUserMediaResponse(json: unknown): UserMediaParsedResponse {
  return parseTimelineResponse(json);
}

export function parseBookmarksResponse(json: unknown): BookmarksParsedResponse {
  return parseTimelineResponse(json);
}

export function parseSearchTimelineResponse(json: unknown): TimelineParsedResponse {
  return parseTimelineResponse(json);
}

export function parseTweetDetailResponse(json: unknown): ParsedResponse {
  const extracted = extractInstructionArray(json, TWEET_DETAIL_INSTRUCTION_CANDIDATES, 'tweet detail');
  const ctx = createParsedResponse(extracted.instructionPath, extracted.warnings);

  for (const [index, instruction] of extracted.instructions.entries()) {
    const instructionPath = extracted.instructionPath
      ? `${extracted.instructionPath}[${index}]`
      : `instructions[${index}]`;
    walkInstruction(instruction, instructionPath, ctx);
  }

  return ctx;
}

export function parseUserByScreenNameResponse(json: unknown): ParsedResponse {
  if (!isPlainObject(json)) {
    return createParsedResponse(null, ['user response was not an object']);
  }

  const result = (json as any)?.data?.user?.result;
  const ctx = createParsedResponse('data.user.result');

  if (result === undefined) {
    appendWarnings(ctx, ['No user result found at data.user.result']);
    return ctx;
  }

  parseAndCollectUser(result, 'data.user.result', ctx);
  return ctx;
}

export function parseUsersByRestIdsResponse(json: unknown): ParsedResponse {
  if (!isPlainObject(json)) {
    return createParsedResponse(null, ['users response was not an object']);
  }

  const usersRoot = (json as any)?.data?.users;
  const ctx = createParsedResponse('data.users');

  if (Array.isArray(usersRoot)) {
    for (const [index, user] of usersRoot.entries()) {
      parseAndCollectUser(user, `data.users[${index}]`, ctx);
    }
    return ctx;
  }

  if (isPlainObject(usersRoot)) {
    for (const [key, user] of Object.entries(usersRoot)) {
      const keyLabel = /^\d+$/.test(key) ? key : JSON.stringify(key);
      parseAndCollectUser(user, `data.users[${keyLabel}]`, ctx);
    }
    return ctx;
  }

  appendWarnings(ctx, ['No users collection found at data.users']);
  return ctx;
}
