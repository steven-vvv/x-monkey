/** Chinese messages for remote-database submit results and errors; shared by the timeline footer and the detail page's archive card. */
import { RemoteDbHttpError, type RemoteDbSubmitResponse } from '../lib/remote-db';

export interface RemoteMessage {
  tone: 'ok' | 'warn' | 'danger';
  title: string;
  text?: string;
  /** True when the message should offer an "打开设置" action. */
  openSettings?: boolean;
}

/** "接受 a · 未变 u · 部分 p · 失败 f", plus "首个问题：id：原因" when something failed or was partial. */
export function formatSubmitSummary(result: RemoteDbSubmitResponse): string {
  const { summary } = result;
  const counts = `接受 ${summary.accepted} · 未变 ${summary.unchanged} · 部分 ${summary.partial} · 失败 ${summary.failed}`;
  const issue = [...result.posts, ...result.users, ...result.media].find((item) => item.status === 'failed' || item.status === 'partial');
  return issue ? `${counts}\n首个问题：${issue.id}：${issue.reason ?? issue.status}` : counts;
}

/** Banner for a finished submit; failed or partial records turn it into a warning. `verb`: 提交 or 同步. */
export function submitResultMessage(result: RemoteDbSubmitResponse, verb: '提交' | '同步'): RemoteMessage {
  const { failed, partial } = result.summary;
  const text = formatSubmitSummary(result);
  return failed > 0 || partial > 0 ? { tone: 'warn', title: `部分记录未能${verb}`, text } : { tone: 'ok', title: `已${verb}`, text };
}

export function submitSuccessMessage(result: RemoteDbSubmitResponse): RemoteMessage {
  return submitResultMessage(result, '提交');
}

/** Maps a submit / sync failure to a banner message (401 and 403 get dedicated copy). */
export function toRemoteErrorMessage(error: unknown): RemoteMessage {
  if (error instanceof RemoteDbHttpError) {
    if (error.status === 401) return { tone: 'danger', title: '远端会话已过期', text: '请在设置中重新登录后再提交。', openSettings: true };
    if (error.status === 403) return { tone: 'danger', title: '需要贡献者或管理员账户才能提交' };
  }
  const text = error instanceof Error && error.message.trim() ? error.message : '提交到远端数据库失败';
  return { tone: 'danger', title: '提交失败', text };
}
