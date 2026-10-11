<script setup lang="ts">
// Centered empty / waiting state. `icon`: icon name; `title`: bold line; `hint`: muted explanation.
import XmIcon from './XmIcon.vue';
import type { IconName } from '../icons';

defineProps<{ icon?: IconName; title: string; hint?: string }>();
</script>

<template>
  <div class="xm-empty">
    <div class="xm-empty__icon"><XmIcon :name="icon ?? 'page'" class="xm-ico--lg" /></div>
    <div class="xm-empty__title">{{ title }}</div>
    <div v-if="hint" class="xm-empty__hint">{{ hint }}</div>
  </div>
</template>
