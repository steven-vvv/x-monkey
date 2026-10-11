<script setup lang="ts">
// "工具": XHR request capture (record, list, select / export, detail), driven by the tools route stack (store.ts).
// Same data logic as the classic ToolsTab; the folds, copy buttons and toolbar layout are new.
import { computed, ref, watch } from 'vue';
import { toolsNavigateTo, toolsNavigateToIndex, toolsRoute, toolsStackView, type ToolsRoute } from '../../lib/store';
import {
  captures, clearCaptures, getCaptureById, getSelectedCaptures, isCapturing, isSelectingCaptures, selectAllCaptures,
  selectedCaptureIds, setCaptureSelectionMode, toggleCapture, toggleCaptureSelection, type CapturedXhr,
} from '../../lib/xhr-capture-service';
import {
  buildXhrCaptureExport, getCaptureRequestHeaders, getXhrCaptureExportFilename, readCaptureQueryParam,
} from '../../lib/xhr-capture-export';
import { GM_download } from '$';
import {
  TOOLS_COPY, durationMs, foldHint, formatClock, formatSize, itemCountLabel, requestCountLabel, statusTone,
} from '../tools-format';
import XmBanner from '../components/XmBanner.vue';
import XmEmpty from '../components/XmEmpty.vue';
import XmFold from '../components/XmFold.vue';
import XmIcon from '../components/XmIcon.vue';
import XmNavBar, { type XmCrumb } from '../components/XmNavBar.vue';
import XmReqRow from '../components/XmReqRow.vue';

const route = toolsRoute;

// ---- list ----

const captureList = computed(() => captures.value.slice().reverse());
const total = computed(() => captures.value.length);
const allSelected = computed(() => total.value > 0 && captures.value.every((c) => selectedCaptureIds.has(c.id)));
const downloadError = ref<string | null>(null);

function openXhrCapture(): void {
  toolsNavigateTo({ page: 'xhr-capture' });
}

function onRowSelect(id: string): void {
  if (isSelectingCaptures.value) toggleCaptureSelection(id);
  else toolsNavigateTo({ page: 'xhr-detail', captureId: id });
}

function onClear(): void {
  clearCaptures();
  downloadError.value = null;
}

function toggleSelectionMode(): void {
  setCaptureSelectionMode(!isSelectingCaptures.value);
  downloadError.value = null;
}

function toggleSelectAll(): void {
  if (allSelected.value) selectedCaptureIds.clear();
  else selectAllCaptures();
}

// ---- download ----

function downloadCaptures(items: CapturedXhr[]): void {
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
      downloadError.value = `${event.error}${event.details ? `（${event.details}）` : ''}`;
    },
    ontimeout: () => {
      release();
      downloadError.value = '浏览器没有在限定时间内响应。';
    },
  });
}

// ---- detail ----

const detail = computed<CapturedXhr | undefined>(() => (
  route.value.page === 'xhr-detail' ? getCaptureById(route.value.captureId) : undefined
));

interface Section {
  title: string;
  text: string;
  hint?: string;
  hintAlways?: boolean;
  open?: boolean;
  json?: boolean;
}

function queryParam(capture: CapturedXhr, name: 'variables' | 'features' | 'fieldToggles'): { text: string; parsed: unknown } | null {
  const value = readCaptureQueryParam(capture, name);
  if (value === undefined) return null;
  return { text: typeof value === 'string' ? value : JSON.stringify(value, null, 2), parsed: value };
}

