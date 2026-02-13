import { watch } from 'vue';
import { unsafeWindow } from '$';
import { getConfig, type ThemeMode } from './config-service';

let hostEl: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function getPageLuminance(): number {
  const bg = unsafeWindow.getComputedStyle(unsafeWindow.document.body).backgroundColor;
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg);
  if (!match) return 0; // default dark
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  // Relative luminance (perceived brightness)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  // mode === 'page'
  return getPageLuminance() > 0.5 ? 'light' : 'dark';
}

function applyTheme(resolved: 'dark' | 'light') {
  if (!hostEl) return;
  if (resolved === 'light') {
    hostEl.classList.add('xd-theme-light');
  } else {
    hostEl.classList.remove('xd-theme-light');
  }
}

function refresh() {
  const cfg = getConfig();
  applyTheme(resolveTheme(cfg.theme));
}

export function initTheme(shadow: ShadowRoot) {
  hostEl = shadow.host as HTMLElement;

  const cfg = getConfig();

  // React to config.theme changes
  watch(() => cfg.theme, () => refresh(), { immediate: true });

  // When theme is 'page', observe body style changes to detect page theme switches
  watch(() => cfg.theme, (mode) => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (mode === 'page') {
      observer = new MutationObserver(() => refresh());
      observer.observe(unsafeWindow.document.body, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
      // Also observe <html> since some sites set bg there
      observer.observe(unsafeWindow.document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }
  }, { immediate: true });
}
