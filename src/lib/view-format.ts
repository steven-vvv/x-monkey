import { getTweetDisplayText } from './tweet-selectors';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from './types';

export interface StatItem {
  label: string;
  value: string;
}

export interface TweetCompactCardItem {
  tweetId: string;
  displayName: string;
  userName: string;
  dateText: string;
  text: string;
  mediaCount: number;
}

const MEDIA_SENSITIVITY_LABELS: Record<string, string> = {
  adult_content: 'Adult content',
  graphic_violence: 'Graphic violence',
  other: 'Sensitive media',
};

function getLocalDateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: date.getFullYear(),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
    hours: String(date.getHours()).padStart(2, '0'),
    minutes: String(date.getMinutes()).padStart(2, '0'),
    seconds: String(date.getSeconds()).padStart(2, '0'),
  };
}

export function formatTweetDateTime(createdAt: string): string {
  const parts = getLocalDateParts(createdAt);
  if (!parts) return createdAt;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hours}:${parts.minutes}`;
}

export function formatDateTime(value: string): string {
  const parts = getLocalDateParts(value);
  if (!parts) return value;
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hours}:${parts.minutes}:${parts.seconds}`;
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
  return String(value);
}

function formatOptionalCount(value: number | string | undefined): string {
  if (typeof value === 'number') {
    return formatCount(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? value : formatCount(parsed);
  }

  return '-';
}

function toDisplayLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function formatMediaSensitivityWarnings(warnings: readonly string[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  for (const warning of warnings) {
    const normalized = warning.trim();
    if (!normalized) continue;

    const label = MEDIA_SENSITIVITY_LABELS[normalized] ?? toDisplayLabel(normalized);
    const dedupeKey = label.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    labels.push(label);
  }

  return labels;
}

export function getMediaSensitivityOverlayText(media: Pick<DbMediaRecord, 'sensitivityWarnings'>): string | null {
  const warnings = media.sensitivityWarnings;
  if (!warnings?.length) return null;

  const labels = formatMediaSensitivityWarnings(warnings);
  return labels.length > 0 ? labels.join(', ') : null;
}

export function avatarFull(url: string): string {
  return url.replace('_normal.', '_400x400.');
}

export function toTweetCompactCardItem(
  tweet: Pick<DbTweetRecord, 'id' | 'createdAt' | 'content' | 'conversation'>,
  author: Pick<DbUserRecord, 'profile'> | undefined,
): TweetCompactCardItem {
  return {
    tweetId: tweet.id,
    displayName: author?.profile.displayName ?? '?',
    userName: author?.profile.userName ?? '?',
    dateText: formatTweetDateTime(tweet.createdAt),
    text: getTweetDisplayText(tweet) || '(no text)',
    mediaCount: tweet.content.mediaIds.length,
  };
}

export function toTweetStats(tweet: Pick<DbTweetRecord, 'stats'>): StatItem[] {
  return [
    { label: 'Views', value: formatOptionalCount(tweet.stats.views) },
    { label: 'Likes', value: formatOptionalCount(tweet.stats.likes) },
    { label: 'Reposts', value: formatOptionalCount(tweet.stats.reposts) },
    { label: 'Replies', value: formatOptionalCount(tweet.stats.replies) },
    { label: 'Quotes', value: formatOptionalCount(tweet.stats.quotes) },
    { label: 'Bookmarks', value: formatOptionalCount(tweet.stats.bookmarks) },
  ];
}

export function toTweetSummaryStats(tweet: Pick<DbTweetRecord, 'stats'>): StatItem[] {
  return [
    { label: 'Replies', value: formatOptionalCount(tweet.stats.replies) },
    { label: 'Reposts', value: formatOptionalCount(tweet.stats.reposts) },
    { label: 'Likes', value: formatOptionalCount(tweet.stats.likes) },
    { label: 'Views', value: formatOptionalCount(tweet.stats.views) },
    { label: 'Quotes', value: formatOptionalCount(tweet.stats.quotes) },
    { label: 'Bookmarks', value: formatOptionalCount(tweet.stats.bookmarks) },
  ];
}

export function toUserStats(user: Pick<DbUserRecord, 'stats'>): StatItem[] {
  const stats = user.stats;

  return [
    { label: 'Followers', value: formatOptionalCount(stats?.followers) },
    { label: 'Following', value: formatOptionalCount(stats?.following) },
    { label: 'Tweets', value: formatOptionalCount(stats?.tweets) },
    { label: 'Likes', value: formatOptionalCount(stats?.likes) },
    { label: 'Media', value: formatOptionalCount(stats?.mediaPosts) },
    { label: 'Listed', value: formatOptionalCount(stats?.listed) },
  ];
}
