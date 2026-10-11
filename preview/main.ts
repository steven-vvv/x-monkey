/**
 * Preview entry: mounts the real App into an OPEN shadow root on a fake x.com page.
 *
 * Query parameters (all optional):
 *   ui=next|classic        theme=page|light|dark     bg=light|dark|dim (page background, drives theme=page)
 *   url=<x.com URL>        tab=feature|database|tools|settings
 *   push=tweet:ID,user:ID,xhr-capture,xhr-detail:ID   (applied to the active tab's stack)
 *   w,h = panel size       x,y = anchor              scale = ui scale in percent
 *   remote=off|ready|anon|expired|error   (default off)
 *   capture=1 seed XHR captures + capturing on        empty=1 do not seed the database
 * Scenario hook: window.__xmPreview.addHomePage(list, kind, count?, repeats?) (see XmPreviewHooks).
 */
import { watch } from 'vue';
import { initConfig, getConfig, updateConfig, type ThemeMode, type UiVersion } from '../src/lib/config-service';
import { initTheme } from '../src/lib/theme-service';
import {
  currentUrl, syncFeatureRoute, setActiveTab, featureNavigateTo, dbNavigateTo, toolsNavigateTo, type TabId,
} from '../src/lib/store';
import { archiveRecords } from '../src/lib/db-service';
import { configureRemoteDbClient } from '../src/lib/remote-db';
import { unsafeWindow } from '$';
import { configureMock, type RemoteScenario } from './remote-mock';
import { addHomePage, seedCaptures, seedDatabase } from './seed';
import '../src/style.css';

/** Hooks for screenshot scenarios (`{ call: [name, ...args] }` steps in preview/shoot.ts). */
export interface XmPreviewHooks {
  /** Captures one more home response; returns the new page id. `repeats` = ids already seen on earlier pages. */
  addHomePage(list: 'forYou' | 'following', kind: 'newer' | 'older', count?: number, repeats?: number): number;
}
declare global {
  interface Window { __xmPreview?: XmPreviewHooks }
}

const params = new URLSearchParams(window.location.search);
const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
  const value = params.get(name);
  return allowed.includes(value as T) ? (value as T) : fallback;
};
const num = (name: string): number | undefined => {
  const value = Number(params.get(name));
  return params.get(name) !== null && Number.isFinite(value) ? value : undefined;
};

const BODY_BACKGROUNDS = { light: '#ffffff', dark: '#000000', dim: '#15202b' } as const;

function buildFakePage(bg: keyof typeof BODY_BACKGROUNDS): void {
  const body = document.body;
  body.style.cssText = `margin:0;min-height:100vh;background:${BODY_BACKGROUNDS[bg]};font-family:system-ui,sans-serif;`;
  const tint = bg === 'light' ? 'rgba(15,20,25,0.07)' : 'rgba(231,233,234,0.09)';
  const page = document.createElement('div');
  page.setAttribute('aria-hidden', 'true');
  page.style.cssText = 'max-width:600px;margin:0 auto;padding:24px 16px;display:flex;flex-direction:column;gap:14px;';
  const widths = [38, 92, 100, 71, 100, 55, 88, 100, 64, 97, 100, 42, 80, 100, 59];
  for (const width of widths) {
    const bar = document.createElement('div');
    bar.style.cssText = `height:${width % 3 === 0 ? 14 : 10}px;width:${width}%;border-radius:6px;background:${tint};`;
    page.append(bar);
  }
  body.append(page);
}

/** Vite injects component CSS into <head>; the app expects it inside the shadow root. */
function adoptDevStyles(shadow: ShadowRoot): void {
  const move = () => {
    for (const style of document.head.querySelectorAll('style[data-vite-dev-id]')) shadow.append(style);
  };
  move();
  new MutationObserver(move).observe(document.head, { childList: true });
}

function applyPush(tab: TabId, steps: string[]): void {
  for (const step of steps) {
    const [kind, arg = ''] = step.split(':');
    if (tab === 'feature' && kind === 'tweet') featureNavigateTo({ page: 'tweet', tweetId: arg });
    else if (tab === 'feature' && kind === 'user') featureNavigateTo({ page: 'user', userId: arg });
    else if (tab === 'database' && kind === 'tweet') dbNavigateTo({ page: 'tweet', tweetId: arg });
    else if (tab === 'database' && kind === 'user') dbNavigateTo({ page: 'user', userId: arg });
    else if (tab === 'tools' && kind === 'xhr-capture') toolsNavigateTo({ page: 'xhr-capture' });
    else if (tab === 'tools' && kind === 'xhr-detail') toolsNavigateTo({ page: 'xhr-detail', captureId: arg });
    else console.warn(`[preview] push step "${step}" does not apply to tab "${tab}"`);
  }
}

async function main(): Promise<void> {
  const bg = pick('bg', ['light', 'dark', 'dim'] as const, 'dark');
  buildFakePage(bg);

  await initConfig();
  const cfg = getConfig();

  const remote = pick('remote', ['off', 'ready', 'anon', 'expired', 'error'] as const, 'off') as RemoteScenario;
  configureMock({ scenario: remote, source: archiveRecords });

  updateConfig({
    uiVersion: pick('ui', ['next', 'classic'] as const, 'next') as UiVersion,
    theme: pick('theme', ['page', 'light', 'dark'] as const, 'page') as ThemeMode,
    remoteDbEnabled: remote !== 'off',
    remoteDbBaseUrl: 'https://tdb.preview.local',
    ...(num('w') !== undefined && { panelWidth: num('w') }),
    ...(num('h') !== undefined && { panelHeight: num('h') }),
    ...(num('x') !== undefined && { anchorX: num('x') }),
    ...(num('y') !== undefined && { anchorY: num('y') }),
    ...(num('scale') !== undefined && { uiScale: num('scale') }),
  });

  watch(
    () => [cfg.remoteDbEnabled, cfg.remoteDbBaseUrl] as const,
    ([runtimeEnabled, baseUrl]) => { void configureRemoteDbClient({ runtimeEnabled, baseUrl }); },
    { immediate: true },
  );

  if (params.get('empty') !== '1') seedDatabase();
  if (params.get('capture') === '1') seedCaptures();

  const host = document.createElement('div');
  host.id = 'x-downloader-root';
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  adoptDevStyles(shadow);

  const { createApp } = await import('vue');
  const { default: App } = await import('../src/App.vue');
  adoptDevStyles(shadow);

  currentUrl.value = unsafeWindow.location.href;
  syncFeatureRoute();
  const tab = pick('tab', ['feature', 'database', 'tools', 'settings'] as const, 'feature');
  setActiveTab(tab);
  const push = (params.get('push') ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  applyPush(tab, push);

  const appEl = document.createElement('div');
  shadow.append(appEl);
  createApp(App).mount(appEl);
  initTheme(shadow);

  window.__xmPreview = { addHomePage };
  (window as unknown as { __xmReady?: boolean }).__xmReady = true;
}

void main();
