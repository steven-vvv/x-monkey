<script setup lang="ts">
import { computed } from 'vue';
import type { DbMediaRecord } from '../lib/types';
import { getConfig } from '../lib/config-service';
import { getMediaOpenUrl, getMediaThumbUrl } from '../lib/tweet-selectors';
import { getMediaSensitivityOverlayText } from '../lib/view-format';

const props = defineProps<{ media: DbMediaRecord[] }>();

const emit = defineEmits<{
  (e: 'open', url: string): void;
}>();

const cfg = getConfig();

const mediaItems = computed(() => props.media.map((mediaItem) => ({
  mediaItem,
  sensitivityText: cfg.maskSensitiveMediaWarnings ? getMediaSensitivityOverlayText(mediaItem) : null,
})));
</script>

<template>
  <div v-if="props.media.length > 0" class="xd-detail-media">
    <div
      v-for="{ mediaItem, sensitivityText } in mediaItems"
      :key="mediaItem.id"
      class="xd-thumb xd-media-maskable"
      @click="emit('open', getMediaOpenUrl(mediaItem))"
    >
      <img :src="getMediaThumbUrl(mediaItem)" loading="lazy" />
      <div v-if="sensitivityText" class="xd-media-sensitivity-overlay">
        <span class="xd-media-sensitivity-label">{{ sensitivityText }}</span>
      </div>
      <span v-if="mediaItem.type !== 'photo'" class="xd-thumb-badge">{{ mediaItem.type === 'video' ? 'VID' : 'GIF' }}</span>
    </div>
  </div>
</template>

<style scoped>
.xd-detail-media {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.xd-thumb {
  position: relative;
  height: 136px;
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
  z-index: 2;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
}
</style>
