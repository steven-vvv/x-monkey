<script setup lang="ts">
// Rich text as inline segments: entities (links, mentions, hashtags) in the accent colour, bold / italic /
// underline / strike kept, `title` = full URL. Inherits white-space from the parent.
import { computed } from 'vue';
import type { RichText } from '../../archive/model';
import { getRichTextSegments } from '../../lib/post-view';

const props = defineProps<{ text: RichText }>();
const segments = computed(() => getRichTextSegments(props.text));
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index"
    ><span
      :class="{ 'xm-link': segment.kind !== 'plain', 'xm-rt--b': segment.bold, 'xm-rt--i': segment.italic, 'xm-rt--u': segment.underline, 'xm-rt--s': segment.strike }"
      :title="segment.href"
    >{{ segment.text }}</span></template>
</template>

<style scoped>
.xm-rt--b { font-weight: 700; }
.xm-rt--i { font-style: italic; }
.xm-rt--u { text-decoration: underline; }
.xm-rt--s { text-decoration: line-through; }
.xm-rt--u.xm-rt--s { text-decoration: underline line-through; }
</style>
