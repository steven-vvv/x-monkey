<script setup lang="ts">
import type { StatItem } from '../lib/view-format';

defineProps<{ stats: StatItem[] }>();
</script>

<template>
  <div class="xd-detail-stats">
    <div v-for="s in stats" :key="s.label" class="xd-stat">
      <span class="xd-stat-value">{{ s.value }}</span>
      <span class="xd-stat-label">{{ s.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.xd-detail-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 8px;
}

.xd-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 8px;
  background: var(--xd-bg-secondary);
  border-radius: var(--xd-radius);
  min-width: 50px;
}

.xd-stat-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--xd-text-primary);
}

.xd-stat-label {
  font-size: 9px;
  color: var(--xd-text-muted);
}
</style>
