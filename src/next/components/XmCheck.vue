<script setup lang="ts">
// Checkbox glyph (display only; the parent row handles clicks). `on`: checked.
import XmIcon from './XmIcon.vue';

defineProps<{ on?: boolean }>();
</script>

<template>
  <span class="xm-check" :class="{ 'xm-check--on': on }" aria-hidden="true"><XmIcon v-if="on" name="check" /></span>
</template>
