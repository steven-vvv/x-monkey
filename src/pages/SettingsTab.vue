<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  getConfig, updateConfig, clampAnchor, clampDimensions,
  DEFAULT_CONFIG, type AppConfig, type ThemeMode,
} from '../lib/config-service';
import { GM_openInTab, unsafeWindow } from '$';
import SettingsSection from '../components/SettingsSection.vue';
import SettingsNumberPairRow from '../components/SettingsNumberPairRow.vue';
import {
  REMOTE_DB_BUILD,
  configureRemoteDbClient,
  getRemoteDbClientState,
  normalizeRemoteDbBaseUrl,
} from '../lib/remote-db';

const cfg = getConfig();
const remoteDbState = getRemoteDbClientState();

// --- Draft state: local copy that doesn't sync back to service until "Save" ---
const draft = reactive<AppConfig>({ ...cfg });

// Track which fields the user has edited (dirty set)
const dirtyFields = reactive(new Set<keyof AppConfig>());

const isDirty = computed(() => dirtyFields.size > 0);
const remoteDbFeatureEnabled = REMOTE_DB_BUILD.enabled;
const remoteDbConfigurable = remoteDbFeatureEnabled && REMOTE_DB_BUILD.configurable;

// Service → VM sync: when service config changes (e.g. drag, resize, remote),
// merge into draft for fields that are NOT currently dirty.
watch(
  () => ({ ...cfg }),
  (newCfg) => {
    for (const key of Object.keys(newCfg) as (keyof AppConfig)[]) {
      if (!dirtyFields.has(key)) {
        (draft as any)[key] = newCfg[key];
      }
    }
  },
);

function setDraft<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
  (draft as any)[key] = value;
  if (value !== cfg[key]) {
    dirtyFields.add(key);
  } else {
    dirtyFields.delete(key);
  }
}

function save() {
  if (hasInvalidRemoteDbBaseUrl.value) {
    return;
  }

  const nextConfig: AppConfig = { ...draft };
  if (remoteDbConfigurable) {
    nextConfig.remoteDbBaseUrl = normalizedDraftRemoteDbBaseUrl.value ?? '';
  }

  updateConfig(nextConfig);
  clampAnchor(unsafeWindow.innerWidth, unsafeWindow.innerHeight);
  clampDimensions();
  // After clamp, re-sync draft from service (clamped values may differ)
  Object.assign(draft, cfg);
  dirtyFields.clear();
}

function revert() {
  Object.assign(draft, cfg);
  dirtyFields.clear();
  void configureRemoteDbClient({
    runtimeEnabled: cfg.remoteDbEnabled,
    baseUrl: cfg.remoteDbBaseUrl,
  });
}

function resetLayout() {
  setDraft('anchorX', DEFAULT_CONFIG.anchorX);
  setDraft('anchorY', DEFAULT_CONFIG.anchorY);
  setDraft('panelWidth', DEFAULT_CONFIG.panelWidth);
  setDraft('panelHeight', DEFAULT_CONFIG.panelHeight);
  setDraft('uiScale', DEFAULT_CONFIG.uiScale);
}

function resetAllSettings() {
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]) {
    setDraft(key, DEFAULT_CONFIG[key] as any);
  }
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'page', label: 'Follow Page' },
];

function onNumberInput(key: keyof AppConfig, e: Event) {
  const n = parseInt((e.target as HTMLInputElement).value, 10);
  if (!Number.isNaN(n)) {
    setDraft(key, n as any);
  }
}

function openRemoteAccountPage() {
  const accountUrl = remoteDbState.session?.accountUrl;
  if (accountUrl) {
    GM_openInTab(accountUrl, { active: true });
  }
}

const normalizedDraftRemoteDbBaseUrl = computed(() => {
  return normalizeRemoteDbBaseUrl(draft.remoteDbBaseUrl);
});

const hasInvalidRemoteDbBaseUrl = computed(() => {
  if (!remoteDbConfigurable) return false;
  if (!draft.remoteDbBaseUrl.trim()) return false;
  return normalizedDraftRemoteDbBaseUrl.value === null;
});

