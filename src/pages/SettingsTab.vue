<script setup lang="ts">
import { reactive, watch, computed } from 'vue';
import {
  getConfig, updateConfig, clampAnchor, clampDimensions,
  DEFAULT_CONFIG, type AppConfig, type ThemeMode,
} from '../lib/config-service';
import { useShadowStyle } from '../lib/use-shadow-style';
import { unsafeWindow } from '$';
import SettingsSection from '../components/SettingsSection.vue';
import SettingsNumberPairRow from '../components/SettingsNumberPairRow.vue';

const cfg = getConfig();

// --- Draft state: local copy that doesn't sync back to service until "Save" ---
const draft = reactive<AppConfig>({ ...cfg });

// Track which fields the user has edited (dirty set)
const dirtyFields = reactive(new Set<keyof AppConfig>());

const isDirty = computed(() => dirtyFields.size > 0);

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
  updateConfig({ ...draft });
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

const STYLE_TEXT = `
.xd-settings-row {
  display: flex;
  align-items: center;
  gap: 6px;
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

.xd-settings-select {
  padding: 3px 6px;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-tertiary);
  color: var(--xd-text-primary);
  font-size: 11px;
  font-family: var(--xd-font);
  outline: none;
  cursor: pointer;
}

.xd-settings-select:focus {
  border-color: var(--xd-accent);
}

`;

useShadowStyle('settings-tab', STYLE_TEXT);
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

      <SettingsSection title="Behavior" hint="X is a SPA. Enable this to avoid memory bloat when navigating between tweets.">
        <label class="xd-settings-check-row">
          <input type="checkbox" :checked="draft.autoClearOnNavigate" @change="setDraft('autoClearOnNavigate', !draft.autoClearOnNavigate)" />
          <span>Auto-clear database on navigation</span>
        </label>
      </SettingsSection>
    </div>

    <div class="xd-tab-actions">
      <div class="xd-tab-actions-left">
        <button class="xd-btn xd-btn--sm" @click="resetLayout">Reset Layout</button>
        <button class="xd-btn xd-btn--sm xd-btn--error" @click="resetAllSettings">Reset Settings</button>
      </div>
      <div class="xd-tab-actions-right">
        <button class="xd-btn xd-btn--sm xd-btn--accent" :disabled="!isDirty" @click="save">Save</button>
        <button class="xd-btn xd-btn--sm" :disabled="!isDirty" @click="revert">Revert</button>
      </div>
    </div>
  </div>
</template>
