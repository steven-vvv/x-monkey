<script setup lang="ts">
import { computed, ref } from 'vue';
import { toolsRoute, toolsNavigateTo } from '../lib/store';
import {
  captures, isCapturing, toggleCapture, clearCaptures, getCaptureById,
  isSelectingCaptures, selectedCaptureIds, setCaptureSelectionMode, toggleCaptureSelection,
  selectAllCaptures, getSelectedCaptures,
  type CapturedXhr,
} from '../lib/xhr-capture-service';
import {
  buildXhrCaptureExport,
  getCaptureRequestHeaders,
  getXhrCaptureExportFilename,
  readCaptureQueryParam,
} from '../lib/xhr-capture-export';
import { GM_download } from '$';

const route = toolsRoute;

const captureList = computed(() => captures.value.slice().reverse());

const allCapturesSelected = computed(() => {
  return captures.value.length > 0 && captures.value.every((c) => selectedCaptureIds.has(c.id));
});

const downloadError = ref<string | null>(null);

const listMetaText = computed(() => {
  if (downloadError.value) return downloadError.value;
  if (isSelectingCaptures.value) return `${selectedCaptureIds.size} of ${captures.value.length} selected`;
  return `${captures.value.length} requests`;
});

const detailCapture = computed<CapturedXhr | undefined>(() => {
  if (route.value.page === 'xhr-detail') return getCaptureById(route.value.captureId);
  return undefined;
});

