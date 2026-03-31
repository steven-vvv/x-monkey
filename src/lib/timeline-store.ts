import { reactive, ref } from 'vue';

interface TimelineRecord {
  tweetIds: string[];
  seenIds: Set<string>;
  version: number;
}

const timelineState = reactive<Record<string, TimelineRecord>>({});

function ensureTimeline(key: string): TimelineRecord {
  if (!timelineState[key]) {
    timelineState[key] = {
      tweetIds: [],
      seenIds: new Set<string>(),
      version: 0,
    };
  }
  return timelineState[key];
}

export function ingestTimeline(key: string, tweetIds: string[]): boolean {
  if (!key || tweetIds.length === 0) return false;

  const record = ensureTimeline(key);
  let changed = false;

  for (const tweetId of tweetIds) {
    if (!tweetId || record.seenIds.has(tweetId)) continue;
    record.seenIds.add(tweetId);
    record.tweetIds.push(tweetId);
    changed = true;
  }

  if (changed) {
    record.version++;
  }

  return changed;
}

export function getTimelineTweetIds(key: string): string[] {
  return timelineState[key]?.tweetIds ?? [];
}

export function getTimelineVersion(key: string): number {
  return timelineState[key]?.version ?? 0;
}

export function clearTimeline(key?: string): void {
  if (key) {
    const record = ensureTimeline(key);
    record.tweetIds = [];
    record.seenIds = new Set<string>();
    record.version++;
    return;
  }

  for (const timelineKey of Object.keys(timelineState)) {
    clearTimeline(timelineKey);
  }
}

const activeUserMediaTimelineKey = ref('UserMedia');

export function setActiveUserMediaTimelineKey(key: string): void {
  activeUserMediaTimelineKey.value = key || 'UserMedia';
}

export function getUserMediaTimelineKey(): string {
  return activeUserMediaTimelineKey.value;
}
