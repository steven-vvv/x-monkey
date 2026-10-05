import { ArchiveCollector, collectTweet } from '../archive/normalize';
import type { ParsedResponse } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface WalkContext {
  collector: ArchiveCollector;
  /** Top-level post ids in response order; omitted for responses without a meaningful order. */
  orderedIds?: string[];
  seenIds: Set<string>;
}

/** Collects one timeline item; promoted items (ads) are skipped entirely. */
function walkItemContent(itemContent: unknown, path: string, ctx: WalkContext): void {
  if (!isPlainObject(itemContent) || itemContent.promotedMetadata !== undefined) return;

  const result = (itemContent.tweet_results as { result?: unknown } | undefined)?.result;
  if (result === undefined) return;

  const postId = collectTweet(result, `${path}.tweet_results.result`, ctx.collector);
  if (!postId || !ctx.orderedIds || ctx.seenIds.has(postId)) return;
  ctx.seenIds.add(postId);
  ctx.orderedIds.push(postId);
}

function walkModuleItem(item: unknown, path: string, ctx: WalkContext): void {
  walkItemContent((item as { item?: { itemContent?: unknown } })?.item?.itemContent, `${path}.item.itemContent`, ctx);
}

function walkEntry(entry: unknown, path: string, ctx: WalkContext): void {
  const content = (entry as { content?: unknown })?.content;
  if (!isPlainObject(content)) return;

  walkItemContent(content.itemContent, `${path}.content.itemContent`, ctx);
  if (Array.isArray(content.items)) {
    for (const [index, item] of content.items.entries()) {
      walkModuleItem(item, `${path}.content.items[${index}]`, ctx);
    }
  }
}

function walkInstruction(instruction: unknown, path: string, ctx: WalkContext): void {
  if (!isPlainObject(instruction)) return;

  if (Array.isArray(instruction.entries)) {
    for (const [index, entry] of instruction.entries.entries()) {
      walkEntry(entry, `${path}.entries[${index}]`, ctx);
    }
  }
  if (instruction.entry !== undefined) {
    walkEntry(instruction.entry, `${path}.entry`, ctx);
  }
  if (Array.isArray(instruction.moduleItems)) {
    for (const [index, item] of instruction.moduleItems.entries()) {
      walkModuleItem(item, `${path}.moduleItems[${index}]`, ctx);
    }
  }
}

interface InstructionCandidate {
  path: string;
  read: (response: any) => unknown;
}

const TIMELINE_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  { path: 'data.user.result.timeline.timeline.instructions', read: (r) => r?.data?.user?.result?.timeline?.timeline?.instructions },
  { path: 'data.home.home_timeline_urt.instructions', read: (r) => r?.data?.home?.home_timeline_urt?.instructions },
  { path: 'data.bookmark_timeline_v2.timeline.instructions', read: (r) => r?.data?.bookmark_timeline_v2?.timeline?.instructions },
];

const TWEET_DETAIL_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  { path: 'data.threaded_conversation_with_injections_v2.instructions', read: (r) => r?.data?.threaded_conversation_with_injections_v2?.instructions },
];

function parseInstructions(json: unknown, candidates: InstructionCandidate[], label: string, ordered: boolean): TimelineParsedResponse {
  const collector = new ArchiveCollector();
  const ctx: WalkContext = { collector, orderedIds: ordered ? [] : undefined, seenIds: new Set() };
  const candidate = isPlainObject(json) ? candidates.find((item) => Array.isArray(item.read(json))) : undefined;

  if (!candidate) {
    collector.warn(label, isPlainObject(json) ? 'no instructions found at known paths' : 'response was not an object');
  } else {
    for (const [index, instruction] of (candidate.read(json) as unknown[]).entries()) {
      walkInstruction(instruction, `${candidate.path}[${index}]`, ctx);
    }
  }

  return {
    users: collector.users,
    posts: collector.posts,
    media: collector.media,
    postIds: ctx.orderedIds ?? [],
    meta: { instructionPath: candidate?.path ?? null, warnings: collector.warnings },
  };
}

export interface TimelineParsedResponse extends ParsedResponse {
  /** Top-level posts in timeline order. */
  postIds: string[];
}

export function parseTimelineResponse(json: unknown): TimelineParsedResponse {
  return parseInstructions(json, TIMELINE_INSTRUCTION_CANDIDATES, 'timeline', true);
}

export function parseTweetDetailResponse(json: unknown): ParsedResponse {
  return parseInstructions(json, TWEET_DETAIL_INSTRUCTION_CANDIDATES, 'tweet detail', false);
}
