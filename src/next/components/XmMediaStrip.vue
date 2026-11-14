<script setup lang="ts">
// Timeline media strip: up to 4 equal cells, "+n" on the last when more. `media`: post media; `post`: for the content-warning fallback.
// Cells open the media (emits open-media with the full-size URL) and do not bubble to the row. The "+n" overflow
// cell is not interactive: clicks fall through to the row, which opens the post detail (it shows every item).
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

const extra = computed(() => Math.max(0, props.media.length - MAX_CELLS));

const cells = computed(() => props.media.slice(0, MAX_CELLS).map((item, index, shown) => ({
  item,
  overflow: extra.value > 0 && index === shown.length - 1,
  thumb: getMediaThumbUrl(item),
  mask: cfg.maskSensitiveMediaWarnings ? mediaSensitivityLabel(item, props.post) : null,
  duration: item.type === 'video' && item.video?.durationMs !== undefined ? formatDuration(item.video.durationMs) : null,
})));

// The overflow cell is inert: the event bubbles to the row (opens the post detail).
function open(item: Media, overflow: boolean, event: Event): void {
  if (overflow) return;
  event.stopPropagation();
  if (event.type === 'keydown') event.preventDefault();
  emit('open-media', getMediaOpenUrl(item));
}
</script>

<template>
  <div v-if="media.length > 0" class="xm-strip" :class="{ 'xm-strip--1': media.length === 1 }">
    <div
      v-for="{ item, thumb, mask, duration, overflow } in cells"
      :key="item.id"
      class="xm-media"
      :class="{ 'xm-media--masked': mask, 'xm-media--overflow': overflow }"
      :role="overflow ? undefined : 'button'"
      :tabindex="overflow ? undefined : 0"
      :title="overflow ? `查看全部 ${media.length} 个媒体` : '打开媒体'"
      :aria-label="overflow ? undefined : '打开媒体'"
      @click="open(item, overflow, $event)"
      @keydown.enter="open(item, overflow, $event)"
      @keydown.space="open(item, overflow, $event)"
    >
      <img :src="thumb" :alt="item.alt ?? ''" loading="lazy" />
      <div v-if="mask" class="xm-media__mask"><XmIcon name="eye-off" />{{ mask }}</div>
      <span v-if="item.type === 'video'" class="xm-media__badge"><XmIcon name="play" />{{ duration }}</span>
      <span v-else-if="item.type === 'gif'" class="xm-media__badge">GIF</span>
      <span v-if="overflow" class="xm-media__more">+{{ extra }}</span>
    </div>
  </div>
</template>
