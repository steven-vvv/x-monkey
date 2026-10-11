<script setup lang="ts">
// Timeline media strip: up to 4 equal cells, "+n" on the last when more. `media`: post media; `post`: for the content-warning fallback.
// Cells open the media (emits open-media with the full-size URL) and do not bubble to the row.
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

function open(item: Media, event: Event): void {
  event.stopPropagation();
  emit('open-media', getMediaOpenUrl(item));
}
</script>

<template>
  <div v-if="media.length > 0" class="xm-strip" :class="{ 'xm-strip--1': media.length === 1 }">
    <div
      v-for="({ item, thumb, mask, duration }, index) in cells"
      :key="item.id"
      class="xm-media"
      :class="{ 'xm-media--masked': mask }"
      role="button"
      tabindex="0"
      title="打开媒体"
      aria-label="打开媒体"
      @click="open(item, $event)"
      @keydown.enter.stop.prevent="open(item, $event)"
      @keydown.space.stop.prevent="open(item, $event)"
    >
      <img :src="thumb" :alt="item.alt ?? ''" loading="lazy" />
      <div v-if="mask" class="xm-media__mask"><XmIcon name="eye-off" />{{ mask }}</div>
      <span v-if="item.type === 'video'" class="xm-media__badge"><XmIcon name="play" />{{ duration }}</span>
      <span v-else-if="item.type === 'gif'" class="xm-media__badge">GIF</span>
      <span v-if="index === cells.length - 1 && extra > 0" class="xm-media__more">+{{ extra }}</span>
    </div>
  </div>
</template>
