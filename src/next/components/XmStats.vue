<script setup lang="ts">
// Stat grid (3 columns; 6 at >=460px; `five` = 5 columns for the profile). Unknown values are dimmed.
import type { DetailStat } from '../labels';

defineProps<{ items: DetailStat[]; five?: boolean }>();
</script>

<template>
  <div class="xm-stats" :class="{ 'xm-stats--5': five }">
    <div v-for="item in items" :key="item.label" class="xm-stat" :class="{ 'xm-stat--na': item.na }">
      <b>{{ item.value }}</b><span>{{ item.label }}</span>
    </div>
  </div>
</template>
