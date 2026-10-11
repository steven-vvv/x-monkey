<script setup lang="ts">
// Round avatar. `url` image, else first-letter fallback from `name`; `size`: sm|md|(default 32px); `syncStatus` adds the corner mark.
import { computed } from 'vue';
import type { RemoteRecordStatus } from '../../lib/remote-db';
import XmSyncMark from './XmSyncMark.vue';

const props = defineProps<{
  url?: string;
  name?: string;
  size?: 'sm' | 'md';
  syncStatus?: RemoteRecordStatus;
}>();

const initial = computed(() => Array.from((props.name ?? '').trim())[0]?.toUpperCase() ?? '?');
</script>

<template>
  <div class="xm-avatar" :class="[size ? `xm-avatar--${size}` : '', url ? '' : 'xm-avatar--fallback']">
    <img v-if="url" :src="url" alt="" loading="lazy" />
    <template v-else>{{ initial }}</template>
    <XmSyncMark :status="syncStatus" />
  </div>
</template>
