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

export function ingestTimeline(input: TimelineIngestInput): { changed: boolean; key: string } {
  if (!input.key || input.postIds.length === 0) {
    return { changed: false, key: input.key };
  }

  const record = ensureTimelineRecord(input);
  // Scrolling down requests the bottom cursor of the page above: the new page goes right below it.
  const pageAbove = input.cursor ? record.pageEnds.get(input.cursor) : undefined;
  if (input.bottomCursor) record.pageEnds.set(input.bottomCursor, input.postIds[input.postIds.length - 1]);
  const newTweetIds: string[] = [];

  for (const postId of input.postIds) {
    if (!postId || record.seenIds.has(postId)) continue;
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
