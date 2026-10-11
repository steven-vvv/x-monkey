import { reactive } from 'vue';

/**
 * Timelines are grouped by namespace (an operation plus its sort order, see
 * `getTimelineNamespace`); aliases resolve a profile handle or id to a record.
 */
interface TimelineRecord {
  key: string;
  namespace: string;
  postIds: string[];
  seenIds: Set<string>;
  version: number;
  aliases: Set<string>;
  createdOrder: number;
  /** The last post of each page by the page's bottom cursor. */
  pageEnds: Map<string, string>;
  /** Captured responses that brought new posts, in capture order. */
  pages: TimelinePage[];
  /** Page id by the page's bottom cursor, so a request with that cursor can say which page it continues. */
  pageIdsByBottomCursor: Map<string, number>;
  /** Page id where each post first appeared. */
  firstPageIds: Map<string, number>;
}

export type TimelinePageKind = 'initial' | 'newer' | 'older';

export interface TimelinePage {
  /** 1-based capture order within the timeline; never renumbered. */
  id: number;
  /** ms epoch when the response finished loading (observedAt) or Date.now(). */
  capturedAt: number;
  /** initial: first page of the timeline; older: requested with a known page's bottom cursor; newer: anything else. */
  kind: TimelinePageKind;
  /** For `older`: id of the page whose bottom cursor was requested. */
  continues?: number;
  /** Response order, deduped within the response; may include ids first seen on earlier pages. */
  postIds: string[];
  /** Ids first seen on this page (response order). */
  newPostIds: string[];
}

export type TimelineInsertMode = 'append' | 'prepend';

export interface TimelineIngestInput {
  key: string;
  namespace: string;
  postIds: string[];
  aliases?: string[];
  /** Where a new page goes, unless it continues an earlier page downward. */
  insertMode?: TimelineInsertMode;
  /** The cursor the page was requested with. */
  cursor?: string;
  /** The cursor that requests the page below this one. */
  bottomCursor?: string;
  /** ms epoch the response was captured at; defaults to Date.now(). */
  capturedAt?: number;
}

const timelineState = reactive<Record<string, TimelineRecord>>({});
const timelineAliasIndex = reactive<Record<string, string>>({});
let timelineCreateCounter = 0;

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function makeAliasIndexKey(namespace: string, alias: string): string {
  return `${namespace}:${normalizeAlias(alias)}`;
}

function uniqueAliases(aliases: string[] = []): string[] {
  const normalized = new Set<string>();
  for (const alias of aliases) {
    if (!alias) continue;
    const value = normalizeAlias(alias);
    if (!value) continue;
    normalized.add(value);
  }
  return [...normalized];
}

function findExistingTimelineKey(input: TimelineIngestInput, aliases: string[]): string {
  if (timelineState[input.key]) return input.key;

  for (const alias of aliases) {
    const indexedKey = timelineAliasIndex[makeAliasIndexKey(input.namespace, alias)];
    if (indexedKey && timelineState[indexedKey]) {
      return indexedKey;
    }
  }

  return input.key;
}

function ensureTimelineRecord(input: TimelineIngestInput): TimelineRecord {
  const aliases = uniqueAliases(input.aliases);
  const key = findExistingTimelineKey(input, aliases);

  if (!timelineState[key]) {
    timelineState[key] = {
      key,
      namespace: input.namespace,
      postIds: [],
      seenIds: new Set<string>(),
      version: 0,
      aliases: new Set<string>(),
      createdOrder: ++timelineCreateCounter,
      pageEnds: new Map<string, string>(),
      pages: [],
      pageIdsByBottomCursor: new Map<string, number>(),
      firstPageIds: new Map<string, number>(),
    };
  }

  const record = timelineState[key];
  for (const alias of aliases) {
    record.aliases.add(alias);
    timelineAliasIndex[makeAliasIndexKey(record.namespace, alias)] = key;
  }

  return record;
}

export function buildTimelineRecordKey(namespace: string, scope?: string | null): string {
  const normalizedScope = typeof scope === 'string' ? normalizeAlias(scope) : '';
  return normalizedScope ? `${namespace}:${normalizedScope}` : namespace;
}