const saveDisabled = computed(() => !isDirty.value || hasInvalidRemoteDbBaseUrl.value);
const checkPending = computed(() => {
  return remoteDbState.lifecycle === 'initializing'
    || remoteDbState.sessionState === 'checking';
});
const checkDisabled = computed(() => {
  return checkPending.value
    || (draft.remoteDbEnabled && hasInvalidRemoteDbBaseUrl.value);
});
const checkButtonText = computed(() => {
  return checkPending.value ? 'Checking...' : 'Check';
});

const remoteDbStatusText = computed(() => {
  if (!remoteDbState.enabled || !remoteDbState.runtimeEnabled || remoteDbState.lifecycle === 'paused') {
    return 'Disabled';
  }

  if (remoteDbState.lifecycle === 'unconfigured') {
    return 'Not configured';
  }

  if (
    remoteDbState.lifecycle === 'initializing'
    || remoteDbState.sessionState === 'checking'
  ) {
    return 'Checking...';
  }

  if (remoteDbState.lifecycle === 'ready' && remoteDbState.sessionState === 'authenticated') {
    const username = remoteDbState.session?.username?.trim();
    return username ? `Logged in as ${username}` : 'Connected';
  }

  if (remoteDbState.sessionState === 'anonymous') {
    return 'Sign in required';
  }

  if (remoteDbState.sessionState === 'pending_registration') {
    return 'Complete account setup';
  }

  if (remoteDbState.lifecycle === 'error' || remoteDbState.sessionState === 'error') {
    return remoteDbState.lastError?.trim() || 'Connection failed';
  }

  return 'Not configured';
});

const remoteDbHint = computed(() => {
  if (remoteDbConfigurable) {
    return 'Check applies the current draft in memory. Save persists the enable switch and Base URL.';
  }

  return 'Check re-runs availability detection. Save persists the enable switch.';
});

const shouldShowRemoteAccountAction = computed(() => {
  return Boolean(remoteDbState.session?.accountUrl)
    && (
      remoteDbState.sessionState === 'anonymous'
      || remoteDbState.sessionState === 'pending_registration'
    );
});

async function checkRemoteDbConnection(): Promise<void> {
  if (draft.remoteDbEnabled && hasInvalidRemoteDbBaseUrl.value) {
    return;
  }

  await configureRemoteDbClient({
    runtimeEnabled: draft.remoteDbEnabled,
    baseUrl: draft.remoteDbBaseUrl,
  });
}
</script>

