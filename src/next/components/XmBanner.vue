<script setup lang="ts">
// Result / error banner. `tone`: ok|danger|warn; `title` bold line; `text` muted body; `action`: inline link button
// after the text; `dismissible` shows an x button that emits `close`.
import XmIcon from './XmIcon.vue';

withDefaults(defineProps<{
  tone: 'ok' | 'danger' | 'warn';
  title: string;
  text?: string;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
}>(), { dismissible: true });

defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <div class="xm-banner" :class="`xm-banner--${tone}`" :role="tone === 'danger' ? 'alert' : 'status'">
    <XmIcon :name="tone === 'ok' ? 'check' : 'alert'" />
    <div class="xm-banner__body">
      <div class="xm-banner__title">{{ title }}</div>
      <div v-if="text || action" class="xm-banner__text">
        {{ text }}
        <button v-if="action" type="button" class="xm-banner__link" @click="action.onClick">{{ action.label }}</button>
      </div>
    </div>
    <button v-if="dismissible" type="button" class="xm-iconbtn xm-iconbtn--sm" title="关闭" aria-label="关闭" @click="$emit('close')">
      <XmIcon name="x" class="xm-ico--sm" />
    </button>
  </div>
</template>
