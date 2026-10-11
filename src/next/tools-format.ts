/** Formatting and copy for the "工具" views (XHR capture list and detail). Pure functions, no store access. */
import type { CapturedXhr } from '../lib/xhr-capture-service';

/** Characters of a body shown in the detail view; the full content is copied / downloaded. */
export const PREVIEW_LIMIT = 4000;
export const PREVIEW_NOTE = `仅预览前 ${PREVIEW_LIMIT} 字符，完整内容请下载。`;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** Local `HH:mm:ss`. */
export function formatClock(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function durationMs(capture: Pick<CapturedXhr, 'startedAt' | 'timestamp'>): number {
  return Math.max(0, capture.timestamp - capture.startedAt);
}

/** `/path?query` of a page URL (the URL itself when it does not parse). */
export function formatPagePath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export type StatusTone = 'ok' | 'warn' | 'danger';

export function statusTone(status: number): StatusTone {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 400) return 'danger';
  return 'warn';
}

export function itemCountLabel(count: number): string {
  return `${count} 项`;
}

/** Hint for a collapsed fold: item count for a JSON object / array, otherwise the text size. */
export function foldHint(text: string, parsed?: unknown): string {
  if (parsed !== null && typeof parsed === 'object') {
    return itemCountLabel(Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length);
  }
  return formatSize(text.length);
}

export interface JsonToken {
  text: string;
  kind: '' | 'k' | 's';
}

const STRING_RE = /"(?:[^"\\\n]|\\.)*"/g;

/** Splits JSON-looking text into plain / key / string tokens (rendered as text nodes, never as HTML). */
export function tokenizeJson(text: string): JsonToken[] {
  if (!/^\s*[{[]/.test(text)) return [{ text, kind: '' }];
  const tokens: JsonToken[] = [];
  let last = 0;
  for (const match of text.matchAll(STRING_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > last) tokens.push({ text: text.slice(last, start), kind: '' });
    const isKey = /^\s*:/.test(text.slice(end, end + 8));
    tokens.push({ text: match[0], kind: isKey ? 'k' : 's' });
    last = end;
  }
  if (last < text.length) tokens.push({ text: text.slice(last), kind: '' });
  return tokens;
}

export const TOOLS_COPY = {
  entryTitle: 'XHR 请求捕获',
  entryDesc: '记录 X 的 GraphQL 请求，导出为 JSON 供解析器调试',
  emptyIdle: '点击“开始录制”后，新的 GraphQL 请求会出现在这里',
  emptyRecording: '正在等待请求…',
  notFound: '未找到该请求',
} as const;

export function requestCountLabel(count: number): string {
  return `${count} 个请求`;
}