<template>
  <div class="xd-tab-wrapper">
    <div class="xd-body">
      <SettingsSection title="Anchor Position">
        <SettingsNumberPairRow
          left-label="X"
          right-label="Y"
          :left-value="draft.anchorX"
          :right-value="draft.anchorY"
          @update:left="(value) => setDraft('anchorX', value)"
          @update:right="(value) => setDraft('anchorY', value)"
        />
      </SettingsSection>

      <SettingsSection title="Panel Size">
        <SettingsNumberPairRow
          left-label="W"
          right-label="H"
          :left-value="draft.panelWidth"
          :right-value="draft.panelHeight"
          @update:left="(value) => setDraft('panelWidth', value)"
          @update:right="(value) => setDraft('panelHeight', value)"
        />
      </SettingsSection>

      <SettingsSection title="UI Scale" hint="Scale the UI content only (not the window itself). Save to apply.">
        <div class="xd-settings-row">
          <select class="xd-settings-select" :value="draft.uiScale" @change="onNumberInput('uiScale', $event)">
            <option v-for="opt in [25, 50, 75, 100, 125, 150, 175, 200]" :key="opt" :value="opt">{{ opt }}%</option>
          </select>
        </div>
      </SettingsSection>

      <SettingsSection title="Theme" hint="Follow Page detects the page background color to match its theme.">
        <div class="xd-settings-row">
          <select class="xd-settings-select" :value="draft.theme" @change="setDraft('theme', ($event.target as HTMLSelectElement).value as ThemeMode)">
            <option v-for="opt in themeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </SettingsSection>

      <SettingsSection title="Behavior" hint="By default, captured data is retained for the current page session. Enable auto-clear only if URL changes should reset the in-memory capture state.">
        <label class="xd-settings-check-row">
          <input type="checkbox" :checked="draft.autoClearOnNavigate" @change="setDraft('autoClearOnNavigate', !draft.autoClearOnNavigate)" />
          <span>Auto-clear capture state on navigation</span>
        </label>
      </SettingsSection>

      <SettingsSection
        v-if="remoteDbFeatureEnabled"
        title="Remote Database"
        :hint="remoteDbHint"
      >
        <div class="xd-settings-stack">
          <label class="xd-settings-check-row">
            <input type="checkbox" :checked="draft.remoteDbEnabled" @change="setDraft('remoteDbEnabled', !draft.remoteDbEnabled)" />
            <span>Enable remote database</span>
          </label>

          <div class="xd-settings-field">
            <span class="xd-settings-field-label">Status</span>
            <span class="xd-settings-field-value">{{ remoteDbStatusText }}</span>
          </div>

          <div v-if="remoteDbConfigurable" class="xd-settings-column">
            <div class="xd-settings-input-row">
              <input
                class="xd-settings-input"
                type="text"
                :value="draft.remoteDbBaseUrl"
                placeholder="https://example.com"
                @input="setDraft('remoteDbBaseUrl', ($event.target as HTMLInputElement).value)"
              />
              <button class="xd-btn xd-btn--sm" :disabled="checkDisabled" @click="checkRemoteDbConnection">{{ checkButtonText }}</button>
            </div>
            <div v-if="hasInvalidRemoteDbBaseUrl" class="xd-settings-error">
              Enter a valid absolute http(s) URL.
            </div>
          </div>
          <div v-else class="xd-settings-row">
            <button class="xd-btn xd-btn--sm" :disabled="checkDisabled" @click="checkRemoteDbConnection">{{ checkButtonText }}</button>
          </div>
          <div v-if="shouldShowRemoteAccountAction" class="xd-settings-row">
            <button class="xd-btn xd-btn--sm xd-btn--accent" @click="openRemoteAccountPage">Open Account</button>
          </div>
        </div>
      </SettingsSection>
    </div>

    <div class="xd-tab-actions">
      <div class="xd-tab-actions-left">
        <button class="xd-btn xd-btn--sm" @click="resetLayout">Reset Layout</button>
        <button class="xd-btn xd-btn--sm xd-btn--error" @click="resetAllSettings">Reset Settings</button>
      </div>
      <div class="xd-tab-actions-right">
        <button class="xd-btn xd-btn--sm xd-btn--accent" :disabled="saveDisabled" @click="save">Save</button>
        <button class="xd-btn xd-btn--sm" :disabled="!isDirty" @click="revert">Revert</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xd-settings-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.xd-settings-field {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.xd-settings-field-label {
  color: var(--xd-text-muted);
  flex-shrink: 0;
}

.xd-settings-field-value {
  color: var(--xd-text-primary);
  text-align: right;
  word-break: break-word;
}

.xd-settings-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.xd-settings-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.xd-settings-input-row .xd-settings-input {
  flex: 1;
  min-width: 0;
}

.xd-settings-check-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--xd-text-primary);
  cursor: pointer;
}

.xd-settings-check-row input[type="checkbox"] {
  accent-color: var(--xd-accent);
}

.xd-settings-input,
.xd-settings-select {
  padding: 3px 6px;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-tertiary);
  color: var(--xd-text-primary);
  font-size: 11px;
  font-family: var(--xd-font);
  outline: none;
}

.xd-settings-input {
  width: 100%;
}

.xd-settings-select {
  cursor: pointer;
}

.xd-settings-input:focus,
.xd-settings-select:focus {
  border-color: var(--xd-accent);
}

.xd-settings-error {
  font-size: 10px;
  color: var(--xd-error);
  line-height: 1.3;
}
</style>
