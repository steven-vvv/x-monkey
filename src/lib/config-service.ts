import { reactive, watch } from 'vue';
import { GM_getValue, GM_setValue, GM_addValueChangeListener, GM_removeValueChangeListener } from '$';
import type { GmValueListenerId } from '$';

export type ThemeMode = 'dark' | 'light' | 'page';

export interface AppConfig {
  anchorX: number;
  anchorY: number;
  panelWidth: number;
  panelHeight: number;
  uiScale: number; // 25-200%
  autoClearOnNavigate: boolean;
  theme: ThemeMode;
}

export const DEFAULT_CONFIG: AppConfig = {
  anchorX: 60,
  anchorY: 60,
  panelWidth: 360,
  panelHeight: 420,
  uiScale: 100,
  autoClearOnNavigate: true,
  theme: 'page',
};

const CONFIG_KEY = 'xd_config';

const config = reactive<AppConfig>({ ...DEFAULT_CONFIG });

let initialized = false;
let listenerId: GmValueListenerId | undefined;

export async function initConfig(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const saved = await GM_getValue<Partial<AppConfig>>(CONFIG_KEY, {});
  Object.assign(config, DEFAULT_CONFIG, saved);

  watch(
    () => ({ ...config }),
    (val) => {
      GM_setValue(CONFIG_KEY, val);
    },
    { deep: true },
  );

  listenerId = GM_addValueChangeListener(
    CONFIG_KEY,
    (_name: string, _oldVal: unknown, newVal: unknown, remote?: boolean) => {
      if (!remote) return;
      if (newVal && typeof newVal === 'object') {
        Object.assign(config, DEFAULT_CONFIG, newVal);
      }
    },
  );
}

export function disposeConfig(): void {
  if (listenerId !== undefined) {
    GM_removeValueChangeListener(listenerId);
    listenerId = undefined;
  }
}

export function getConfig(): AppConfig {
  return config;
}

export function updateConfig(partial: Partial<AppConfig>): void {
  Object.assign(config, partial);
}

export function clampAnchor(vw: number, vh: number): void {
  config.anchorX = Math.max(0, Math.min(vw, config.anchorX));
  config.anchorY = Math.max(0, Math.min(vh, config.anchorY));
}

export function clampDimensions(): void {
  config.panelWidth = Math.max(280, Math.round(config.panelWidth));
  config.panelHeight = Math.max(200, Math.round(config.panelHeight));
}

export function resetLayout(): void {
  updateConfig({
    anchorX: DEFAULT_CONFIG.anchorX,
    anchorY: DEFAULT_CONFIG.anchorY,
    panelWidth: DEFAULT_CONFIG.panelWidth,
    panelHeight: DEFAULT_CONFIG.panelHeight,
    uiScale: DEFAULT_CONFIG.uiScale,
  });
}
