import { computed, reactive, watch } from 'vue';
import { unsafeWindow } from '$';
import {
  getConfig, updateConfig, clampAnchor, clampDimensions,
  DEFAULT_CONFIG, type AppConfig,
} from '../../lib/config-service';
import {
  REMOTE_DB_BUILD,
  configureRemoteDbClient,
  normalizeRemoteDbBaseUrl,
} from '../../lib/remote-db';

/** Fields applied the moment they change; never part of the draft. */
const IMMEDIATE_KEYS: (keyof AppConfig)[] = ['uiVersion', 'homeFeedView', 'autoArchive', 'autoArchiveSkipForYou'];

/**
 * Settings draft with the same semantics as the classic SettingsTab: edits go to `draft` and `dirtyFields`;
 * save / revert / resetLayout / resetAll only touch the draft until saved. `uiVersion`, `homeFeedView` and the auto-archive switches are never part of the
 * draft (they are applied immediately), so save() never writes them.
 */
export function useSettingsDraft() {
  const cfg = getConfig();
  const draft = reactive<AppConfig>({ ...cfg });
  const dirtyFields = reactive(new Set<keyof AppConfig>());

  const isDirty = computed(() => dirtyFields.size > 0);
  const dirtyCount = computed(() => dirtyFields.size);
  const remoteDbFeatureEnabled = REMOTE_DB_BUILD.enabled;
  const remoteDbConfigurable = remoteDbFeatureEnabled && REMOTE_DB_BUILD.configurable;

  // Keep non-dirty fields in sync with the live config (panel drag / resize, other tabs).
  watch(
    () => ({ ...cfg }),
    (newCfg) => {
      for (const key of Object.keys(newCfg) as (keyof AppConfig)[]) {
        if (!dirtyFields.has(key)) (draft as AppConfig)[key] = newCfg[key] as never;
      }
    },
  );

  function setDraft<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    draft[key] = value;
    if (value !== cfg[key]) dirtyFields.add(key);
    else dirtyFields.delete(key);
  }

  const isFieldDirty = (...keys: (keyof AppConfig)[]) => keys.some((key) => dirtyFields.has(key));

  const normalizedBaseUrl = computed(() => normalizeRemoteDbBaseUrl(draft.remoteDbBaseUrl));
  const hasInvalidBaseUrl = computed(() => {
    if (!remoteDbConfigurable) return false;
    if (!draft.remoteDbBaseUrl.trim()) return false;
    return normalizedBaseUrl.value === null;
  });
  const saveDisabled = computed(() => !isDirty.value || hasInvalidBaseUrl.value);

  function syncDraftFromConfig() {
    Object.assign(draft, cfg);
    dirtyFields.clear();
  }

  function save() {
    if (hasInvalidBaseUrl.value) return;
    const { uiVersion: _ui, homeFeedView: _feed, autoArchive: _aa, autoArchiveSkipForYou: _aas, ...rest } = draft;
    void [_ui, _feed, _aa, _aas];
    const next: Partial<AppConfig> = { ...rest };
    if (remoteDbConfigurable) next.remoteDbBaseUrl = normalizedBaseUrl.value ?? '';
    updateConfig(next);
    clampAnchor(unsafeWindow.innerWidth, unsafeWindow.innerHeight);
    clampDimensions();
    syncDraftFromConfig();
  }

  function revert() {
    syncDraftFromConfig();
    void configureRemoteDbClient({ runtimeEnabled: cfg.remoteDbEnabled, baseUrl: cfg.remoteDbBaseUrl });
  }

  function resetLayout() {
    setDraft('anchorX', DEFAULT_CONFIG.anchorX);
    setDraft('anchorY', DEFAULT_CONFIG.anchorY);
    setDraft('panelWidth', DEFAULT_CONFIG.panelWidth);
    setDraft('panelHeight', DEFAULT_CONFIG.panelHeight);
    setDraft('uiScale', DEFAULT_CONFIG.uiScale);
  }

  function resetAll() {
    for (const key of Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]) {
      if (IMMEDIATE_KEYS.includes(key)) continue;
      setDraft(key, DEFAULT_CONFIG[key]);
    }
  }

  /** Commit-on-change for number inputs: parseInt, ignore NaN. */
  function setNumber(key: keyof AppConfig, e: Event) {
    const n = parseInt((e.target as HTMLInputElement | HTMLSelectElement).value, 10);
    if (!Number.isNaN(n)) setDraft(key, n as AppConfig[keyof AppConfig]);
  }

  return {
    cfg, draft, isDirty, dirtyCount, isFieldDirty, setDraft, setNumber,
    remoteDbFeatureEnabled, remoteDbConfigurable, hasInvalidBaseUrl, saveDisabled,
    save, revert, resetLayout, resetAll,
  };
}
