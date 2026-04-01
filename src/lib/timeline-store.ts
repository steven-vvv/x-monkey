import { reactive } from 'vue';
import type { SupportedTimelineOperationName } from './endpoint-support';

interface TimelineRecord {
  key: string;
  operationName: SupportedTimelineOperationName;
  tweetIds: string[];
  seenIds: Set<string>;
  version: number;
  aliases: Set<string>;
  createdOrder: number;
}

export type TimelineInsertMode = 'append' | 'prepend';

export interface TimelineIngestInput {
  key: string;
  operationName: SupportedTimelineOperationName;
  tweetIds: string[];
  aliases?: string[];
  insertMode?: TimelineInsertMode;
}

const timelineState = reactive<Record<string, TimelineRecord>>({});
const timelineAliasIndex = reactive<Record<string, string>>({});
let timelineCreateCounter = 0;

function normalizeAlias(alias: string): string {
  return alias.trim().toLowerCase();
}

function makeAliasIndexKey(operationName: SupportedTimelineOperationName, alias: string): string {
  return `${operationName}:${normalizeAlias(alias)}`;
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
    const indexedKey = timelineAliasIndex[makeAliasIndexKey(input.operationName, alias)];
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
      operationName: input.operationName,
      tweetIds: [],
      seenIds: new Set<string>(),
      version: 0,
      aliases: new Set<string>(),
      createdOrder: ++timelineCreateCounter,
    };
  }

  const record = timelineState[key];
  for (const alias of aliases) {
    record.aliases.add(alias);
    timelineAliasIndex[makeAliasIndexKey(record.operationName, alias)] = key;
  }

  return record;
}

export function buildTimelineRecordKey(
  operationName: SupportedTimelineOperationName,
  scope?: string | null,
): string {
  const normalizedScope = typeof scope === 'string' ? normalizeAlias(scope) : '';
  return normalizedScope ? `${operationName}:${normalizedScope}` : operationName;
}

export function ingestTimeline(input: TimelineIngestInput): { changed: boolean; key: string } {
  if (!input.key || input.tweetIds.length === 0) {
    return { changed: false, key: input.key };
  }

  const record = ensureTimelineRecord(input);
  const newTweetIds: string[] = [];

  for (const tweetId of input.tweetIds) {
    if (!tweetId || record.seenIds.has(tweetId)) continue;
    record.seenIds.add(tweetId);
    newTweetIds.push(tweetId);
  }

  if (newTweetIds.length === 0) {
    return { changed: false, key: record.key };
  }

  if (input.insertMode === 'prepend') {
    record.tweetIds = [...newTweetIds, ...record.tweetIds];
  } else {
    record.tweetIds.push(...newTweetIds);
  }
  record.version++;

  return { changed: true, key: record.key };
}

export function resolveTimelineRecordKey(
  operationName: SupportedTimelineOperationName,
  alias?: string | null,
): string | null {
  if (!alias) {
    return timelineState[operationName] ? operationName : null;
  }

  return timelineAliasIndex[makeAliasIndexKey(operationName, alias)] ?? null;
}

export function getTimelineTweetIds(key: string): string[] {
  return timelineState[key]?.tweetIds ?? [];
}

export function getTimelineVersion(key: string): number {
  return timelineState[key]?.version ?? 0;
}

export function getTimelineCreatedOrder(key: string): number | null {
  return timelineState[key]?.createdOrder ?? null;
}

export function getTimelineTweetIdsByAlias(
  operationName: SupportedTimelineOperationName,
  alias?: string | null,
): string[] {
  const key = resolveTimelineRecordKey(operationName, alias);
  return key ? getTimelineTweetIds(key) : [];
}

export function getTimelineVersionByAlias(
  operationName: SupportedTimelineOperationName,
  alias?: string | null,
): number {
  const key = resolveTimelineRecordKey(operationName, alias);
  return key ? getTimelineVersion(key) : 0;
}

export function getTimelineCreatedOrderByAlias(
  operationName: SupportedTimelineOperationName,
  alias?: string | null,
): number | null {
  const key = resolveTimelineRecordKey(operationName, alias);
  return key ? getTimelineCreatedOrder(key) : null;
}

export function clearTimelineState(key?: string): void {
  if (key) {
    const record = timelineState[key];
    if (!record) return;

    for (const alias of record.aliases) {
      delete timelineAliasIndex[makeAliasIndexKey(record.operationName, alias)];
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
