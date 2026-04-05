import { mergeEntity } from './entity-merge';
import { flattenTweet } from './tweet-flattener';
import { parseAndNormalizeTweetResult } from './tweet-normalizer';
import type { ParsedResponse } from './types';

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
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  const tweet = parseAndNormalizeTweetResult(result);
  if (!tweet) return;

  mergeParsedResponse(ctx, flattenTweet(tweet));

  if (!orderedIds || !seenIds || seenIds.has(tweet.id)) return;
  seenIds.add(tweet.id);
  orderedIds.push(tweet.id);
}

function walkModuleItem(
  item: unknown,
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

  if (tweetResult) {
    parseAndCollectTweet(tweetResult, ctx, orderedIds, seenIds);
  }
}

function walkEntryContent(
  content: unknown,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  if (!content || typeof content !== 'object') return;

  const itemResult = (content as {
    itemContent?: {
      tweet_results?: { result?: unknown };
    };
    items?: unknown[];
  }).itemContent?.tweet_results?.result;

  if (itemResult) {
    parseAndCollectTweet(itemResult, ctx, orderedIds, seenIds);
  }

  const items = (content as { items?: unknown[] }).items;
  if (Array.isArray(items)) {
    for (const item of items) {
      walkModuleItem(item, ctx, orderedIds, seenIds);
    }
  }
}

function walkEntry(
  entry: unknown,
  ctx: ParsedResponse,
  orderedIds?: string[],
  seenIds?: Set<string>,
): void {
  const content = (entry as { content?: unknown })?.content;
  if (content) {
    walkEntryContent(content, ctx, orderedIds, seenIds);
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
  if (!json || typeof json !== 'object') {
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
    for (const entry of instructionObject.entries) {
      walkEntry(entry, ctx, orderedIds, seenIds);
    }
  }

  if (instructionObject.entry) {
    walkEntry(instructionObject.entry, ctx, orderedIds, seenIds);
  }

  if (Array.isArray(instructionObject.moduleItems)) {
    for (const item of instructionObject.moduleItems) {
      walkModuleItem(item, ctx, orderedIds, seenIds);
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
  for (const instruction of extracted.instructions) {
    walkInstruction(instruction, ctx, ctx.tweetIds, seenOrderedIds);
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

export function parseUserMediaResponse(json: unknown): UserMediaParsedResponse {
  return parseTimelineResponse(json);
}

export function parseBookmarksResponse(json: unknown): BookmarksParsedResponse {
  return parseTimelineResponse(json);
}

export function parseTweetDetailResponse(json: unknown): ParsedResponse {
  const extracted = extractInstructionArray(json, TWEET_DETAIL_INSTRUCTION_CANDIDATES, 'tweet detail');
  const ctx = createParsedResponse(extracted.instructionPath, extracted.warnings);

  for (const instruction of extracted.instructions) {
    walkInstruction(instruction, ctx);
  }

  return ctx;
}
