<script setup lang="ts">
// Remote-sync dot (avatar corner, or legend dot with class "xm-legend" parent). `status` undefined renders nothing.
import { computed } from 'vue';
import type { RemoteRecordStatus } from '../../lib/remote-db';
import { SYNC_STATUS_TITLES } from '../labels';

const props = defineProps<{ status?: RemoteRecordStatus }>();
const title = computed(() => (props.status ? SYNC_STATUS_TITLES[props.status] : undefined));
</script>

<template>
  <span v-if="status" class="xm-sync" :class="`xm-sync--${status}`" role="img" :title="title" :aria-label="title"></span>
</template>
