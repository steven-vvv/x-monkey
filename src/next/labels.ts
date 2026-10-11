/** Chinese UI copy for the redesigned UI. Does not touch the English labels in lib/feature-timeline.ts (classic uses them). */
import type { RemoteRecordStatus } from '../lib/remote-db';
import type { FeatureTimelineSort, FeatureTimelineSource } from '../lib/feature-timeline';
import type { Media, Poll, Post, PostCounts, User } from '../archive/model';
import type { IconName } from './icons';
import { formatCount, formatTweetDateTime, getMediaSensitivityOverlayText } from '../lib/view-format';

export { formatCount, formatDateTime } from '../lib/view-format';

const SOURCE_LABELS: Record<FeatureTimelineSource, string> = {
  'user-posts': '帖子',
  'user-all': '全部',
  'user-highlights': '精选',
  'user-replies': '回复',
  'user-reposts': '转帖',
  'user-articles': '文章',
  'user-videos': '视频',
  'user-photos': '照片',
  'bookmarks': '书签',
  'likes': '喜欢',
  'search-top': '热门',
  'search-latest': '最新',
  'search-media': '媒体',
  'home-timeline': '为你推荐',
  'home-latest-timeline': '关注',
};

const POPULAR_SUFFIX = ' · 热门';

/** Timeline name, e.g. "关注 · 热门". */
export function timelineLabel(source: FeatureTimelineSource, sort?: FeatureTimelineSort): string {
  return SOURCE_LABELS[source] + (sort === 'popular' ? POPULAR_SUFFIX : '');
}

const USER_LIST_SOURCES: ReadonlySet<FeatureTimelineSource> = new Set([
  'user-posts', 'user-all', 'user-highlights', 'user-replies', 'user-reposts', 'user-articles', 'user-videos', 'user-photos',
]);
const SEARCH_SOURCES: ReadonlySet<FeatureTimelineSource> = new Set(['search-top', 'search-latest', 'search-media']);

/** Navbar title for a timeline route: `@handle` + label, `搜索：q` + label, or just the label. */
export function timelineNavTitle(source: FeatureTimelineSource, scope: string | undefined, sort?: FeatureTimelineSort): { title: string; subtitle?: string } {
  const label = timelineLabel(source, sort);
  if (USER_LIST_SOURCES.has(source) && scope) return { title: `@${scope}`, subtitle: label };
  if (SEARCH_SOURCES.has(source) && scope) return { title: `搜索：${scope}`, subtitle: label };
  return { title: label };
}

export const SYNC_STATUS_TITLES: Record<RemoteRecordStatus, string> = {
  in_sync: '已同步',
  stale: '远端计数较旧',
  missing: '远端未归档',
  mismatch: '与远端不一致',
  failed: '远端查询失败',
};

/** Short pill text per status (also used by the archive card). */
export const SYNC_STATUS_PILLS: Record<RemoteRecordStatus, string> = {
  in_sync: '已同步',
  stale: '计数较旧',
  missing: '未归档',
  mismatch: '不一致',
  failed: '查询失败',
};

export const SYNC_STATUS_ORDER: readonly RemoteRecordStatus[] = ['in_sync', 'stale', 'missing', 'mismatch', 'failed'];

const SENSITIVITY_LABELS: Record<string, string> = {
  adult_content: '成人内容',
  graphic_violence: '暴力血腥',
  other: '敏感媒体',
};

/**
 * Overlay label for masked media, or null when nothing is flagged: the lib decides whether there is a warning
 * (media flags, else the post's content warning title); known flags are translated, unknown values stay as the raw value.
 */
export function mediaSensitivityLabel(media: Pick<Media, 'sensitive'>, post?: Pick<Post, 'contentWarning'>): string | null {
  if (getMediaSensitivityOverlayText(media, post) === null) return null;
  const flags = (media.sensitive ?? []).map((flag) => flag.trim()).filter(Boolean);
  if (flags.length === 0) return post?.contentWarning?.title ?? null;
  return [...new Set(flags.map((flag) => SENSITIVITY_LABELS[flag] ?? flag))].join('、');
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Today -> `HH:mm`; this year -> `MM-DD HH:mm`; otherwise `YYYY-MM-DD` (local time). Unparseable input is returned as is. */
export function formatPostTime(createdAt: string, now: Date = new Date()): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const md = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (date.getFullYear() !== now.getFullYear()) return `${date.getFullYear()}-${md}`;
  if (date.getMonth() === now.getMonth() && date.getDate() === now.getDate()) return hm;
  return `${md} ${hm}`;
}

