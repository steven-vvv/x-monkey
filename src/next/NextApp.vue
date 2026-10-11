<script setup lang="ts">
/**
 * Redesigned UI shell: launcher, floating panel (drag / resize / scale), tab header and the active view.
 *
 * View contract (CurrentPageView, CapturedView, ToolsView, SettingsView):
 *  - The root element is `<div class="xm-view">` (a flex column that fills the panel below the header).
 *  - A view renders everything below the header itself, in this order: optional `XmNavBar` / `.xm-toolbar`, one
 *    scrolling `.xm-body` (flex: 1), then optional banner and `.xm-footer`.
 *  - A view owns its navigation (it reads/writes its own stack in lib/store.ts) and local state; switching tabs
 *    unmounts it, the stacks survive in the store.
 *  - Views never position themselves and never touch the panel geometry.
 *  - A view may own a popover (CurrentPageView's page menu). It closes on Esc itself and stops the event, so this
 *    shell's Esc handler (collapse) only runs when nothing is open.
 */
import { computed, ref, watch } from 'vue';
import { getConfig } from '../lib/config-service';
import { capturedPosts } from './captured-posts';
import { activeTab, setActiveTab, type TabId } from '../lib/store';
import { isCapturing } from '../lib/xhr-capture-service';
import { formatCount } from './labels';
import { useFeedTabDot } from './composables/useFeedTabDot';
import { usePanelGeometry } from './composables/usePanelGeometry';
import { useShimmer } from './composables/useShimmer';
import XmIcon from './components/XmIcon.vue';
import type { IconName } from './icons';
import CapturedView from './views/CapturedView.vue';
import CurrentPageView from './views/CurrentPageView.vue';
import SettingsView from './views/SettingsView.vue';
import ToolsView from './views/ToolsView.vue';
import './next.css';

const cfg = getConfig();
const geometry = usePanelGeometry();
const expanded = ref(false);

const tabs: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'feature', label: '当前页', icon: 'page' },
  { id: 'database', label: '已捕获', icon: 'captured' },
  { id: 'tools', label: '工具', icon: 'tools' },
  { id: 'settings', label: '设置', icon: 'settings' },
];

/** Same count as the 已捕获 tab list. */
const postCount = computed(() => capturedPosts.value.length);

/** 当前页 tab dot: the home timeline of the feature route got a new page while another tab was active. */
const featureDot = useFeedTabDot(expanded);

/** Collapsed launcher: one shimmer sweep when posts are captured (at most one per 2s). */
const launcherShimmer = useShimmer(2000);
watch(postCount, (count, previous) => {
  if (!expanded.value && count > previous) launcherShimmer.trigger();
});

function expand(): void {
  expanded.value = true;
}

function collapse(): void {
  expanded.value = false;
}

/** Esc: first leave a focused text field, otherwise collapse the panel. */
function onPanelKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  const target = event.target as HTMLElement | null;
  if (target && target.matches('input, textarea, select')) {
    target.blur();
    return;
  }
  collapse();
}
</script>

<template>
  <div class="xm-root">
    <div
      v-if="cfg.panelVisible && !expanded"
      class="xm-launcher"
      role="button"
      tabindex="0"
      title="打开 x-monkey"
      aria-label="打开 x-monkey"
      :style="geometry.launcherStyle.value"
      @pointerdown="geometry.onLauncherPointerDown($event, expand)"
      @keydown.enter.prevent="expand"
      @keydown.space.prevent="expand"
    >
      <XmIcon name="captured" />
      <span class="xm-launcher__sheen" :class="{ 'xm-shimmer': launcherShimmer.active.value }" aria-hidden="true"></span>
      <span v-if="isCapturing" class="xm-launcher__rec" title="正在录制 XHR 请求"></span>
    </div>

    <div
      v-else-if="cfg.panelVisible"
      class="xm-panel"
      tabindex="-1"
      :style="geometry.panelStyle.value"
      @keydown="onPanelKeydown"
    >
      <div class="xm-panel__inner" :style="geometry.contentScaleStyle.value">
        <div class="xm-header" @pointerdown="geometry.onHeaderPointerDown">
          <div class="xm-tabs" role="tablist">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              type="button"
              class="xm-tab"
              role="tab"
              :data-tab="tab.id"
              :aria-selected="activeTab === tab.id"
              :title="tab.label"
              @click="setActiveTab(tab.id)"
            >
              <XmIcon :name="tab.icon" />
              <span class="xm-tab__label">{{ tab.label }}</span>
              <span v-if="tab.id === 'database' && postCount > 0" class="xm-tab__badge xm-num">{{ formatCount(postCount) }}</span>
              <span v-if="tab.id === 'feature' && featureDot" class="xm-tab__dot" title="有新页面" data-role="feature-dot"></span>
            </button>
          </div>
          <button type="button" class="xm-iconbtn" title="收起 (Esc)" aria-label="收起 (Esc)" data-action="collapse" @click="collapse">
            <XmIcon name="minus" />
          </button>
        </div>

        <CurrentPageView v-if="activeTab === 'feature'" />
        <CapturedView v-else-if="activeTab === 'database'" />
        <ToolsView v-else-if="activeTab === 'tools'" />
        <SettingsView v-else-if="activeTab === 'settings'" />
      </div>
      <div class="xm-resize" title="调整大小" @pointerdown="geometry.onResizePointerDown"></div>
    </div>
  </div>
</template>
