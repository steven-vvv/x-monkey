<script setup lang="ts">
// Poll block: share bars (leader emphasised) and a "n 票 · 截止 time" footer.
import { computed } from 'vue';
import type { Poll } from '../../archive/model';
import { toPollView } from '../labels';

const props = defineProps<{ poll: Poll }>();
const view = computed(() => toPollView(props.poll));
</script>

<template>
  <div class="xm-poll">
    <div v-for="(row, index) in view.rows" :key="index" class="xm-poll__row" :class="{ 'xm-poll__row--lead': row.lead }">
      <span v-if="row.percent !== null" class="xm-poll__bar" :style="{ width: `${row.percent}%` }"></span>
      <span>{{ row.label }}</span>
      <span v-if="row.percent !== null" class="xm-num">{{ row.percent.toFixed(1) }}%</span>
    </div>
  </div>
  <div v-if="view.foot" class="xm-poll__foot xm-num">{{ view.foot }}</div>
</template>