/** Video duration as `m:ss`. */
export function formatDuration(durationMs: number): string {
  const total = Math.round(durationMs / 1000);
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

// --- detail ---

/** Pill tone per remote status. */
export const SYNC_STATUS_TONES: Record<RemoteRecordStatus, 'ok' | 'stale' | 'missing' | 'warn' | 'danger'> = {
  in_sync: 'ok',
  stale: 'stale',
  missing: 'missing',
  mismatch: 'warn',
  failed: 'danger',
};

/** Archive-card pill text: the shared pills, but a failed record reads "失败" ("查询失败" is reserved for a failed query). */
export const ARCHIVE_STATUS_PILLS: Record<RemoteRecordStatus, string> = { ...SYNC_STATUS_PILLS, failed: '失败' };

/** Attention-note prefixes in the archive card (only statuses that need attention). */
export const SYNC_NOTE_PREFIX = { missing: '未归档', mismatch: '不一致', stale: '计数较旧' } as const;

export interface DetailNotice {
  icon: IconName;
  text: string;
  warn?: boolean;
}

const REPLY_POLICY_LABELS: Record<string, string> = {
  ByInvitation: '仅提及的用户',
  mentioned: '仅提及的用户',
  Verified: '仅认证用户',
  verified: '仅认证用户',
  Community: '作者关注的账号',
  following: '仅关注的人',
};
const AI_SOURCE_LABELS: Record<string, string> = { C2paClient: 'C2PA', UserDeclared: '作者声明' };

/** One notice per classic `policyLines` entry (Chinese copy; icons per SPEC §4). */
export function buildPostNotices(post: Post): DetailNotice[] {
  const notices: DetailNotice[] = [];
  if (post.contentWarning) {
    const title = post.contentWarning.title.replace(/^content warning:\s*/i, '');
    notices.push({ icon: 'alert', warn: true, text: `内容警告：${[title, post.contentWarning.text].filter(Boolean).join(' — ')}` });
  }
  if (post.community) notices.push({ icon: 'people', text: `社群：${post.community.name ?? post.community.id}` });
  if (post.replyTo?.tombstone) notices.push({ icon: 'info', text: `回复的帖子不可用：${post.replyTo.tombstone}` });
  if (post.paidPromotion) notices.push({ icon: 'info', text: '付费推广' });
  if (post.aiGenerated) {
    const source = AI_SOURCE_LABELS[post.aiGenerated.source] ?? post.aiGenerated.source;
    notices.push({ icon: 'sparkle', text: post.aiGenerated.media ? `AI 生成媒体（${source}）` : `无 AI 生成媒体（${source}）` });
  }
  if (post.replyPolicy) notices.push({ icon: 'lock', text: `回复限制：${REPLY_POLICY_LABELS[post.replyPolicy] ?? post.replyPolicy}` });
  if (post.sensitive) notices.push({ icon: 'eye-off', text: '可能含敏感内容' });
  if (post.editIds) notices.push({ icon: 'info', text: `已编辑 · 共 ${post.editIds.length} 个版本` });
  if (post.place) notices.push({ icon: 'pin', text: `地点：${post.place.fullName ?? post.place.name ?? post.place.id}` });
  return notices;
}

export interface DetailStat {
  label: string;
  value: string;
  na: boolean;
}

const stat = (label: string, value: number | undefined): DetailStat => ({
  label,
  value: value === undefined ? '–' : formatCount(value),
  na: value === undefined,
});

export function toPostStats(counts: PostCounts | undefined): DetailStat[] {
  return [
    stat('浏览', counts?.views), stat('喜欢', counts?.likes), stat('转帖', counts?.reposts),
    stat('回复', counts?.replies), stat('引用', counts?.quotes), stat('书签', counts?.bookmarks),
  ];
}

export function toProfileStats(user: Pick<User, 'counts'>): DetailStat[] {
  const counts = user.counts;
  return [
    stat('粉丝', counts?.followers), stat('正在关注', counts?.following), stat('帖子', counts?.posts),
    stat('喜欢', counts?.likes), stat('媒体', counts?.mediaPosts),
  ];
}

/** Verified badge text: the verification type, or "Blue" for a plain blue check. */
export function verifiedBadge(user: Pick<User, 'verified'> | undefined): string | null {
  const verified = user?.verified;
  return verified?.type ?? (verified?.blue ? 'Blue' : null);
}

/** `YYYY-MM 加入`, or null when the date is missing / unparseable. */
export function formatJoined(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)} 加入`;
}

export interface PollRowView {
  label: string;
  /** Share of the votes, 0-100; null when counts are unknown. */
  percent: number | null;
  lead: boolean;
}

/** Poll bars (leader highlighted) and the footer line "n 票 · 截止 / 已截止 time". */
export function toPollView(poll: Poll): { rows: PollRowView[]; foot: string } {
  const known = poll.choices.some((choice) => choice.count !== undefined);
  const total = poll.choices.reduce((sum, choice) => sum + (choice.count ?? 0), 0);
  const max = Math.max(...poll.choices.map((choice) => choice.count ?? 0));
  const rows = poll.choices.map((choice) => ({
    label: choice.label,
    percent: known && total > 0 ? (choice.count ?? 0) / total * 100 : known ? 0 : null,
    lead: known && max > 0 && choice.count === max,
  }));
  const parts: string[] = [];
  if (known) parts.push(`${formatCount(total)} 票`);
  if (poll.endsAt) parts.push(`${poll.final ? '已截止' : '截止'} ${formatTweetDateTime(poll.endsAt)}`);
  return { rows, foot: parts.join(' · ') };
}

const PROFILE_INTERSTITIALS: Record<string, string> = {
  sensitive_media: '可能包含敏感内容',
};

/** Profile warning chip text, worded like tweet-db's user page. */
export function profileInterstitialLabel(value: string): string {
  return `资料警告：${PROFILE_INTERSTITIALS[value] ?? value}`;
}

const regionNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });

/** "在 沙特阿拉伯、阿拉伯联合酋长国 不可见" from country codes. */
export function withheldLabel(codes: readonly string[]): string {
  const names = codes.map((code) => {
    try {
      return regionNames.of(code.toUpperCase()) ?? code;
    } catch {
      return code;
    }
  });
  return `在 ${names.join('、')} 不可见`;
}

// ---- home feed pages ----

/** Capture time of a feed page as `HH:mm:ss` (local time). */
export function formatClock(ms: number): string {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export const PAGE_KINDS: Record<'initial' | 'newer' | 'older', { label: string; icon: IconName }> = {
  initial: { label: '首屏', icon: 'home' },
  newer: { label: '更新', icon: 'arrow-up' },
  older: { label: '更早', icon: 'arrow-down' },
};
