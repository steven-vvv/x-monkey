import type { Media, Poll, Post, PostCounts, User } from '../archive/model';
import { getPlainText } from './post-view';

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

function formatOptionalCount(value: number | undefined): string {
  return value === undefined ? '-' : formatCount(value);
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

export function getMediaSensitivityOverlayText(media: Pick<Media, 'sensitive'>): string | null {
  const warnings = media.sensitive;
  if (!warnings?.length) return null;

  const labels = formatMediaSensitivityWarnings(warnings);
  return labels.length > 0 ? labels.join(', ') : null;
}

export function toTweetCompactCardItem(post: Post, author: User | undefined): TweetCompactCardItem {
  return {
    tweetId: post.id,
    displayName: author?.name ?? '?',
    userName: author?.handle ?? '?',
    dateText: formatTweetDateTime(post.createdAt),
    text: getPlainText(post.text) || post.article?.title || '(no text)',
    mediaCount: post.mediaIds?.length ?? 0,
  };
}

/** One line per poll choice, with its share of the votes when counts are known. */
export function toPollLines(poll: Poll): string[] {
  const total = poll.choices.reduce((sum, choice) => sum + (choice.count ?? 0), 0);
  return poll.choices.map((choice) => {
    if (choice.count === undefined) return choice.label;
    const share = total > 0 ? ` (${(choice.count / total * 100).toFixed(1)}%)` : '';
    return `${choice.label} · ${formatCount(choice.count)}${share}`;
  });
}

export function toTweetStats(counts: PostCounts | undefined): StatItem[] {
  return [
    { label: 'Views', value: formatOptionalCount(counts?.views) },
    { label: 'Likes', value: formatOptionalCount(counts?.likes) },
    { label: 'Reposts', value: formatOptionalCount(counts?.reposts) },
    { label: 'Replies', value: formatOptionalCount(counts?.replies) },
    { label: 'Quotes', value: formatOptionalCount(counts?.quotes) },
    { label: 'Bookmarks', value: formatOptionalCount(counts?.bookmarks) },
  ];
}

export function toTweetSummaryStats(counts: PostCounts | undefined): StatItem[] {
  return [
    { label: 'Replies', value: formatOptionalCount(counts?.replies) },
    { label: 'Reposts', value: formatOptionalCount(counts?.reposts) },
    { label: 'Likes', value: formatOptionalCount(counts?.likes) },
    { label: 'Views', value: formatOptionalCount(counts?.views) },
    { label: 'Quotes', value: formatOptionalCount(counts?.quotes) },
    { label: 'Bookmarks', value: formatOptionalCount(counts?.bookmarks) },
  ];
}

export function toUserStats(user: Pick<User, 'counts'>): StatItem[] {
  const counts = user.counts;
  return [
    { label: 'Followers', value: formatOptionalCount(counts?.followers) },
    { label: 'Following', value: formatOptionalCount(counts?.following) },
    { label: 'Posts', value: formatOptionalCount(counts?.posts) },
    { label: 'Likes', value: formatOptionalCount(counts?.likes) },
    { label: 'Media', value: formatOptionalCount(counts?.mediaPosts) },
  ];
}
