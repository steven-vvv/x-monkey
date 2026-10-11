<script setup lang="ts">
// One captured XHR request in the tools list. `selecting` shows a leading checkbox; emits select on click / Enter / Space.
import { computed } from 'vue';
import type { CapturedXhr } from '../../lib/xhr-capture-service';
import { durationMs, formatClock, formatPagePath, formatSize, statusTone } from '../tools-format';
import XmCheck from './XmCheck.vue';

const props = defineProps<{ capture: CapturedXhr; selecting?: boolean; selected?: boolean }>();
const emit = defineEmits<{ (e: 'select'): void }>();

const time = computed(() => formatClock(props.capture.timestamp));
const pagePath = computed(() => formatPagePath(props.capture.pageUrl));
const ariaLabel = computed(() => `${props.capture.operationName}，${props.capture.status}，${time.value}`);

function onKey(event: KeyboardEvent): void {
  event.preventDefault();
  emit('select');
}
</script>

<template>
  <div
    class="xm-req"
    :class="{ 'xm-req--selected': selecting && selected }"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-pressed="selecting ? !!selected : undefined"
    :data-capture="capture.id"
    @click="emit('select')"
    @keydown.enter="onKey"
    @keydown.space="onKey"
  >
    <XmCheck v-if="selecting" :on="selected" />
    <div class="xm-req__main">
      <div class="xm-req__head">
        <span class="xm-code" :class="`xm-code--${statusTone(capture.status)}`">{{ capture.status }}</span>
        <span class="xm-req__op" :title="capture.operationName">{{ capture.operationName }}</span>
        <span class="xm-req__time">{{ time }}</span>
      </div>
      <div class="xm-req__meta" :title="capture.pageUrl">
        <span class="xm-method">{{ capture.method }}</span> · {{ formatSize(capture.responseSize) }} · {{ durationMs(capture) }} ms · {{ pagePath }}
      </div>
    </div>
  </div>
</template>