const sections = computed<Section[]>(() => {
  const cap = detail.value;
  if (!cap) return [];
  const variables = queryParam(cap, 'variables');
  const features = queryParam(cap, 'features');
  const fieldToggles = queryParam(cap, 'fieldToggles');
  const requestHeaders = Object.entries(getCaptureRequestHeaders(cap)).map(([name, value]) => `${name}: ${value}`);
  const responseHeaders = cap.responseHeaders.trim();
  const list: Section[] = [
    { title: '请求 URL', text: cap.url, hint: formatSize(cap.url.length), open: !variables },
  ];
  if (variables) list.push({ title: 'Variables', text: variables.text, hint: foldHint(variables.text, variables.parsed), open: true, json: true });
  if (features) list.push({ title: 'Features', text: features.text, hint: foldHint(features.text, features.parsed), json: true });
  if (fieldToggles) list.push({ title: 'Field Toggles', text: fieldToggles.text, hint: foldHint(fieldToggles.text, fieldToggles.parsed), json: true });
  list.push({ title: '请求头', text: requestHeaders.join('\n'), hint: '凭据已隐去', hintAlways: true });
  if (cap.requestBody != null) list.push({ title: '请求体', text: cap.requestBody, hint: formatSize(cap.requestBody.length), json: true });
  list.push({
    title: '响应头',
    text: responseHeaders,
    hint: responseHeaders ? itemCountLabel(responseHeaders.split(/\r?\n/).length) : undefined,
  });
  list.push({ title: '响应体', text: cap.responseBody, hint: formatSize(cap.responseSize), open: true, json: true });
  return list;
});

// ---- navigation ----

function routeLabel(value: ToolsRoute): string {
  switch (value.page) {
    case 'list': return '工具';
    case 'xhr-capture': return TOOLS_COPY.entryTitle;
    case 'xhr-detail': return '详情';
    default: return '';
  }
}

const depth = computed(() => toolsStackView.value.length);
const crumbs = computed<XmCrumb[]>(() => toolsStackView.value.map((entry, index, all) => ({
  label: routeLabel(entry),
  onClick: index < all.length - 1 ? () => toolsNavigateToIndex(index) : undefined,
})));
const back = computed(() => (depth.value > 1 ? () => toolsNavigateToIndex(depth.value - 2) : undefined));

watch(() => route.value.page, () => { downloadError.value = null; });
</script>

