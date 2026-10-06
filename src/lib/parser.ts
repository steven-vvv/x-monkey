import { ArchiveCollector, collectTweet, collectUser, readTombstone } from '../archive/normalize';
import type { EndpointKind } from './endpoint-support';
import type { ParsedResponse } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

interface WalkContext {
  collector: ArchiveCollector;
  /** Top-level post ids in response order; omitted for responses without a meaningful order. */
  orderedIds?: string[];
  seenIds: Set<string>;
  /** Notices shown in place of unavailable posts, by the post id in their entry id. */
  tombstones: Map<string, string>;
}

/** Entry ids end with the post id: `tweet-<id>`, `conversationthread-<root>-tweet-<id>`. */
const TWEET_ENTRY_ID = /(?:^|-)tweet-(\d+)$/;
const COMMUNITY_URL = /\/communities\/(\d+)(?:[/?#]|$)/;

/**
 * Names the community of a collected post. The tweet only carries the
 * community id; its name arrives with the timeline item's social context.
 */
function nameCommunity(postId: string, socialContext: unknown, ctx: WalkContext): void {
  if (!isPlainObject(socialContext) || socialContext.contextType !== 'Community') return;
  const post = ctx.collector.posts.get(postId);
  const landingUrl = (socialContext.landingUrl as { url?: unknown } | undefined)?.url;
  const id = typeof landingUrl === 'string' ? COMMUNITY_URL.exec(landingUrl)?.[1] : undefined;
  const name = typeof socialContext.text === 'string' ? socialContext.text.trim() : '';
  if (post?.community && post.community.id === id && name) post.community.name = name;
}

/** Collects one timeline item; promoted items (ads) are skipped entirely. */
function walkItemContent(itemContent: unknown, entryId: unknown, path: string, ctx: WalkContext): void {
  if (!isPlainObject(itemContent) || itemContent.promotedMetadata !== undefined) return;

  const result = (itemContent.tweet_results as { result?: unknown } | undefined)?.result;
  if (result === undefined) return;

  const tombstone = readTombstone(result);
  const tombstoneId = typeof entryId === 'string' ? TWEET_ENTRY_ID.exec(entryId)?.[1] : undefined;
  if (tombstone && tombstoneId) ctx.tombstones.set(tombstoneId, tombstone);

  const postId = collectTweet(result, `${path}.tweet_results.result`, ctx.collector);
  if (postId) nameCommunity(postId, itemContent.socialContext, ctx);
  if (!postId || !ctx.orderedIds || ctx.seenIds.has(postId)) return;
  ctx.seenIds.add(postId);
  ctx.orderedIds.push(postId);
}

function walkModuleItem(item: unknown, path: string, ctx: WalkContext): void {
  const moduleItem = item as { entryId?: unknown; item?: { itemContent?: unknown } } | undefined;
  walkItemContent(moduleItem?.item?.itemContent, moduleItem?.entryId, `${path}.item.itemContent`, ctx);
}

function walkEntry(entry: unknown, path: string, ctx: WalkContext): void {
  const content = (entry as { content?: unknown })?.content;
  if (!isPlainObject(content)) return;

  walkItemContent(content.itemContent, (entry as { entryId?: unknown }).entryId, `${path}.content.itemContent`, ctx);
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
  { path: 'data.search_by_raw_query.search_timeline.timeline.instructions', read: (r) => r?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions },
];

const TWEET_DETAIL_INSTRUCTION_CANDIDATES: InstructionCandidate[] = [
  { path: 'data.threaded_conversation_with_injections_v2.instructions', read: (r) => r?.data?.threaded_conversation_with_injections_v2?.instructions },
];

function parseInstructions(json: unknown, candidates: InstructionCandidate[], label: string, ordered: boolean): TimelineParsedResponse {
  const collector = new ArchiveCollector();
  const ctx: WalkContext = { collector, orderedIds: ordered ? [] : undefined, seenIds: new Set(), tombstones: new Map() };
  const candidate = isPlainObject(json) ? candidates.find((item) => Array.isArray(item.read(json))) : undefined;

  if (!candidate) {
    collector.warn(label, isPlainObject(json) ? 'no instructions found at known paths' : 'response was not an object');
  } else {
    for (const [index, instruction] of (candidate.read(json) as unknown[]).entries()) {
      walkInstruction(instruction, `${candidate.path}[${index}]`, ctx);
    }
  }

  // A reply whose parent X no longer serves keeps the notice shown in its place.
  for (const post of collector.posts.values()) {
    const tombstone = post.replyTo && ctx.tombstones.get(post.replyTo.postId);
    if (tombstone) post.replyTo!.tombstone = tombstone;
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

/**
 * Parses a profile request (`UserByScreenName`). Unavailable accounts, such as
 * suspended ones, come without an id and yield no record.
 */
export function parseUserResponse(json: unknown): ParsedResponse {
  const collector = new ArchiveCollector();
  const path = 'data.user.result';
  const result = (json as { data?: { user?: { result?: unknown } } } | undefined)?.data?.user?.result;
  const typename = isPlainObject(result) ? result.__typename : undefined;
  if (typename === 'User') collectUser(result, path, collector);
  else if (typename !== 'UserUnavailable') collector.warn('user', `no user at ${path}`);

  return {
    users: collector.users,
    posts: collector.posts,
    media: collector.media,
    meta: { instructionPath: typename === 'User' ? path : null, warnings: collector.warnings },
  };
}

/** Parses a response of a supported operation by its kind. */
export function parseEndpointResponse(kind: EndpointKind, json: unknown): ParsedResponse | TimelineParsedResponse {
  if (kind === 'tweet-detail') return parseTweetDetailResponse(json);
  if (kind === 'user') return parseUserResponse(json);
  return parseTimelineResponse(json);
}
