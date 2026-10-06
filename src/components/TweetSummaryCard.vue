<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue';
import type { Media, Post, User } from '../archive/model';
import type { RemoteRecordStatus } from '../lib/remote-db';
import { getConfig } from '../lib/config-service';
import { formatTweetDateTime, getMediaSensitivityOverlayText, toTweetSummaryStats } from '../lib/view-format';
import { getAvatarUrl, getMediaThumbUrl, getPlainText } from '../lib/post-view';

const SUMMARY_MEDIA_MIN_WIDTH = 125;
const SUMMARY_MEDIA_GAP = 4;
const SUMMARY_MEDIA_MIN_COLUMNS = 2;
const SUMMARY_MEDIA_HEIGHT = 100;

const SUMMARY_STAT_MIN_WIDTH = 56;
const SUMMARY_STAT_GAP = 4;

const props = defineProps<{
  /** The post whose content is shown (the original for a repost). */
  post: Post;
  author: User | undefined;
  media: Media[];
  /** Set when the timeline entry is a repost of `post`. */
  repostedBy?: User;
  remoteSyncStatus?: RemoteRecordStatus;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
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

const previewText = computed(() => getPlainText(props.post.text) || props.post.article?.title || '');
const dateText = computed(() => formatTweetDateTime(props.post.createdAt));
const avatarUrl = computed(() => props.author ? getAvatarUrl(props.author) : undefined);
const hasAvatar = computed(() => Boolean(avatarUrl.value));
const hasLeadCell = computed(() => hasAvatar.value || Boolean(props.remoteSyncStatus));
const visibleMediaCount = computed(() => resolveVisibleMediaCount(mediaWidth.value));
const visibleMedia = computed(() => props.media.slice(0, visibleMediaCount.value));
const visibleMediaItems = computed(() => visibleMedia.value.map((item) => ({
  item,
  sensitivityText: cfg.maskSensitiveMediaWarnings ? getMediaSensitivityOverlayText(item, props.post) : null,
})));
const extraCount = computed(() => Math.max(0, props.media.length - visibleMedia.value.length));
const mediaGridStyle = computed<Record<string, string>>(() => ({
  '--xd-summary-media-min-width': `${SUMMARY_MEDIA_MIN_WIDTH}px`,
  '--xd-summary-media-gap': `${SUMMARY_MEDIA_GAP}px`,
  '--xd-summary-media-height': `${SUMMARY_MEDIA_HEIGHT}px`,
}));
const summaryStats = computed(() => toTweetSummaryStats(props.post.counts));
const visibleStatCount = computed(() => resolveVisibleStatCount(cardWidth.value, summaryStats.value.length));
const visibleStats = computed(() => summaryStats.value.slice(0, visibleStatCount.value));
const statsGridStyle = computed<Record<string, string>>(() => ({
  '--xd-summary-stat-columns': String(visibleStats.value.length),
}));
const remoteSyncStatusText = computed(() => {
  if (props.remoteSyncStatus === 'in_sync') return 'Remote database in sync';
  if (props.remoteSyncStatus === 'stale') return 'Remote database has older counts';
  if (props.remoteSyncStatus === 'missing') return 'Remote database missing';
  if (props.remoteSyncStatus === 'mismatch') return 'Remote database mismatch';
  if (props.remoteSyncStatus === 'failed') return 'Remote database failed';
  return undefined;
});
const remoteSyncStatusClass = computed(() => {
  return props.remoteSyncStatus
    ? `xd-tweet-summary-card-sync-dot--${props.remoteSyncStatus.replace('_', '-')}`
    : undefined;
});
</script>

<template>
  <div
    ref="cardElement"
    class="xd-tweet-summary-card xd-list-item--clickable"
    :class="{
      'xd-tweet-summary-card--no-avatar': !hasLeadCell,
      'xd-tweet-summary-card--selected': props.selected,
    }"
    @click="emit('select')"
  >
    <div v-if="hasLeadCell" class="xd-tweet-summary-card-visual">
      <img
        v-if="avatarUrl"
        class="xd-tweet-summary-card-avatar"
        :src="avatarUrl"
        loading="lazy"
      />
      <span
        v-if="remoteSyncStatus"
        class="xd-tweet-summary-card-sync-dot"
        :class="remoteSyncStatusClass"
        :title="remoteSyncStatusText"
        :aria-label="remoteSyncStatusText"
        role="img"
      ></span>
    </div>

    <div class="xd-tweet-summary-card-main">
      <div v-if="repostedBy" class="xd-tweet-summary-card-context">Reposted by @{{ repostedBy.handle }}</div>
      <div class="xd-tweet-summary-card-head">
        <div class="xd-tweet-summary-card-author-line">
          <span class="xd-tweet-summary-card-author-name">{{ author?.name ?? '?' }}</span>
          <span class="xd-tweet-summary-card-author-handle">@{{ author?.handle ?? '?' }}</span>
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