<template>
  <div class="xm-view" data-view="tools">
    <!-- Tools list: no navbar -->
    <div v-if="route.page === 'list'" class="xm-body">
      <div
        class="xm-entry"
        role="button"
        tabindex="0"
        data-role="open-xhr"
        :aria-label="`${TOOLS_COPY.entryTitle}，${isCapturing ? `录制中 · ${total}` : requestCountLabel(total)}`"
        @click="openXhrCapture"
        @keydown.enter.prevent="openXhrCapture"
        @keydown.space.prevent="openXhrCapture"
      >
        <div class="xm-entry__icon"><XmIcon name="activity" /></div>
        <div class="xm-entry__main">
          <div class="xm-entry__title">{{ TOOLS_COPY.entryTitle }}</div>
          <div class="xm-entry__desc">{{ TOOLS_COPY.entryDesc }}</div>
        </div>
        <div class="xm-entry__side">
          <template v-if="isCapturing"><span class="xm-rec-dot"></span><span class="xm-num">录制中 · {{ total }}</span></template>
          <template v-else><span class="xm-num">{{ requestCountLabel(total) }}</span><XmIcon name="chev-r" class="xm-ico--sm" /></template>
        </div>
      </div>
    </div>

    <template v-else>
      <XmNavBar :crumbs="crumbs" :back="back" />

      <!-- XHR request list -->
      <template v-if="route.page === 'xhr-capture'">
        <div class="xm-toolbar">
          <button v-if="isCapturing" type="button" class="xm-btn xm-btn--danger" data-role="record" @click="toggleCapture()">
            <XmIcon name="stop" class="xm-ico--sm" />停止录制
          </button>
          <button v-else type="button" class="xm-btn xm-btn--primary" data-role="record" @click="toggleCapture()">
            <XmIcon name="record" class="xm-ico--sm" />开始录制
          </button>
          <button type="button" class="xm-btn xm-btn--ghost" data-role="clear" :disabled="total === 0" @click="onClear">
            <XmIcon name="trash" class="xm-ico--sm" />清空
          </button>
          <span class="xm-toolbar__spacer"></span>
          <span class="xm-toolbar__meta" data-role="count"><span v-if="isCapturing" class="xm-rec-dot"></span> {{ requestCountLabel(total) }}</span>
        </div>

        <div class="xm-body">
          <XmEmpty
            v-if="captureList.length === 0"
            icon="activity"
            :title="isCapturing ? TOOLS_COPY.emptyRecording : TOOLS_COPY.emptyIdle"
          />
          <XmReqRow
            v-for="cap in captureList"
            :key="cap.id"
            :capture="cap"
            :selecting="isSelectingCaptures"
            :selected="selectedCaptureIds.has(cap.id)"
            @select="onRowSelect(cap.id)"
          />
        </div>

        <XmBanner
          v-if="downloadError"
          class="xm-banner--dock"
          tone="danger"
          title="下载失败"
          :text="downloadError"
          @close="downloadError = null"
        />
        <div v-if="isSelectingCaptures" class="xm-footer" data-role="select-footer">
          <button type="button" class="xm-iconbtn" title="退出选择" aria-label="退出选择" @click="toggleSelectionMode"><XmIcon name="x" /></button>
          <div class="xm-footer__meta"><span>已选 <strong class="xm-num">{{ selectedCaptureIds.size }}</strong> / {{ total }}</span></div>
          <button type="button" class="xm-btn xm-btn--ghost" :disabled="total === 0" @click="toggleSelectAll">{{ allSelected ? '取消全选' : '全选' }}</button>
          <button
            type="button" class="xm-btn xm-btn--primary" data-role="download" :disabled="selectedCaptureIds.size === 0"
            @click="downloadCaptures(getSelectedCaptures())"
          >
            <XmIcon name="download" class="xm-ico--sm" />下载 {{ selectedCaptureIds.size }} 项
          </button>
        </div>
        <div v-else class="xm-footer" data-role="list-footer">
          <div class="xm-footer__meta"><span class="xm-ellip">点击请求查看详情</span></div>
          <button type="button" class="xm-btn" data-role="select-mode" :disabled="total === 0" @click="toggleSelectionMode">
            <XmIcon name="check" class="xm-ico--sm" />选择导出
          </button>
        </div>
      </template>

      <!-- Request detail -->
      <template v-else-if="route.page === 'xhr-detail'">
        <div class="xm-body">
          <XmEmpty v-if="!detail" icon="activity" :title="TOOLS_COPY.notFound" />
          <template v-else>
            <div class="xm-reqhead">
              <div class="xm-reqhead__title">
                <span :title="detail.operationName">{{ detail.operationName }}</span>
                <span class="xm-code" :class="`xm-code--${statusTone(detail.status)}`">{{ detail.status }}{{ detail.statusText ? ` ${detail.statusText}` : '' }}</span>
              </div>
              <dl class="xm-kvgrid">
                <dt>GraphQL ID</dt><dd>{{ detail.graphqlId }}</dd>
                <dt>方法</dt><dd>{{ detail.method }}</dd>
                <dt>大小</dt><dd>{{ formatSize(detail.responseSize) }}</dd>
                <dt>完成时间</dt><dd>{{ formatClock(detail.timestamp) }} · {{ durationMs(detail) }} ms</dd>
                <dt>页面</dt><dd>{{ detail.pageUrl || '（未知）' }}</dd>
              </dl>
            </div>
            <XmFold
              v-for="section in sections"
              :key="`${detail.id}:${section.title}`"
              :title="section.title"
              :text="section.text"
              :hint="section.hint"
              :hint-always="section.hintAlways"
              :open="section.open"
              :json="section.json"
            />
          </template>
        </div>

        <XmBanner
          v-if="downloadError"
          class="xm-banner--dock"
          tone="danger"
          title="下载失败"
          :text="downloadError"
          @close="downloadError = null"
        />
        <div v-if="detail" class="xm-footer" data-role="detail-footer">
          <div class="xm-footer__meta"><span class="xm-ellip">导出包含页面 URL、请求与响应</span></div>
          <button type="button" class="xm-btn xm-btn--primary" data-role="download" @click="downloadCaptures([detail])">
            <XmIcon name="download" class="xm-ico--sm" />下载 JSON
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.xm-ellip { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
</style>
