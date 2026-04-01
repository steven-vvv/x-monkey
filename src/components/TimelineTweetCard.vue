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
const previewText = computed(() => text.value || '(no text)');
const hasText = computed(() => text.value.length > 0);
const hasMedia = computed(() => props.media.length > 0);
const visibleCount = computed(() => Math.min(props.media.length, 4));
const gridMedia = computed(() => props.media.slice(0, visibleCount.value));
const extraCount = computed(() => Math.max(0, props.media.length - 4));
const dateText = computed(() => formatTweetDate(props.tweet.createdAt));

const gridClass = computed(() => {
  const n = visibleCount.value;
  if (n <= 1) return 'xd-timeline-card-media--1';
  if (n === 2) return 'xd-timeline-card-media--2';
  if (n === 3) return 'xd-timeline-card-media--3';
  return 'xd-timeline-card-media--4';
});
</script>

<template>
  <div
    class="xd-timeline-card xd-list-item--clickable"
    :class="{ 'xd-timeline-card--text-only': !hasMedia }"
    @click="emit('select', tweet.id)"
  >
    <div class="xd-timeline-card-main">
      <div class="xd-list-item-title">
        <span class="xd-author-name">{{ author?.name ?? '?' }}</span>
        <span class="xd-author-handle">@{{ author?.screenName ?? '?' }}</span>
        <span class="xd-post-date">{{ dateText }}</span>
      </div>
      <div class="xd-timeline-card-text" :class="{ 'xd-timeline-card-text--muted': !hasText }">{{ previewText }}</div>
    </div>

    <div v-if="hasMedia" class="xd-timeline-card-media" :class="gridClass">
      <div
        v-for="(item, index) in gridMedia"
        :key="item.id"
        class="xd-timeline-card-media-cell"
      >
        <img :src="item.thumbUrl" loading="lazy" />
        <span v-if="item.type !== 'photo'" class="xd-timeline-card-media-badge">{{ item.type === 'video' ? 'VID' : 'GIF' }}</span>
        <span v-if="index === visibleCount - 1 && extraCount > 0" class="xd-timeline-card-media-extra">+{{ extraCount }}</span>
      </div>
    </div>
  </div>
</template>