function formatQueryParam(cap: CapturedXhr | undefined, name: 'variables' | 'features' | 'fieldToggles'): string | null {
  if (!cap) return null;
  const value = readCaptureQueryParam(cap, name);
  if (value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

const detailVariables = computed(() => formatQueryParam(detailCapture.value, 'variables'));
const detailFeatures = computed(() => formatQueryParam(detailCapture.value, 'features'));
const detailFieldToggles = computed(() => formatQueryParam(detailCapture.value, 'fieldToggles'));

const detailRequestHeaders = computed<string>(() => {
  const cap = detailCapture.value;
  if (!cap) return '';
  return Object.entries(getCaptureRequestHeaders(cap))
    .map(([name, value]) => `${name}: ${value}`)
    .join('\n');
});

const PREVIEW_LIMIT = 4000;

const detailRequestBodyPreview = computed<string>(() => {
  const body = detailCapture.value?.requestBody ?? '';
  return body.slice(0, PREVIEW_LIMIT);
});

const isRequestBodyTruncated = computed(() => {
  return (detailCapture.value?.requestBody?.length ?? 0) > PREVIEW_LIMIT;
});

const detailResponsePreview = computed<string>(() => {
  const cap = detailCapture.value;
  if (!cap) return '';
  const raw = cap.responseBody;
  if (raw.length <= PREVIEW_LIMIT) return raw;
  return raw.slice(0, PREVIEW_LIMIT);
});

const isResponseTruncated = computed(() => {
  const cap = detailCapture.value;
  return cap ? cap.responseBody.length > PREVIEW_LIMIT : false;
});

function openXhrCapture() {
  toolsNavigateTo({ page: 'xhr-capture' });
}

function openDetail(id: string) {
  toolsNavigateTo({ page: 'xhr-detail', captureId: id });
}

function onCaptureClick(id: string) {
  if (isSelectingCaptures.value) toggleCaptureSelection(id);
  else openDetail(id);
}

function onClear() {
  clearCaptures();
  downloadError.value = null;
}

function toggleSelectionMode() {
  setCaptureSelectionMode(!isSelectingCaptures.value);
  downloadError.value = null;
}

function toggleSelectAll() {
  if (allCapturesSelected.value) selectedCaptureIds.clear();
  else selectAllCaptures();
}

function formatPagePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(cap: CapturedXhr): string {
  return `${Math.max(0, cap.timestamp - cap.startedAt)} ms`;
}

function downloadCaptures(items: CapturedXhr[]) {
  if (items.length === 0) return;
  downloadError.value = null;

  const blob = new Blob([buildXhrCaptureExport(items)], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);
  const release = () => URL.revokeObjectURL(blobUrl);
  GM_download({
    url: blobUrl,
    name: getXhrCaptureExportFilename(items),
    onload: release,
    onerror: (event) => {
      release();
      downloadError.value = `Download failed: ${event.error}${event.details ? ` (${event.details})` : ''}`;
    },
    ontimeout: () => {
      release();
      downloadError.value = 'Download timed out';
    },
  });
}

function downloadSelected() {
  downloadCaptures(getSelectedCaptures());
}

function downloadDetail() {
  if (detailCapture.value) downloadCaptures([detailCapture.value]);
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'xd-status--ok';
  if (status >= 400) return 'xd-status--error';
  return 'xd-status--warn';
}
</script>

<template>
  <div class="xd-tab-wrapper">
    <!-- Tools list -->
    <template v-if="route.page === 'list'">
      <div class="xd-body">
        <div class="xd-tool-card" @click="openXhrCapture">
          <div>
            <div class="xd-tool-card-title">XHR Request Capture</div>
            <div class="xd-tool-card-desc">Capture and inspect GraphQL API requests</div>
          </div>
        </div>
      </div>
    </template>

    <!-- XHR Capture list -->
    <template v-else-if="route.page === 'xhr-capture'">
      <div class="xd-body">
        <div v-if="captureList.length === 0" class="xd-empty">
          {{ isCapturing ? 'Waiting for requests...' : 'Click Start to begin capturing' }}
        </div>
        <div
          v-for="cap in captureList"
          :key="cap.id"
          class="xd-list-item xd-list-item--clickable"
          :class="{ 'xd-list-item--selected': selectedCaptureIds.has(cap.id) }"
          @click="onCaptureClick(cap.id)"
        >
          <div class="xd-list-item-info">
            <div class="xd-list-item-title">
              {{ cap.operationName }}
              <span class="xd-capture-status" :class="statusClass(cap.status)">{{ cap.status }}</span>
            </div>
            <div class="xd-list-item-meta">
              {{ cap.method }} · {{ formatSize(cap.responseSize) }} · {{ formatTime(cap.timestamp) }}
            </div>
            <div class="xd-list-item-meta xd-text-ellipsis" :title="cap.pageUrl">{{ formatPagePath(cap.pageUrl) }}</div>
          </div>
        </div>
      </div>
      <div class="xd-tab-actions">
        <div class="xd-tab-actions-left">
          <template v-if="!isSelectingCaptures">
            <button
              class="xd-btn xd-btn--sm"
              :class="isCapturing ? 'xd-btn--error' : 'xd-btn--accent'"
              @click="toggleCapture"
            >
              {{ isCapturing ? 'Stop' : 'Start' }}
            </button>
            <button class="xd-btn xd-btn--sm" @click="onClear">Clear</button>
          </template>
          <button
            class="xd-btn xd-btn--sm"
            :class="{ 'xd-btn--accent': isSelectingCaptures }"
            @click="toggleSelectionMode"
          >
            {{ isSelectingCaptures ? 'Cancel' : 'Select' }}
          </button>
          <template v-if="isSelectingCaptures">
            <button
              class="xd-btn xd-btn--sm"
              :class="{ 'xd-btn--accent': allCapturesSelected }"
              :disabled="captureList.length === 0"
              @click="toggleSelectAll"
            >
              {{ allCapturesSelected ? 'Clear All' : 'Select All' }}
            </button>
            <button
              class="xd-btn xd-btn--sm xd-btn--accent"
              :disabled="selectedCaptureIds.size === 0"
              @click="downloadSelected"
            >
              Download
            </button>
          </template>
        </div>
        <span class="xd-tab-meta" :class="{ 'xd-tab-meta--error': downloadError }">{{ listMetaText }}</span>
      </div>
    </template>

    <!-- XHR Detail -->
    <template v-else-if="route.page === 'xhr-detail'">
      <div class="xd-body">
        <div v-if="!detailCapture" class="xd-empty">Capture not found</div>
        <template v-else>
          <!-- General -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">General</div>
            <div class="xd-detail-grid">
              <span class="xd-detail-label">Operation</span>
              <span class="xd-detail-value">{{ detailCapture.operationName }}</span>
              <span class="xd-detail-label">GraphQL ID</span>
              <span class="xd-detail-value">{{ detailCapture.graphqlId }}</span>
              <span class="xd-detail-label">Method</span>
              <span class="xd-detail-value">{{ detailCapture.method }}</span>
              <span class="xd-detail-label">Status</span>
              <span class="xd-detail-value" :class="statusClass(detailCapture.status)">{{ detailCapture.status }} {{ detailCapture.statusText }}</span>
              <span class="xd-detail-label">Size</span>
              <span class="xd-detail-value">{{ formatSize(detailCapture.responseSize) }}</span>
              <span class="xd-detail-label">Time</span>
              <span class="xd-detail-value">{{ formatTime(detailCapture.timestamp) }} ({{ formatDuration(detailCapture) }})</span>
            </div>
          </section>

          <!-- Page URL when the request was sent -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">Page URL</div>
            <div class="xd-detail-pre">{{ detailCapture.pageUrl || '(unknown)' }}</div>
          </section>

          <!-- Request URL -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">Request URL</div>
            <div class="xd-detail-pre">{{ detailCapture.url }}</div>
          </section>

          <!-- Variables (decoded) -->
          <section v-if="detailVariables" class="xd-detail-section">
            <div class="xd-detail-section-title">Variables</div>
            <div class="xd-detail-pre">{{ detailVariables }}</div>
          </section>

          <!-- Features (decoded) -->
          <section v-if="detailFeatures" class="xd-detail-section">
            <div class="xd-detail-section-title">Features</div>
            <div class="xd-detail-pre">{{ detailFeatures }}</div>
          </section>

          <!-- Field toggles (decoded) -->
          <section v-if="detailFieldToggles" class="xd-detail-section">
            <div class="xd-detail-section-title">Field Toggles</div>
            <div class="xd-detail-pre">{{ detailFieldToggles }}</div>
          </section>

          <!-- Request Headers (credentials redacted) -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">Request Headers</div>
            <div class="xd-detail-pre">{{ detailRequestHeaders || '(empty)' }}</div>
          </section>

          <!-- Request Body -->
          <section v-if="detailCapture.requestBody != null" class="xd-detail-section">
            <div class="xd-detail-section-title">
              Request Body
              <span v-if="isRequestBodyTruncated" class="xd-detail-section-note">
                (truncated, download for full)
              </span>
            </div>
            <div class="xd-detail-pre">{{ detailRequestBodyPreview }}</div>
          </section>

          <!-- Response Headers -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">Response Headers</div>
            <div class="xd-detail-pre">{{ detailCapture.responseHeaders.trim() || '(empty)' }}</div>
          </section>

          <!-- Response Body -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">
              Response Body
              <span v-if="isResponseTruncated" class="xd-detail-section-note">
                (truncated, download for full)
              </span>
            </div>
            <div class="xd-detail-pre">{{ detailResponsePreview }}</div>
          </section>
        </template>
      </div>
      <div v-if="detailCapture" class="xd-tab-actions">
        <span class="xd-tab-meta" :class="{ 'xd-tab-meta--error': downloadError }">
          {{ downloadError ?? detailCapture.operationName }}
        </span>
        <button class="xd-btn xd-btn--sm xd-btn--accent" @click="downloadDetail">Download</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.xd-tool-card {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-secondary);
  cursor: pointer;
  margin-bottom: 4px;
}

.xd-tool-card:hover {
  border-color: var(--xd-accent);
}

.xd-tool-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--xd-text-primary);
}

.xd-tool-card-desc {
  font-size: 10px;
  color: var(--xd-text-muted);
  margin-top: 2px;
}

.xd-capture-status {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 6px;
  flex-shrink: 0;
}

.xd-status--ok {
  color: var(--xd-success);
}

.xd-status--error {
  color: var(--xd-error);
}

.xd-status--warn {
  color: #e0a030;
}

.xd-detail-section {
  margin-bottom: 10px;
}

.xd-detail-section-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--xd-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.xd-detail-section-note {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}

.xd-detail-pre {
  font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
  font-size: 10px;
  color: var(--xd-text-primary);
  background: var(--xd-bg-tertiary);
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  padding: 6px 8px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.4;
  scrollbar-width: thin;
  scrollbar-color: var(--xd-border) var(--xd-bg-tertiary);
}
</style>
