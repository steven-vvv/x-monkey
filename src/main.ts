import { installXhrInterceptor } from './lib/fetch-interceptor';
import { initConfig, getConfig, resetLayout, updateConfig } from './lib/config-service';
import { initTheme } from './lib/theme-service';
import { currentUrl, syncFeatureRoute } from './lib/store';
import { clearCaptureState } from './lib/capture-state-service';
import { REMOTE_DB_BUILD, configureRemoteDbClient } from './lib/remote-db';
import { watch } from 'vue';
import { unsafeWindow, GM_log, GM_registerMenuCommand, GM_unregisterMenuCommand } from '$';
import './style.css';

installXhrInterceptor();

/**
 * Poll `location.href` as a fallback for `urlchange`. Off by default: Tampermonkey's `window.onurlchange` works on fresh
 * loads (2026-10-21: /, /home and /i/bookmarks entries all reported `(urlchange)`), but in one long session it never
 * fired and the panel stayed on "此页面没有可采集的列表" until the page was reloaded. The cause was not found and has
 * not been reproduced. If it comes back (no `[URL Change]` line after a navigation and the panel is stale), set this
 * to true: the poll catches every navigation within 500ms and logs it as `(poll)`.
 */
const URL_POLL_FALLBACK = false;

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

let uiVersionMenuId: MenuCommandId | undefined;
let uiVersionMenuVersion = 0;

function refreshUiVersionMenuCommand(): void {
  const uiVersion = getConfig().uiVersion;
  const currentVersion = ++uiVersionMenuVersion;
  const caption = uiVersion === 'next' ? 'Use Classic UI' : 'Use New UI';

  if (uiVersionMenuId !== undefined) {
    try {
      GM_unregisterMenuCommand(uiVersionMenuId);
    } catch (error) {
      GM_log('[Menu] Failed to unregister UI version command', error);
    } finally {
      uiVersionMenuId = undefined;
    }
  }

  const nextId = GM_registerMenuCommand(
    caption,
    () => {
      const nextUi = getConfig().uiVersion === 'next' ? 'classic' : 'next';
      updateConfig({ uiVersion: nextUi });
      GM_log(`[Menu] UI version set to ${nextUi}`);
    },
    { id: 'xd-toggle-ui-version', autoClose: true, title: caption },
  );

  // Prevent stale command residue if rapid toggles trigger overlapping refreshes.
  if (currentVersion !== uiVersionMenuVersion) {
    try {
      GM_unregisterMenuCommand(nextId);
    } catch {
      // ignore stale cleanup failures
    }
    return;
  }

  uiVersionMenuId = nextId;
}

let autoArchiveMenuId: MenuCommandId | undefined;
let autoArchiveMenuVersion = 0;

/** Only the new UI runs the auto-archive engine, so the command is hidden under the classic UI. */
function refreshAutoArchiveMenuCommand(): void {
  const enabled = getConfig().autoArchive;
  const currentVersion = ++autoArchiveMenuVersion;
  const caption = enabled ? 'Stop Auto Archive' : 'Start Auto Archive';

  if (autoArchiveMenuId !== undefined) {
    try {
      GM_unregisterMenuCommand(autoArchiveMenuId);
    } catch (error) {
      GM_log('[Menu] Failed to unregister auto archive command', error);
    } finally {
      autoArchiveMenuId = undefined;
    }
  }
  if (getConfig().uiVersion !== 'next') return;

  const nextId = GM_registerMenuCommand(
    caption,
    () => {
      const next = !getConfig().autoArchive;
      updateConfig({ autoArchive: next });
      GM_log(`[Menu] Auto archive ${next ? 'started' : 'stopped'}`);
    },
    { id: 'xd-toggle-auto-archive', autoClose: true, title: caption },
  );

  // Prevent stale command residue if rapid toggles trigger overlapping refreshes.
  if (currentVersion !== autoArchiveMenuVersion) {
    try {
      GM_unregisterMenuCommand(nextId);
    } catch {
      // ignore stale cleanup failures
    }
    return;
  }

  autoArchiveMenuId = nextId;
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

  watch(
    () => [cfg.remoteDbEnabled, cfg.remoteDbBaseUrl] as const,
    ([runtimeEnabled, baseUrl]) => {
      void configureRemoteDbClient({ runtimeEnabled, baseUrl });
    },
    { immediate: true },
  );

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

  watch(
    () => cfg.uiVersion,
    () => {
      refreshUiVersionMenuCommand();
    },
    { immediate: true },
  );

  if (REMOTE_DB_BUILD.enabled) {
    watch(
      () => [cfg.autoArchive, cfg.uiVersion],
      () => {
        refreshAutoArchiveMenuCommand();
      },
      { immediate: true },
    );
  }

  GM_registerMenuCommand('Reset Layout', () => {
    resetLayout();
    GM_log('[Menu] Layout reset to defaults');
  }, 'r');

  // `source` tells the signals apart: a hit from 'poll' or 'popstate' that `urlchange` did not report first means the
  // userscript manager missed a navigation.
  const handleUrlChange = (url: string, source: 'urlchange' | 'popstate' | 'poll' | 'mount', clearCapture = true): void => {
    if (url === currentUrl.value) return;
    GM_log(`[URL Change] (${source}) ${url}`);
    currentUrl.value = url;
    syncFeatureRoute();

    if (clearCapture && cfg.autoClearOnNavigate) {
      GM_log('[Auto Clear] URL changed, clearing capture state');
      clearCaptureState();
    }
  };

  // The store captured the URL at document-start, which can be https://x.com/ before X redirects to /home; catch up
  // without clearing what was already captured. Not every userscript manager fires `urlchange` for SPA navigation,
  // so also follow popstate, and poll the location when URL_POLL_FALLBACK is on.
  handleUrlChange(unsafeWindow.location.href, 'mount', false);

  // Use sandbox window for event listening (receives events from unsafeWindow)
  if (window.onurlchange === null) {
    window.addEventListener('urlchange', (info: { url: string }) => handleUrlChange(info.url, 'urlchange'));
    GM_log('[URL Change Listener] Installed successfully');
  }
  unsafeWindow.addEventListener('popstate', () => handleUrlChange(unsafeWindow.location.href, 'popstate'));
  if (URL_POLL_FALLBACK) setInterval(() => handleUrlChange(unsafeWindow.location.href, 'poll'), 500);
}

if (unsafeWindow.document.readyState === 'loading') {
  unsafeWindow.document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