function recordPage(
  record: TimelineRecord,
  input: TimelineIngestInput,
  responseIds: string[],
  newPostIds: string[],
): void {
  const id = record.pages.length + 1;
  const continues = input.cursor ? record.pageIdsByBottomCursor.get(input.cursor) : undefined;
  const kind: TimelinePageKind = id === 1 ? 'initial' : continues !== undefined ? 'older' : 'newer';
  const page: TimelinePage = { id, capturedAt: input.capturedAt ?? Date.now(), kind, postIds: responseIds, newPostIds };
  if (kind === 'older') page.continues = continues;
  record.pages.push(page);
  for (const postId of newPostIds) record.firstPageIds.set(postId, id);
  if (input.bottomCursor) record.pageIdsByBottomCursor.set(input.bottomCursor, id);
}

export function ingestTimeline(input: TimelineIngestInput): { changed: boolean; key: string } {
  if (!input.key || input.postIds.length === 0) {
    return { changed: false, key: input.key };
  }

  const record = ensureTimelineRecord(input);
  // Scrolling down requests the bottom cursor of the page above: the new page goes right below it.
  const pageAbove = input.cursor ? record.pageEnds.get(input.cursor) : undefined;
  if (input.bottomCursor) record.pageEnds.set(input.bottomCursor, input.postIds[input.postIds.length - 1]);
  const newTweetIds: string[] = [];
  const responseIds: string[] = [];
  const inResponse = new Set<string>();

  for (const postId of input.postIds) {
    if (!postId) continue;
    if (!inResponse.has(postId)) {
      inResponse.add(postId);
      responseIds.push(postId);
    }
    if (record.seenIds.has(postId)) continue;
    record.seenIds.add(postId);
    newTweetIds.push(postId);
  }

  if (newTweetIds.length === 0) {
    return { changed: false, key: record.key };
  }

  if (pageAbove !== undefined) {
    record.postIds.splice(record.postIds.indexOf(pageAbove) + 1, 0, ...newTweetIds);
  } else if (input.insertMode === 'prepend') {
    record.postIds = [...newTweetIds, ...record.postIds];
  } else {
    record.postIds.push(...newTweetIds);
  }
  recordPage(record, input, responseIds, newTweetIds);
  record.version++;

  return { changed: true, key: record.key };
}

export function resolveTimelineRecordKey(namespace: string, alias?: string | null): string | null {
  if (!alias) {
    return timelineState[namespace] ? namespace : null;
  }

  return timelineAliasIndex[makeAliasIndexKey(namespace, alias)] ?? null;
}

export function getTimelinePostIds(key: string): string[] {
  return timelineState[key]?.postIds ?? [];
}

export function getTimelineVersion(key: string): number {
  return timelineState[key]?.version ?? 0;
}

export function getTimelineCreatedOrder(key: string): number | null {
  return timelineState[key]?.createdOrder ?? null;
}

export function getTimelinePostIdsByAlias(
  namespace: string,
  alias?: string | null,
): string[] {
  const key = resolveTimelineRecordKey(namespace, alias);
  return key ? getTimelinePostIds(key) : [];
}

export function getTimelineVersionByAlias(
  namespace: string,
  alias?: string | null,
): number {
  const key = resolveTimelineRecordKey(namespace, alias);
  return key ? getTimelineVersion(key) : 0;
}

export function getTimelineCreatedOrderByAlias(
  namespace: string,
  alias?: string | null,
): number | null {
  const key = resolveTimelineRecordKey(namespace, alias);
  return key ? getTimelineCreatedOrder(key) : null;
}

/** Captured pages of a timeline in capture order; [] if none. */
export function getTimelinePagesByAlias(namespace: string, alias?: string | null): TimelinePage[] {
  const key = resolveTimelineRecordKey(namespace, alias);
  return (key && timelineState[key]?.pages) || [];
}

/** Page id where the post first appeared in that timeline, if any. */
export function getTimelineFirstPageIdByAlias(
  namespace: string,
  alias: string | null | undefined,
  postId: string,
): number | undefined {
  const key = resolveTimelineRecordKey(namespace, alias);
  return key ? timelineState[key]?.firstPageIds.get(postId) : undefined;
}

export function clearTimelineState(key?: string): void {
  if (key) {
    const record = timelineState[key];
    if (!record) return;

    for (const alias of record.aliases) {
      delete timelineAliasIndex[makeAliasIndexKey(record.namespace, alias)];
    }
    delete timelineState[key];
    return;
  }

  for (const timelineKey of Object.keys(timelineState)) {
    clearTimelineState(timelineKey);
  }

  for (const aliasKey of Object.keys(timelineAliasIndex)) {
    delete timelineAliasIndex[aliasKey];
  }
}
