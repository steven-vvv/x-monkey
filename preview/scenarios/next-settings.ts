import type { Scenario, Step } from '../scenarios';

/** New UI: the 设置 tab (F11 / F12). Panel 360x560 unless noted. */
const base = { ui: 'next', tab: 'settings', w: '360', h: '560' } as const;
const theme = (label: string) => `[data-role="theme"] button:has-text("${label}")`;
const toRemote: Step = { scroll: ['.xm-body', 9999] };

export const nextSettingsScenarios: Scenario[] = [
  { name: 'next-settings-light', query: { ...base, bg: 'light' } },
  {
    // F11: two dirty rows (主题 + 尺寸) -> "2 项更改未保存".
    name: 'next-settings-dirty',
    query: { ...base, bg: 'light' },
    steps: [{ click: theme('浅色') }, { fill: ['#xm-set-w', '420'] }, { click: '.xm-group__title' }, { wait: 100 }],
  },
  { name: 'next-settings-remote-ready', query: { ...base, bg: 'dark', remote: 'ready' }, steps: [{ wait: 400 }, toRemote] },
  { name: 'next-settings-remote-anon', query: { ...base, bg: 'dark', remote: 'anon' }, steps: [{ wait: 400 }, toRemote] },
  { name: 'next-settings-remote-error', query: { ...base, bg: 'dark', remote: 'error' }, steps: [{ wait: 400 }, toRemote] },
  { name: 'next-settings-remote-off', query: { ...base, bg: 'light', remote: 'off' }, steps: [toRemote] },
  {
    // F12 second card: invalid URL turns the input red and disables 检测 and 保存.
    name: 'next-settings-url-invalid',
    query: { ...base, bg: 'dark', remote: 'anon' },
    steps: [{ wait: 400 }, { fill: ['#xm-set-url', 'tdb.example'] }, toRemote],
  },
  {
    name: 'next-settings-classic-switch',
    query: { ...base, bg: 'light' },
    steps: [{ click: '[data-role="ui-version"] button:has-text("旧版")' }, { click: '.xd-bubble' }, { wait: 300 }],
  },
  { name: 'next-settings-narrow', query: { ...base, bg: 'light', w: '280' }, steps: [{ click: theme('深色') }] },
  { name: 'next-settings-narrow-anon', query: { ...base, bg: 'dark', remote: 'anon', w: '280' }, steps: [{ wait: 400 }, toRemote] },
];
