import type { DbTweetRecord, DbUserRecord } from './types';

export interface StatItem {
  label: string;
  value: string;
}

export function formatTweetDate(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
