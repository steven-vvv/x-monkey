import { installXhrInterceptor, clearUserMediaStore } from './lib/fetch-interceptor';
import { initConfig, getConfig, resetLayout } from './lib/config-service';
import { initTheme } from './lib/theme-service';
import { currentUrl, syncFeatureRoute } from './lib/store';
import { clearDb } from './lib/db-service';
import cssText from './style.css?inline';
import { unsafeWindow, GM_log, GM_registerMenuCommand } from '$';

installXhrInterceptor();

async function mount() {
  await initConfig();

  const { createApp } = await import('vue');
  const { default: App } = await import('./App.vue');

  const win = unsafeWindow;
  const doc = win.document;

  const host = doc.createElement('div');
  host.id = 'x-downloader-root';
  doc.body.append(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = doc.createElement('style');
  style.textContent = cssText;
  shadow.append(style);

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
