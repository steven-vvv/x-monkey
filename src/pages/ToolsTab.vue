<script setup lang="ts">
import { computed } from 'vue';
import { toolsRoute, toolsNavigateTo } from '../lib/store';
import {
  captures, isCapturing, toggleCapture, clearCaptures, getCaptureById, hashHex,
  type CapturedXhr,
} from '../lib/xhr-capture-service';
import { useShadowStyle } from '../lib/use-shadow-style';
import { GM_download } from '$';

const route = toolsRoute;

const captureList = computed(() => captures.value.slice().reverse());

const detailCapture = computed<CapturedXhr | undefined>(() => {
  if (route.value.page === 'xhr-detail') return getCaptureById(route.value.captureId);
  return undefined;
});

const detailVariables = computed<string | null>(() => {
  const cap = detailCapture.value;
  if (!cap) return null;
  try {
    const u = new URL(cap.url);
    const vars = u.searchParams.get('variables');
    if (vars) return JSON.stringify(JSON.parse(vars), null, 2);
  } catch { /* ignore */ }
  return null;
});

const detailFeatures = computed<string | null>(() => {
  const cap = detailCapture.value;
  if (!cap) return null;
  try {
    const u = new URL(cap.url);
    const feat = u.searchParams.get('features');
    if (feat) return JSON.stringify(JSON.parse(feat), null, 2);
  } catch { /* ignore */ }
  return null;
});

const PREVIEW_LIMIT = 4000;

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

function onClear() {
  clearCaptures();
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

function downloadResponse() {
  const cap = detailCapture.value;
  if (!cap) return;
  const hash = hashHex(cap.responseBody);
  let isJson = false;
  try { JSON.parse(cap.responseBody); isJson = true; } catch { /* ignore */ }
  const ext = isJson ? 'json' : 'bin';
  const filename = `${cap.operationName}-${hash}.${ext}`;
  const blob = new Blob([cap.responseBody], { type: isJson ? 'application/json' : 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(blob);
  GM_download({ url: blobUrl, name: filename });
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'xd-status--ok';
  if (status >= 400) return 'xd-status--error';
  return 'xd-status--warn';
}

const STYLE_TEXT = `
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
}

.xd-detail-pre::-webkit-scrollbar {
  width: 4px;
}

.xd-detail-pre::-webkit-scrollbar-track {
  background: var(--xd-bg-tertiary);
}

.xd-detail-pre::-webkit-scrollbar-thumb {
  background: var(--xd-border);
  border-radius: 2px;
}
`;

useShadowStyle('tools-tab', STYLE_TEXT);
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
          @click="openDetail(cap.id)"
        >
          <div class="xd-list-item-info">
            <div class="xd-list-item-title">
              {{ cap.operationName }}
              <span class="xd-capture-status" :class="statusClass(cap.status)">{{ cap.status }}</span>
            </div>
            <div class="xd-list-item-meta">
              {{ cap.method }} · {{ formatSize(cap.responseSize) }} · {{ formatTime(cap.timestamp) }}
            </div>
          </div>
        </div>
      </div>
      <div class="xd-tab-actions">
        <div class="xd-tab-actions-left">
          <button
            class="xd-btn xd-btn--sm"
            :class="isCapturing ? 'xd-btn--error' : 'xd-btn--accent'"
            @click="toggleCapture"
          >
            {{ isCapturing ? 'Stop' : 'Start' }}
          </button>
          <button class="xd-btn xd-btn--sm" @click="onClear">Clear</button>
        </div>
        <span class="xd-tab-meta">{{ captureList.length }} requests</span>
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
              <div class="xd-detail-row">
                <span class="xd-detail-label">Method</span>
                <span class="xd-detail-value">{{ detailCapture.method }}</span>
              </div>
              <div class="xd-detail-row">
                <span class="xd-detail-label">Status</span>
                <span class="xd-detail-value" :class="statusClass(detailCapture.status)">
                  {{ detailCapture.status }} {{ detailCapture.statusText }}
                </span>
              </div>
              <div class="xd-detail-row">
                <span class="xd-detail-label">Operation</span>
                <span class="xd-detail-value">{{ detailCapture.operationName }}</span>
              </div>
              <div class="xd-detail-row">
                <span class="xd-detail-label">GraphQL ID</span>
                <span class="xd-detail-value">{{ detailCapture.graphqlId }}</span>
              </div>
              <div class="xd-detail-row">
                <span class="xd-detail-label">Size</span>
                <span class="xd-detail-value">{{ formatSize(detailCapture.responseSize) }}</span>
              </div>
              <div class="xd-detail-row">
                <span class="xd-detail-label">Time</span>
                <span class="xd-detail-value">{{ formatTime(detailCapture.timestamp) }}</span>
              </div>
            </div>
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

          <!-- Response Headers -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">Response Headers</div>
            <div class="xd-detail-pre">{{ detailCapture.responseHeaders.trim() || '(empty)' }}</div>
          </section>

          <!-- Response Body -->
          <section class="xd-detail-section">
            <div class="xd-detail-section-title">
              Response Body
              <span v-if="isResponseTruncated" style="font-weight: 400; text-transform: none; letter-spacing: 0;">
                (truncated, download for full)
              </span>
            </div>
            <div class="xd-detail-pre">{{ detailResponsePreview }}</div>
          </section>
        </template>
      </div>
      <div v-if="detailCapture" class="xd-tab-actions">
        <span class="xd-tab-meta">{{ detailCapture.operationName }}</span>
        <button class="xd-btn xd-btn--sm xd-btn--accent" @click="downloadResponse">Download Response</button>
      </div>
    </template>
  </div>
</template>
