<script setup lang="ts">
import { computed } from 'vue';
import type { XTweet, XMedia, XUser } from '../lib/types';
import { tweetText, formatTweetDate } from '../lib/view-format';

const props = defineProps<{
  tweet: XTweet;
  author: XUser | undefined;
  media: XMedia[];
}>();

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();

const text = computed(() => tweetText(props.tweet));
const visibleCount = computed(() => Math.min(props.media.length, 4));
const gridMedia = computed(() => props.media.slice(0, visibleCount.value));
const extraCount = computed(() => Math.max(0, props.media.length - 4));
const dateText = computed(() => formatTweetDate(props.tweet.createdAt));

const gridClass = computed(() => {
  const n = visibleCount.value;
  if (n <= 1) return 'xd-grid-1';
  if (n === 2) return 'xd-grid-2';
  if (n === 3) return 'xd-grid-3';
  return 'xd-grid-4';
});
</script>

<template>
  <div class="xd-media-card" @click="emit('select', tweet.id)">
    <div class="xd-media-card-left">
      <div class="xd-list-item-title">
        <span class="xd-author-name">{{ author?.name ?? '?' }}</span>
        <span class="xd-author-handle">@{{ author?.screenName ?? '?' }}</span>
        <span class="xd-post-date">{{ dateText }}</span>
      </div>
      <div v-if="text" class="xd-media-card-text">{{ text }}</div>
    </div>

    <div v-if="gridMedia.length > 0" class="xd-media-card-grid" :class="gridClass">
      <div
        v-for="(m, i) in gridMedia"
        :key="m.id"
        class="xd-media-card-cell"
      >
        <img :src="m.thumbUrl" loading="lazy" />
        <span v-if="m.type !== 'photo'" class="xd-media-card-cell-badge">{{ m.type === 'video' ? 'VID' : 'GIF' }}</span>
        <span v-if="i === visibleCount - 1 && extraCount > 0" class="xd-media-card-cell-extra">+{{ extraCount }}</span>
      </div>
    </div>
    <div v-else class="xd-media-card-empty">No media</div>
  </div>
</template>

<style scoped>
.xd-media-card {
  display: flex;
  height: 96px;
  box-sizing: border-box;
  padding: 6px;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-secondary);
  margin-bottom: 4px;
  cursor: pointer;
  gap: 6px;
  overflow: hidden;
}

.xd-media-card:hover {
  border-color: var(--xd-accent);
}

.xd-media-card:last-child {
  margin-bottom: 0;
}

.xd-media-card-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.xd-media-card-text {
  font-size: 11px;
  color: var(--xd-text-secondary);
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 3px;
  overflow: hidden;
  flex: 1;
  min-height: 0;
}

.xd-media-card-grid {
  flex-shrink: 0;
  height: 100%;
  aspect-ratio: 1;
  display: grid;
  gap: 2px;
  border-radius: var(--xd-radius);
  overflow: hidden;
}

.xd-grid-1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.xd-grid-2 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}

.xd-grid-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.xd-grid-3 .xd-media-card-cell:first-child {
  grid-row: 1 / 3;
}

.xd-grid-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.xd-media-card-cell {
  position: relative;
  overflow: hidden;
  background: var(--xd-bg-primary);
}

.xd-media-card-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.xd-media-card-cell-badge {
  position: absolute;
  bottom: 1px;
  right: 1px;
  padding: 0 2px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 7px;
  font-weight: 600;
  line-height: 1.4;
}

.xd-media-card-cell-extra {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.xd-media-card-empty {
  flex-shrink: 0;
  height: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--xd-text-muted);
  font-style: italic;
  border: 1px dashed var(--xd-border);
  border-radius: var(--xd-radius);
}
</style>
