<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  getConfig, updateConfig, clampAnchor, clampDimensions,
  DEFAULT_CONFIG, type AppConfig, type ThemeMode,
} from '../lib/config-service';
import { unsafeWindow } from '$';
import SettingsSection from '../components/SettingsSection.vue';
import SettingsNumberPairRow from '../components/SettingsNumberPairRow.vue';

const cfg = getConfig();

const draft = reactive<AppConfig>({ ...cfg });
const dirtyFields = reactive(new Set<keyof AppConfig>());

const isDirty = computed(() => dirtyFields.size > 0);

watch(
  () => ({ ...cfg }),
  (newCfg) => {
    for (const key of Object.keys(newCfg) as (keyof AppConfig)[]) {
      if (!dirtyFields.has(key)) {
        (draft as AppConfig)[key] = newCfg[key];
      }
    }
  },
);

function setDraft<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
  (draft as AppConfig)[key] = value;
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
    setDraft(key, DEFAULT_CONFIG[key]);
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
    setDraft(key, n as AppConfig[keyof AppConfig]);
  }
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

      <SettingsSection title="Behavior" hint="By default, captured data is retained for the current page session. Enable auto-clear only if URL changes should reset the in-memory capture state. Media with sensitivity labels is masked unless disabled here.">
        <label class="xd-settings-check-row">
          <input type="checkbox" :checked="draft.autoClearOnNavigate" @change="setDraft('autoClearOnNavigate', !draft.autoClearOnNavigate)" />
          <span>Auto-clear capture state on navigation</span>
        </label>
        <label class="xd-settings-check-row">
          <input type="checkbox" :checked="draft.maskSensitiveMediaWarnings" @change="setDraft('maskSensitiveMediaWarnings', !draft.maskSensitiveMediaWarnings)" />
          <span>Automatically mask media with sensitivity labels</span>
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
