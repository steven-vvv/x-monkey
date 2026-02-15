import { installXhrInterceptor, clearUserMediaStore } from './lib/fetch-interceptor';
import { initConfig, getConfig, resetLayout, updateConfig } from './lib/config-service';
import { initTheme } from './lib/theme-service';
import { currentUrl, syncFeatureRoute } from './lib/store';
import { clearDb } from './lib/db-service';
import { watch } from 'vue';
import { unsafeWindow, GM_log, GM_registerMenuCommand, GM_unregisterMenuCommand } from '$';
import './style.css';

installXhrInterceptor();

type CssBridgeWindow = Window & {
  __XD_CSS_SINK__?: (cssText: string) => void;
  __XD_CSS_QUEUE__?: string[];
};

type MenuCommandId = string | number;

const cssBridgeWindow = window as CssBridgeWindow;
let visibilityMenuId: MenuCommandId | undefined;
let visibilityMenuVersion = 0;

function getVisibilityMenuCaption(visible: boolean): string {
  return visible ? 'Hide Floating Window' : 'Show Floating Window';
}

function refreshVisibilityMenuCommand(): void {
  const cfg = getConfig();
  const currentVersion = ++visibilityMenuVersion;
  const caption = getVisibilityMenuCaption(cfg.panelVisible);

  if (visibilityMenuId !== undefined) {
    try {
      GM_unregisterMenuCommand(visibilityMenuId);
    } catch (error) {
      GM_log('[Menu] Failed to unregister visibility command', error);
    } finally {
      visibilityMenuId = undefined;
    }
  }

  const nextId = GM_registerMenuCommand(
    caption,
    () => {
      const nextVisible = !getConfig().panelVisible;
      updateConfig({ panelVisible: nextVisible });
      GM_log(`[Menu] Floating window ${nextVisible ? 'shown' : 'hidden'}`);
    },
    { id: 'xd-toggle-floating-window', autoClose: true, title: caption },
  );

  // Prevent stale command residue if rapid toggles trigger overlapping refreshes.
  if (currentVersion !== visibilityMenuVersion) {
    try {
      GM_unregisterMenuCommand(nextId);
    } catch {
      // ignore stale cleanup failures
    }
    return;
  }

  visibilityMenuId = nextId;
}

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
  const cfg = getConfig();

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

  watch(
    () => cfg.panelVisible,
    () => {
      refreshVisibilityMenuCommand();
    },
    { immediate: true },
  );

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

      // Clear UserMedia store when navigating away from media page or to a different user
      const prevMedia = /\/([^/]+)\/media/.exec(prevUrl)?.[1];
      const newMedia = /\/([^/]+)\/media/.exec(info.url)?.[1];
      if (prevMedia && prevMedia !== newMedia) {
        GM_log('[Auto Clear] Detected media page change, clearing UserMedia store');
        clearUserMediaStore();
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
