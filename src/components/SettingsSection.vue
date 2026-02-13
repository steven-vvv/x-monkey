<script setup lang="ts">
import { useShadowStyle } from '../lib/use-shadow-style';

defineProps<{
  title: string;
  hint?: string;
}>();

const STYLE_TEXT = `
.xd-settings-section {
  margin-bottom: 12px;
}

.xd-settings-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--xd-text-secondary);
  margin-bottom: 6px;
}

.xd-settings-hint {
  font-size: 10px;
  color: var(--xd-text-muted);
  margin-top: 4px;
  line-height: 1.3;
}
`;

useShadowStyle('settings-section', STYLE_TEXT);
</script>

<template>
  <section class="xd-settings-section">
    <div class="xd-settings-title">{{ title }}</div>
    <slot />
    <div v-if="hint" class="xd-settings-hint">{{ hint }}</div>
  </section>
</template>
