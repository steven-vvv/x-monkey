<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from '../lib/types';
import { getConfig } from '../lib/config-service';
import { avatarFull, formatTweetDateTime, toTweetSummaryStats } from '../lib/view-format';
import { getMediaSensitivityOverlayText } from '../lib/view-format';
import {
  getMediaThumbUrl,
  getTweetSummaryText,
} from '../lib/tweet-selectors';

const SUMMARY_MEDIA_MIN_WIDTH = 125;
const SUMMARY_MEDIA_GAP = 4;
const SUMMARY_MEDIA_MIN_COLUMNS = 2;
const SUMMARY_MEDIA_HEIGHT = 100;

const SUMMARY_STAT_MIN_WIDTH = 56;
const SUMMARY_STAT_GAP = 4;

const props = defineProps<{
  tweet: DbTweetRecord;
  author: DbUserRecord | undefined;
  media: DbMediaRecord[];
}>();

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();

const cfg = getConfig();
const cardElement = ref<HTMLElement | null>(null);
const mediaElement = ref<HTMLElement | null>(null);
const cardWidth = ref(0);
const mediaWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

function updateWidths() {
  cardWidth.value = cardElement.value?.clientWidth ?? 0;
  mediaWidth.value = mediaElement.value?.clientWidth ?? 0;
}

function observeResizableElements() {
  if (!resizeObserver) return;

  if (cardElement.value) {
    resizeObserver.observe(cardElement.value);
  }

  if (mediaElement.value) {
    resizeObserver.observe(mediaElement.value);
  }
}

function resolveVisibleMediaCount(width: number): number {
  if (width <= 0) return SUMMARY_MEDIA_MIN_COLUMNS;
  return Math.max(
    SUMMARY_MEDIA_MIN_COLUMNS,
    Math.floor((width + SUMMARY_MEDIA_GAP) / (SUMMARY_MEDIA_MIN_WIDTH + SUMMARY_MEDIA_GAP)),
  );
}

function resolveVisibleStatCount(width: number, total: number): number {
  if (width <= 0) return total;
  return Math.max(1, Math.min(total, Math.floor((width + SUMMARY_STAT_GAP) / (SUMMARY_STAT_MIN_WIDTH + SUMMARY_STAT_GAP))));
}

onMounted(() => {
  updateWidths();
  if (typeof ResizeObserver === 'undefined') return;

  resizeObserver = new ResizeObserver(() => {
    updateWidths();
  });
  observeResizableElements();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});

onUpdated(() => {
  updateWidths();
  observeResizableElements();
});

const previewText = computed(() => getTweetSummaryText(props.tweet));
const dateText = computed(() => formatTweetDateTime(props.tweet.createdAt));
const hasAvatar = computed(() => Boolean(props.author?.profile.avatarUrl));
const visibleMediaCount = computed(() => resolveVisibleMediaCount(mediaWidth.value));
const visibleMedia = computed(() => props.media.slice(0, visibleMediaCount.value));
const visibleMediaItems = computed(() => visibleMedia.value.map((item) => ({
  item,
  sensitivityText: cfg.maskSensitiveMediaWarnings ? getMediaSensitivityOverlayText(item) : null,
})));
const extraCount = computed(() => Math.max(0, props.media.length - visibleMedia.value.length));
const mediaGridStyle = computed<Record<string, string>>(() => ({
  '--xd-summary-media-min-width': `${SUMMARY_MEDIA_MIN_WIDTH}px`,
  '--xd-summary-media-gap': `${SUMMARY_MEDIA_GAP}px`,
  '--xd-summary-media-height': `${SUMMARY_MEDIA_HEIGHT}px`,
}));
const summaryStats = computed(() => toTweetSummaryStats(props.tweet));
const visibleStatCount = computed(() => resolveVisibleStatCount(cardWidth.value, summaryStats.value.length));
const visibleStats = computed(() => summaryStats.value.slice(0, visibleStatCount.value));
const statsGridStyle = computed<Record<string, string>>(() => ({
  '--xd-summary-stat-columns': String(visibleStats.value.length),
}));
</script>

<template>
  <div
    ref="cardElement"
    class="xd-tweet-summary-card xd-list-item--clickable"
    :class="{ 'xd-tweet-summary-card--no-avatar': !hasAvatar }"
    @click="emit('select', tweet.id)"
  >
    <img
      v-if="author?.profile.avatarUrl"
      class="xd-tweet-summary-card-avatar"
      :src="avatarFull(author.profile.avatarUrl)"
      loading="lazy"
    />

    <div class="xd-tweet-summary-card-main">
      <div class="xd-tweet-summary-card-head">
        <div class="xd-tweet-summary-card-author-line">
          <span class="xd-tweet-summary-card-author-name">{{ author?.profile.displayName ?? '?' }}</span>
          <span class="xd-tweet-summary-card-author-handle">@{{ author?.profile.userName ?? '?' }}</span>
        </div>
        <span class="xd-tweet-summary-card-date">{{ dateText }}</span>
      </div>

      <div v-if="previewText" class="xd-tweet-summary-card-text">{{ previewText }}</div>

      <div
        v-if="props.media.length > 0"
        ref="mediaElement"
        class="xd-tweet-summary-card-media"
        :style="mediaGridStyle"
      >
        <div
          v-for="({ item, sensitivityText }, index) in visibleMediaItems"
          :key="item.id"
          class="xd-tweet-summary-card-media-cell xd-media-maskable"
        >
          <img :src="getMediaThumbUrl(item)" loading="lazy" />
          <div v-if="sensitivityText" class="xd-media-sensitivity-overlay">
            <span class="xd-media-sensitivity-label">{{ sensitivityText }}</span>
          </div>
          <span v-if="item.type !== 'photo'" class="xd-tweet-summary-card-media-badge">{{ item.type === 'video' ? 'VID' : 'GIF' }}</span>
          <span v-if="index === visibleMediaItems.length - 1 && extraCount > 0" class="xd-tweet-summary-card-media-extra">+{{ extraCount }}</span>
        </div>
      </div>
    </div>

    <div class="xd-tweet-summary-card-stats" :style="statsGridStyle">
      <div
        v-for="stat in visibleStats"
        :key="stat.label"
        class="xd-tweet-summary-card-stat"
      >
        <span class="xd-tweet-summary-card-stat-label">{{ stat.label }}</span>
        <span class="xd-tweet-summary-card-stat-value">{{ stat.value }}</span>
      </div>
    </div>
  </div>
</template>
