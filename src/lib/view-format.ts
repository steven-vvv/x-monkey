import type { DbTweetRecord, DbUserRecord } from './types';

export interface StatItem {
  label: string;
  value: string;
}

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

export function formatTweetDate(createdAt: string): string {
  const parts = getLocalDateParts(createdAt);
  if (!parts) return createdAt;
  return `${parts.year}-${parts.month}-${parts.day}`;
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

export function avatarFull(url: string): string {
  return url.replace('_normal.', '_400x400.');
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
