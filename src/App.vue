<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import FeatureTab from './pages/FeatureTab.vue';
import DatabaseTab from './pages/DatabaseTab.vue';
import SettingsTab from './pages/SettingsTab.vue';
import ToolsTab from './pages/ToolsTab.vue';
import {
  activeTab, setActiveTab, currentBreadcrumbs, navigateBreadcrumb,
  type TabId,
} from './lib/store';
import { getConfig, clampAnchor, updateConfig, pausePersistence, resumePersistence } from './lib/config-service';
import { getTweetCount } from './lib/db-service';
import { onCapture } from './lib/fetch-interceptor';
import { unsafeWindow } from '$';

const BUBBLE_R = 18;
const MIN_W = 280;
const MIN_H = 200;

const expanded = ref(false);
const captureNotify = ref(0);
onCapture(() => { captureNotify.value++; });

const cfg = getConfig();

const tabs: { id: TabId; label: string }[] = [
  { id: 'feature', label: 'Feature' },
  { id: 'database', label: 'Database' },
  { id: 'tools', label: 'Tools' },
  { id: 'settings', label: 'Settings' },
];

function doClamp() {
  clampAnchor(unsafeWindow.innerWidth, unsafeWindow.innerHeight);
}

function onWindowResize() {
  doClamp();
}

onMounted(() => {
  unsafeWindow.addEventListener('resize', onWindowResize);
});

onUnmounted(() => {
  unsafeWindow.removeEventListener('resize', onWindowResize);
});

const bubbleStyle = computed(() => ({
  position: 'fixed' as const,
  left: cfg.anchorX - BUBBLE_R + 'px',
  top: cfg.anchorY - BUBBLE_R + 'px',
  zIndex: 2147483647,
}));

const panelStyle = computed(() => ({
  position: 'fixed' as const,
  left: cfg.anchorX + 'px',
  top: cfg.anchorY + 'px',
  width: cfg.panelWidth + 'px',
  height: cfg.panelHeight + 'px',
  zIndex: 2147483647,
}));

const contentScaleStyle = computed(() => {
  const scale = cfg.uiScale / 100;
  return {
    position: 'absolute' as const,
    left: '0',
    top: '0',
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    width: `${100 / scale}%`,
    height: `${100 / scale}%`,
  };
});

const tweetCount = computed(() => { void captureNotify.value; return getTweetCount(); });

let dragStartX = 0;
let dragStartY = 0;
let dragAnchorStartX = 0;
let dragAnchorStartY = 0;

function startDrag(e: PointerEvent) {
  e.preventDefault();
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragAnchorStartX = cfg.anchorX;
  dragAnchorStartY = cfg.anchorY;
  pausePersistence();
  const onMove = (ev: PointerEvent) => {
    updateConfig({
      anchorX: dragAnchorStartX + ev.clientX - dragStartX,
      anchorY: dragAnchorStartY + ev.clientY - dragStartY,
    });
    doClamp();
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    resumePersistence();
  };
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
}

let clickStartX = 0;
let clickStartY = 0;

function onBubbleDown(e: PointerEvent) {
  clickStartX = e.clientX;
  clickStartY = e.clientY;
  startDrag(e);
}

function onBubbleUp(e: PointerEvent) {
  if (Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) < 4) {
    expanded.value = !expanded.value;
  }
}

function onResizePointerDown(e: PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = cfg.panelWidth;
  const startH = cfg.panelHeight;
  pausePersistence();
  const onMove = (ev: PointerEvent) => {
    updateConfig({
      panelWidth: Math.max(MIN_W, startW + ev.clientX - startX),
      panelHeight: Math.max(MIN_H, startH + ev.clientY - startY),
    });
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    resumePersistence();
  };
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', onUp, true);
}
</script>

<template>
  <div
    v-if="!expanded"
    class="xd-bubble"
    :style="bubbleStyle"
    @pointerdown="onBubbleDown"
    @pointerup="onBubbleUp"
  >
    <span v-if="tweetCount > 0" class="xd-badge xd-bubble-badge">{{ tweetCount }}</span>
    XD
  </div>
  <div
    v-else
    class="xd-panel"
    :style="panelStyle"
  >
    <div class="xd-panel-scale-viewport">
      <div class="xd-panel-scale-inner" :style="contentScaleStyle">
        <!-- Row 1: AppBar with tabs + collapse -->
        <div class="xd-appbar" @pointerdown="startDrag">
          <div class="xd-appbar-tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="xd-tab"
              :class="{ 'xd-tab--active': activeTab === tab.id }"
              @click.stop="setActiveTab(tab.id)"
            >{{ tab.label }}</button>
          </div>
          <button class="xd-btn xd-btn--sm" @click.stop="expanded = false">Collapse</button>
        </div>
        <!-- Row 2: Breadcrumb -->
        <div class="xd-breadcrumb-bar">
          <template v-for="(crumb, i) in currentBreadcrumbs" :key="crumb.index">
            <span v-if="i > 0" class="xd-breadcrumb-sep">/</span>
            <span
              class="xd-breadcrumb"
              :class="{ 'xd-breadcrumb--active': crumb.active }"
              @click="navigateBreadcrumb(crumb.index)"
            >{{ crumb.label }}</span>
          </template>
        </div>
        <!-- Content -->
        <div class="xd-content-scaler">
          <FeatureTab v-if="activeTab === 'feature'" />
          <DatabaseTab v-else-if="activeTab === 'database'" />
          <ToolsTab v-else-if="activeTab === 'tools'" />
          <SettingsTab v-else-if="activeTab === 'settings'" />
        </div>
        <div class="xd-resize-handle" @pointerdown="onResizePointerDown"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xd-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--xd-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}

.xd-bubble-badge {
  position: absolute;
  top: -4px;
  right: -4px;
}
</style>
