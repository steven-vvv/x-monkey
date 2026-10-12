/** Labels for the 持续归档 status (SPEC section 11): phase -> pill text and tone. */
import type { AutoArchivePhase } from '../lib/auto-archive';

export type AutoArchiveTone = 'ok' | 'warn' | 'danger';

export interface AutoArchiveStatus {
  text: string;
  tone: AutoArchiveTone;
}

const TONES: Record<Exclude<AutoArchivePhase, 'off'>, AutoArchiveTone> = {
  idle: 'ok',
  submitting: 'ok',
  paused: 'warn',
  unavailable: 'warn',
  'needs-login': 'warn',
  backoff: 'warn',
  forbidden: 'danger',
};

const TEXTS: Record<Exclude<AutoArchivePhase, 'off' | 'backoff'>, string> = {
  idle: '运行中',
  submitting: '提交中…',
  paused: '已暂停',
  unavailable: '远端不可用',
  'needs-login': '需要登录',
  forbidden: '需要贡献者或管理员账户',
};

/** `null` when the engine is off (no entry point is shown). `now` only matters in `backoff`. */
export function describeAutoArchive(phase: AutoArchivePhase, retryAt: number | null, now: number): AutoArchiveStatus | null {
  if (phase === 'off') return null;
  if (phase === 'backoff') {
    const seconds = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
    return { text: `等待重试 · ${seconds} 秒`, tone: TONES.backoff };
  }
  return { text: TEXTS[phase], tone: TONES[phase] };
}

const HTTP_ERRORS: Record<number, string> = {
  401: '会话已过期',
  403: '需要贡献者或管理员账户',
  413: '请求体过大',
  503: '服务器繁忙',
};

/** Submit error line text: known HTTP statuses in Chinese, other statuses keep the server text. */
export function describeAutoArchiveError(status: number, message: string): string {
  if (status === 0) return '网络错误或超时';
  const known = HTTP_ERRORS[status];
  if (known) return `${known}（${status}）`;
  return status >= 500 ? `服务器错误（${status}）` : `${message}（${status}）`;
}

/** Exact count with thousands separators (1,284); never K/M. */
export function formatExact(value: number): string {
  return value.toLocaleString('en-US');
}

/** Failure ids: `user:123` -> 用户 123, anything else is a post id. */
export function describeFailureId(id: string): { kind: string; id: string } {
  return id.startsWith('user:') ? { kind: '用户', id: id.slice(5) } : { kind: '帖子', id };
}
