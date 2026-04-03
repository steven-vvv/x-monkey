<script setup lang="ts">
import { reactive, watch, computed } from 'vue';
import {
  getConfig, updateConfig, clampAnchor, clampDimensions,
  DEFAULT_CONFIG, type AppConfig, type ThemeMode,
} from '../lib/config-service';
import { GM_openInTab, unsafeWindow } from '$';
import SettingsSection from '../components/SettingsSection.vue';
import SettingsNumberPairRow from '../components/SettingsNumberPairRow.vue';
import { REMOTE_DB_BUILD, normalizeRemoteDbBaseUrl } from '../lib/remote-db-build';
import { getRemoteDbClientState } from '../lib/remote-db-client';

const cfg = getConfig();
const remoteDbState = getRemoteDbClientState();

// --- Draft state: local copy that doesn't sync back to service until "Save" ---
const draft = reactive<AppConfig>({ ...cfg });

// Track which fields the user has edited (dirty set)
const dirtyFields = reactive(new Set<keyof AppConfig>());

const isDirty = computed(() => dirtyFields.size > 0);
const remoteDbEnabled = REMOTE_DB_BUILD.enabled;
const remoteDbConfigurable = REMOTE_DB_BUILD.enabled && REMOTE_DB_BUILD.configurable;

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
    const normalizedRemoteDbBaseUrl = normalizeRemoteDbBaseUrl(draft.remoteDbBaseUrl);
    if (normalizedRemoteDbBaseUrl) {
      nextConfig.remoteDbBaseUrl = normalizedRemoteDbBaseUrl;
    }
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

const hasInvalidRemoteDbBaseUrl = computed(() => {
  if (!remoteDbConfigurable) return false;
  if (!dirtyFields.has('remoteDbBaseUrl')) return false;
  return normalizeRemoteDbBaseUrl(draft.remoteDbBaseUrl) === null;
});

const saveDisabled = computed(() => !isDirty.value || hasInvalidRemoteDbBaseUrl.value);

const effectiveRemoteDbBaseUrl = computed(() => {
  return remoteDbState.baseUrl
    ?? cfg.remoteDbBaseUrl
    ?? REMOTE_DB_BUILD.defaultBaseUrl
    ?? '';
});

const remoteDbModeText = computed(() => {
  return remoteDbConfigurable ? 'Configurable' : 'Fixed at build time';
});

const remoteDbLifecycleText = computed(() => {
  switch (remoteDbState.lifecycle) {
    case 'disabled':
      return 'Disabled';
    case 'unconfigured':
      return 'Not configured';
    case 'initializing':
      return 'Initializing';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Initialization failed';
    default:
      return 'Unknown';
  }
});

const remoteDbSessionText = computed(() => {
  switch (remoteDbState.sessionState) {
    case 'unknown':
      return 'Unknown';
    case 'checking':
      return 'Checking';
    case 'anonymous':
      return 'Not logged in';
    case 'pending_registration':
      return 'Registration incomplete';
    case 'authenticated':
      return 'Ready';
    case 'error':
      return 'Status unavailable';
    default:
      return 'Unknown';
  }
});

const shouldShowRemoteAccountAction = computed(() => {
  return Boolean(remoteDbState.session?.accountUrl)
    && (
      remoteDbState.sessionState === 'anonymous'
      || remoteDbState.sessionState === 'pending_registration'
    );
});
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
        v-if="remoteDbEnabled"
        title="Remote Database"
        :hint="remoteDbConfigurable ? 'Save a valid absolute http(s) Base URL to initialize the remote client and check the current session.' : 'Remote database URL is fixed at build time. The script checks session state automatically when it starts.'"
      >
        <div class="xd-settings-stack">
          <div class="xd-settings-field">
            <span class="xd-settings-field-label">Mode</span>
            <span class="xd-settings-field-value">{{ remoteDbModeText }}</span>
          </div>
          <div class="xd-settings-field">
            <span class="xd-settings-field-label">Base URL</span>
            <span class="xd-settings-field-value">{{ effectiveRemoteDbBaseUrl || 'Not configured' }}</span>
          </div>
          <div class="xd-settings-field">
            <span class="xd-settings-field-label">Client</span>
            <span class="xd-settings-field-value">{{ remoteDbLifecycleText }}</span>
          </div>
          <div class="xd-settings-field">
            <span class="xd-settings-field-label">Session</span>
            <span class="xd-settings-field-value">{{ remoteDbSessionText }}</span>
          </div>
          <div v-if="remoteDbState.session?.username" class="xd-settings-field">
            <span class="xd-settings-field-label">Username</span>
            <span class="xd-settings-field-value">{{ remoteDbState.session.username }}</span>
          </div>
          <div v-if="remoteDbState.session?.expiresAt" class="xd-settings-field">
            <span class="xd-settings-field-label">Expires</span>
            <span class="xd-settings-field-value">{{ remoteDbState.session.expiresAt }}</span>
          </div>
          <div v-if="remoteDbState.lastError" class="xd-settings-error">
            {{ remoteDbState.lastError }}
          </div>
          <div v-if="remoteDbConfigurable" class="xd-settings-column">
            <input
              class="xd-settings-input"
              type="text"
              :value="draft.remoteDbBaseUrl"
              placeholder="https://example.com"
              @input="setDraft('remoteDbBaseUrl', ($event.target as HTMLInputElement).value)"
            />
            <div v-if="hasInvalidRemoteDbBaseUrl" class="xd-settings-error">
              Enter a valid absolute http(s) URL.
            </div>
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
