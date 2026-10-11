<script setup lang="ts">
// Inline SVG icon from the static table in ../icons.ts. Size via class fallthrough: <XmIcon name="check" class="xm-ico--sm" />.
import { computed } from 'vue';
import { ICONS, type IconName } from '../icons';

const props = defineProps<{ name: IconName }>();
const markup = computed(() => ICONS[props.name]);
</script>

<template>
  <svg class="xm-ico" viewBox="0 0 24 24" aria-hidden="true" v-html="markup"></svg>
</template>
