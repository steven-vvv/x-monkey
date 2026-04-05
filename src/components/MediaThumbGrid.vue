<script setup lang="ts">
import type { DbMediaRecord } from '../lib/types';
import { getMediaOpenUrl, getMediaThumbUrl } from '../lib/tweet-selectors';

const props = defineProps<{ media: DbMediaRecord[] }>();

const emit = defineEmits<{
  (e: 'open', url: string): void;
}>();
</script>

<template>
  <div v-if="props.media.length > 0" class="xd-detail-media">
    <div
      v-for="mediaItem in props.media"
      :key="mediaItem.id"
      class="xd-thumb"
      @click="emit('open', getMediaOpenUrl(mediaItem))"
    >
      <img :src="getMediaThumbUrl(mediaItem)" loading="lazy" />
      <span v-if="mediaItem.type !== 'photo'" class="xd-thumb-badge">{{ mediaItem.type === 'video' ? 'VID' : 'GIF' }}</span>
    </div>
  </div>
</template>

<style scoped>
.xd-detail-media {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 6px;
  margin-bottom: 10px;
}

.xd-thumb {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--xd-radius);
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--xd-border);
  background: var(--xd-bg-secondary);
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
  right: 4px;
  bottom: 4px;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
}
</style>
