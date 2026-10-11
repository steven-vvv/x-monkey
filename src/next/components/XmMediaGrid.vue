<script setup lang="ts">
// Detail media grid: 1 full-width 16:9, 2 two columns, 3 with the first cell spanning two rows, 4+ a 2x2 with "+n"
// on the fourth. Sensitive media is masked like XmMediaStrip. Click / Enter / Space emits open-media(full-size url).
import { computed } from 'vue';
import type { Media, Post } from '../../archive/model';
import { getConfig } from '../../lib/config-service';
import { getMediaOpenUrl, getMediaThumbUrl } from '../../lib/post-view';
import { formatDuration, mediaSensitivityLabel } from '../labels';
import XmIcon from './XmIcon.vue';

const MAX_CELLS = 4;

const props = defineProps<{ media: Media[]; post?: Pick<Post, 'contentWarning'> }>();
const emit = defineEmits<{ (e: 'open-media', url: string): void }>();

const cfg = getConfig();

const cells = computed(() => props.media.slice(0, MAX_CELLS).map((item) => ({
  item,
  thumb: getMediaThumbUrl(item),
  mask: cfg.maskSensitiveMediaWarnings ? mediaSensitivityLabel(item, props.post) : null,
  duration: item.type === 'video' && item.video?.durationMs !== undefined ? formatDuration(item.video.durationMs) : null,
})));
const extra = computed(() => Math.max(0, props.media.length - MAX_CELLS));
</script>

<template>
  <div v-if="media.length > 0" class="xm-grid" :class="`xm-grid--${Math.min(media.length, MAX_CELLS)}`">
    <div
      v-for="({ item, thumb, mask, duration }, index) in cells"
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
      <span v-if="index === cells.length - 1 && extra > 0" class="xm-media__more">+{{ extra }}</span>
    </div>
  </div>
</template>

<style scoped>
.xm-grid--3 .xm-media:first-child img { position: absolute; inset: 0; }
</style>
