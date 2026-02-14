<script setup lang="ts">
import type { XMedia } from '../lib/types';

const props = defineProps<{ media: XMedia[] }>();

const emit = defineEmits<{
  (e: 'open', url: string): void;
}>();
</script>

<template>
  <div v-if="props.media.length > 0" class="xd-detail-media">
    <div
      v-for="m in props.media"
      :key="m.id"
      class="xd-thumb"
      @click="emit('open', m.sourceUrl)"
    >
      <img :src="m.thumbUrl" loading="lazy" />
      <span v-if="m.type !== 'photo'" class="xd-thumb-badge">{{ m.type === 'video' ? 'VID' : 'GIF' }}</span>
    </div>
  </div>
</template>

<style scoped>
.xd-detail-media {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.xd-thumb {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: var(--xd-radius);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--xd-border);
}

.xd-thumb:hover {
  border-color: var(--xd-accent);
}

.xd-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.xd-thumb-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
}
</style>
