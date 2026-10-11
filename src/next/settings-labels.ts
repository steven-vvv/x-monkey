import type { RemoteDbClientState } from '../lib/remote-db/types';
import type { ThemeMode } from '../lib/config-service';

export const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'page', label: '跟随页面' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

export const UI_VERSION_OPTIONS = [
  { value: 'next' as const, label: '新版' },
  { value: 'classic' as const, label: '旧版' },
];

export const SCALE_OPTIONS = [25, 50, 75, 100, 125, 150, 175, 200];

export const BASE_URL_ERROR = '请输入完整的 http(s) 地址，例如 https://example.com';

export function isRemoteChecking(state: RemoteDbClientState): boolean {
  return state.lifecycle === 'initializing' || state.sessionState === 'checking';
}

export type RemoteStatusTone = 'neutral' | 'ok' | 'warn' | 'danger';

/** Same derivation as the classic SettingsTab, in Chinese and with a pill tone. */
export function describeRemoteStatus(state: RemoteDbClientState): { text: string; tone: RemoteStatusTone } {
  if (!state.enabled || !state.runtimeEnabled || state.lifecycle === 'paused') return { text: '已停用', tone: 'neutral' };
  if (state.lifecycle === 'unconfigured') return { text: '未配置', tone: 'neutral' };
  if (isRemoteChecking(state)) return { text: '检测中…', tone: 'neutral' };
  if (state.lifecycle === 'ready' && state.sessionState === 'authenticated') {
    const username = state.session?.username?.trim();
    return { text: username ? `已登录 · ${username}` : '已连接', tone: 'ok' };
  }
  if (state.sessionState === 'anonymous') return { text: '需要登录', tone: 'warn' };
  if (state.sessionState === 'pending_registration') return { text: '需完成注册', tone: 'warn' };
  if (state.lifecycle === 'error' || state.sessionState === 'error') {
    return { text: state.lastError?.trim() || '连接失败', tone: 'danger' };
  }
  return { text: '未配置', tone: 'neutral' };
}

export function remoteHint(configurable: boolean): string {
  return configurable
    ? '“检测”立即在内存中应用当前开关与地址；“保存”才会写入存储。查询需要已注册账户，提交需要管理员。'
    : '“检测”重新检测可用性；“保存”写入开关设置。查询需要已注册账户，提交需要管理员。';
}
