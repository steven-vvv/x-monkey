<script setup lang="ts">
// Detail media grid: 1 full-width 16:9, 2 two columns, 3 with the first cell spanning two rows, 4 a 2x2, 5+ a
// three-column grid of squares. Every item is shown (no "+n"). Sensitive media is masked like XmMediaStrip.
// Click / Enter / Space emits open-media(full-size url).
import { computed } from 'vue';
import type { Media, Post } from '../../archive/model';
import { getConfig } from '../../lib/config-service';
import { getMediaOpenUrl, getMediaThumbUrl } from '../../lib/post-view';
import { formatDuration, mediaSensitivityLabel } from '../labels';
import XmIcon from './XmIcon.vue';

// Up to this many items use the fixed 1-4 layouts; more switch to the square grid.
const MAX_FIXED_LAYOUT = 4;

const props = defineProps<{ media: Media[]; post?: Pick<Post, 'contentWarning'> }>();
const emit = defineEmits<{ (e: 'open-media', url: string): void }>();

const cfg = getConfig();

const cells = computed(() => props.media.map((item) => ({
  item,
  thumb: getMediaThumbUrl(item),
  mask: cfg.maskSensitiveMediaWarnings ? mediaSensitivityLabel(item, props.post) : null,
  duration: item.type === 'video' && item.video?.durationMs !== undefined ? formatDuration(item.video.durationMs) : null,
})));
const layout = computed(() => (props.media.length > MAX_FIXED_LAYOUT ? 'many' : String(props.media.length)));
</script>

<template>
  <div v-if="media.length > 0" class="xm-grid" :class="`xm-grid--${layout}`">
    <div
      v-for="{ item, thumb, mask, duration } in cells"
      :key="item.id"
      class="xm-media"
      :class="{ 'xm-media--masked': mask }"
      role="button"
      tabindex="0"
      title="打开媒体"
      aria-label="打开媒体"
      @click="emit('open-media', getMediaOpenUrl(item))"
      @keydown.enter.prevent="emit('open-media', getMediaOpenUrl(item))"
      @keydown.space.prevent="emit('open-media', getMediaOpenUrl(item))"
    >
      <img :src="thumb" :alt="item.alt ?? ''" loading="lazy" />
      <div v-if="mask" class="xm-media__mask"><XmIcon name="eye-off" />{{ mask }}</div>
      <span v-if="item.type === 'video'" class="xm-media__badge"><XmIcon name="play" />{{ duration }}</span>
      <span v-else-if="item.type === 'gif'" class="xm-media__badge">GIF</span>
    </div>
  </div>
</template>

<style scoped>
.xm-grid--3 .xm-media:first-child img { position: absolute; inset: 0; }
</style>
