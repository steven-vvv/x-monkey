<script setup lang="ts">
// Collapsible detail section with a copy button. `text` is the FULL content: the body previews the first
// `previewLimit` characters, the copy button copies everything. `hint`: right-side note while collapsed (or always
// with `hintAlways`). `json`: light key / string colouring (tokens render as text nodes, never as HTML).
import { computed, onBeforeUnmount, ref } from 'vue';
import { GM_setClipboard } from '$';
import { PREVIEW_LIMIT, PREVIEW_NOTE, tokenizeJson } from '../tools-format';
import XmIcon from './XmIcon.vue';

const props = withDefaults(defineProps<{
  title: string;
  text: string;
  hint?: string;
  hintAlways?: boolean;
  open?: boolean;
  json?: boolean;
  /** Text shown in the body when `text` is empty. */
  emptyText?: string;
}>(), { open: false, emptyText: '（空）' });

const isOpen = ref(props.open);
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const truncated = computed(() => props.text.length > PREVIEW_LIMIT);
const preview = computed(() => (truncated.value ? props.text.slice(0, PREVIEW_LIMIT) : props.text));
const tokens = computed(() => (props.json && isOpen.value ? tokenizeJson(preview.value) : []));
const showHint = computed(() => !!props.hint && (!isOpen.value || props.hintAlways));

function toggle(): void {
  isOpen.value = !isOpen.value;
}

function onHeadKey(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  toggle();
}

function copy(): void {
  GM_setClipboard(props.text, 'text');
  copied.value = true;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { copied.value = false; }, 1500);
}

onBeforeUnmount(() => clearTimeout(copyTimer));
</script>

<template>
  <div class="xm-fold" :class="{ 'xm-fold--closed': !isOpen }" :data-fold="title">
    <div
      class="xm-fold__head"
      role="button"
      tabindex="0"
      :aria-expanded="isOpen"
      @click="toggle"
      @keydown.enter="onHeadKey"
      @keydown.space="onHeadKey"
    >
      <XmIcon name="chev-d" class="xm-ico--sm xm-ico--chev" />
      <span class="xm-fold__title">{{ title }}</span>
      <span v-if="showHint" class="xm-fold__hint">{{ hint }}</span>
      <button
        v-if="text"
        type="button"
        class="xm-iconbtn xm-iconbtn--sm"
        data-role="copy"
        :title="copied ? '已复制' : `复制${title}`"
        :aria-label="copied ? '已复制' : `复制${title}`"
        @click.stop="copy"
        @keydown.enter.stop
        @keydown.space.stop
      ><XmIcon :name="copied ? 'check' : 'copy'" class="xm-ico--sm" /></button>
    </div>
    <div v-if="isOpen" class="xm-fold__body">
      <div class="xm-pre">
        <template v-if="!text">{{ emptyText }}</template>
        <template v-else-if="json"><template v-for="(token, i) in tokens" :key="i"><span v-if="token.kind" :class="`xm-tok-${token.kind}`">{{ token.text }}</span><template v-else>{{ token.text }}</template></template></template>
        <template v-else>{{ preview }}</template>
      </div>
      <div v-if="truncated" class="xm-pre__trunc">{{ PREVIEW_NOTE }}</div>
    </div>
  </div>
</template>
