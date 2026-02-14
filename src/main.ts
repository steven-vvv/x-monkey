import { installXhrInterceptor } from './lib/fetch-interceptor';
import { initConfig, getConfig, resetLayout } from './lib/config-service';
import { initTheme } from './lib/theme-service';
import { currentUrl, syncFeatureRoute } from './lib/store';
import { clearDb } from './lib/db-service';
import { unsafeWindow, GM_log, GM_registerMenuCommand } from '$';
import './style.css';

installXhrInterceptor();

type CssBridgeWindow = Window & {
  __XD_CSS_SINK__?: (cssText: string) => void;
  __XD_CSS_QUEUE__?: string[];
};

const cssBridgeWindow = window as CssBridgeWindow;

function initShadowCssBridge(shadow: ShadowRoot, doc: Document): void {
  const injectedCss = new Set<string>();

  const sink = (cssText: string) => {
    if (!cssText || injectedCss.has(cssText)) return;
    injectedCss.add(cssText);

    const styleEl = doc.createElement('style');
    styleEl.setAttribute('data-xd-vite-css', '1');
    styleEl.textContent = cssText;
    shadow.append(styleEl);
  };

  cssBridgeWindow.__XD_CSS_SINK__ = sink;

  const queuedCss = cssBridgeWindow.__XD_CSS_QUEUE__ ?? [];
  for (const cssText of queuedCss) {
    sink(cssText);
  }
  cssBridgeWindow.__XD_CSS_QUEUE__ = [];
}

async function mount() {
  await initConfig();

  const win = unsafeWindow;
  const doc = win.document;

  const host = doc.createElement('div');
  host.id = 'x-downloader-root';
  doc.body.append(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  initShadowCssBridge(shadow, doc);

  const { createApp } = await import('vue');
  const { default: App } = await import('./App.vue');

  const appEl = doc.createElement('div');
  shadow.append(appEl);

  createApp(App).mount(appEl);

  initTheme(shadow);

  syncFeatureRoute();

  GM_registerMenuCommand('Reset Layout', () => {
    resetLayout();
    GM_log('[Menu] Layout reset to defaults');
  }, 'r');

  // Use sandbox window for event listening (receives events from unsafeWindow)
  if (window.onurlchange === null) {
    window.addEventListener('urlchange', (info: { url: string }) => {
      GM_log(`[URL Change] ${info.url}`);
      const prevUrl = currentUrl.value;
      currentUrl.value = info.url;
      syncFeatureRoute();

      const cfg = getConfig();
      if (cfg.autoClearOnNavigate) {
        const prevMatch = /\/status\/(\d+)/.exec(prevUrl);
        const newMatch = /\/status\/(\d+)/.exec(info.url);
        const prevId = prevMatch?.[1];
        const newId = newMatch?.[1];
        if (prevId !== newId) {
          GM_log('[Auto Clear] Detected tweet change, clearing database');
          clearDb();
        }
      }
    });
    GM_log('[URL Change Listener] Installed successfully');
  }
}

if (unsafeWindow.document.readyState === 'loading') {
  unsafeWindow.document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
