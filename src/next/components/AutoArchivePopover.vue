<script setup lang="ts">
// 持续归档 popover (SPEC section 11, F20/F21): status pill, exact counters, failures, last submit, actions.
// Rendered by the shell inside the panel (absolute, right-aligned under the header) together with a click-away
// scrim. The shell owns Esc (it closes this popover before collapsing the panel).
import { computed, onMounted, ref } from 'vue';
import {
  autoArchiveState as state,
  pauseAutoArchive,
  resumeAutoArchive,
  retryAutoArchiveFailures,
} from '../../lib/auto-archive';
import { describeAutoArchiveError, describeFailureId, formatExact, type AutoArchiveStatus } from '../auto-archive-labels';
import { formatClock } from '../labels';
import XmIcon from './XmIcon.vue';
import XmStatusPill from './XmStatusPill.vue';

const MAX_FAILURE_ROWS = 20;

defineProps<{ status: AutoArchiveStatus }>();
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-settings'): void }>();

const root = ref<HTMLElement | null>(null);
const failuresOpen = ref(false);

onMounted(() => root.value?.focus({ preventScroll: true }));

const submitted = computed(() => state.stats.accepted + state.stats.unchanged + state.stats.partial);
const paused = computed(() => state.phase === 'paused');
const loginIssue = computed(() => state.phase === 'needs-login' || state.phase === 'forbidden');
const failureRows = computed(() => state.failures.slice(0, MAX_FAILURE_ROWS).map((item) => ({ ...describeFailureId(item.id), reason: item.reason })));
const failureOverflow = computed(() => Math.max(0, state.failures.length - MAX_FAILURE_ROWS));

const lastSubmit = computed(() => (state.lastSubmittedAt ? `最近提交 ${formatClock(state.lastSubmittedAt)}` : '尚未提交'));
/** The error is kept after recovery; show it only while it is newer than the last successful submit. */
const errorLine = computed(() => {
  const error = state.lastError;
  if (!error) return null;
  if (state.lastSubmittedAt && error.at <= state.lastSubmittedAt) return null;
  return `${formatClock(error.at)} · ${describeAutoArchiveError(error.status, error.message)}`;
});

function togglePause(): void {
  if (paused.value) resumeAutoArchive();
  else pauseAutoArchive();
}
</script>

<template>
  <div class="xm-scrim" data-role="autoarc-scrim" @click="emit('close')"></div>
  <div ref="root" class="xm-popover" role="dialog" aria-label="持续归档" tabindex="-1" data-role="autoarc-popover">
    <div class="xm-popover__head">
      <span class="xm-popover__title">持续归档</span>
      <XmStatusPill :tone="status.tone" data-role="autoarc-pill">{{ status.text }}</XmStatusPill>
    </div>

    <div class="xm-autoarc__stats" data-role="autoarc-stats">
      <div class="xm-autoarc__stat"><span class="xm-autoarc__label">已提交</span><span class="xm-autoarc__value" data-stat="submitted">{{ formatExact(submitted) }}</span></div>
      <div class="xm-autoarc__stat"><span class="xm-autoarc__label">新增或更新</span><span class="xm-autoarc__value" data-stat="accepted">{{ formatExact(state.stats.accepted) }}</span></div>
      <div class="xm-autoarc__stat"><span class="xm-autoarc__label">未变</span><span class="xm-autoarc__value" data-stat="unchanged">{{ formatExact(state.stats.unchanged) }}</span></div>
      <div class="xm-autoarc__stat" :class="{ 'xm-autoarc__stat--accent': state.queued > 0 }"><span class="xm-autoarc__label">排队</span><span class="xm-autoarc__value" data-stat="queued">{{ formatExact(state.queued) }}</span></div>
    </div>

    <div v-if="state.failures.length > 0" class="xm-autoarc__fails" data-role="autoarc-fails">
      <button type="button" class="xm-autoarc__failrow" :aria-expanded="failuresOpen" @click="failuresOpen = !failuresOpen">
        <XmIcon name="alert" class="xm-ico--sm" />
        <span>失败 <span class="xm-num">{{ formatExact(state.failures.length) }}</span> 条</span>
        <XmIcon :name="failuresOpen ? 'chev-d' : 'chev-r'" class="xm-ico--sm" />
      </button>
      <div v-if="failuresOpen" class="xm-autoarc__faillist">
        <div v-for="item in failureRows" :key="`${item.kind}:${item.id}`">{{ item.kind }} <span class="xm-autoarc__failid">{{ item.id }}</span>：{{ item.reason }}</div>
        <div v-if="failureOverflow > 0" class="xm-autoarc__more">另有 {{ formatExact(failureOverflow) }} 条</div>
      </div>
    </div>

    <div class="xm-autoarc__meta">
      <span>{{ lastSubmit }}</span>
      <span v-if="errorLine" class="xm-autoarc__err" data-role="autoarc-error">{{ errorLine }}</span>
    </div>

    <div class="xm-autoarc__actions">
      <button v-if="loginIssue" type="button" class="xm-btn xm-btn--sm xm-btn--primary" data-role="autoarc-settings" @click="emit('open-settings')">打开设置</button>
      <button v-if="state.failures.length > 0" type="button" class="xm-btn xm-btn--sm" data-role="autoarc-retry" @click="retryAutoArchiveFailures()">重试失败项</button>
      <button
        type="button"
        class="xm-btn xm-btn--sm"
        :class="{ 'xm-btn--primary': paused }"
        data-role="autoarc-pause"
        @click="togglePause"
      >{{ paused ? '继续' : '暂停本次会话' }}</button>
      <button v-if="!loginIssue" type="button" class="xm-autoarc__link" data-role="autoarc-settings" @click="emit('open-settings')">打开设置</button>
    </div>
  </div>
</template>
