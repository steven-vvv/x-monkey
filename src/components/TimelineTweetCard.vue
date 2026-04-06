<script setup lang="ts">
import { computed } from 'vue';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from '../lib/types';
import { avatarFull, formatTweetDate } from '../lib/view-format';
import {
  getMediaThumbUrl,
  getTweetDisplayText,
  getTweetMediaIds,
  getTweetNote,
  getTweetQuoteId,
  getTweetRepostId,
} from '../lib/tweet-selectors';

const props = defineProps<{
  tweet: DbTweetRecord;
  author: DbUserRecord | undefined;
  media: DbMediaRecord[];
}>();

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();

const previewText = computed(() => getTweetDisplayText(props.tweet) || '(no text)');
const visibleMedia = computed(() => props.media.slice(0, 4));
const extraCount = computed(() => Math.max(0, props.media.length - 4));
const dateText = computed(() => formatTweetDate(props.tweet.createdAt));
const flags = computed(() => [
  getTweetNote(props.tweet) ? 'Long' : null,
  getTweetQuoteId(props.tweet) ? 'Quote' : null,
  getTweetRepostId(props.tweet) ? 'Repost' : null,
  props.tweet.communityNote ? 'Note' : null,
].filter(Boolean) as string[]);
const mediaCount = computed(() => getTweetMediaIds(props.tweet).length);
</script>

<template>
  <div class="xd-timeline-card xd-list-item--clickable" @click="emit('select', tweet.id)">
    <img
      v-if="author?.profile.avatarUrl"
      class="xd-timeline-card-avatar"
      :src="avatarFull(author.profile.avatarUrl)"
      loading="lazy"
    />

    <div class="xd-timeline-card-main">
      <div class="xd-list-item-title">
        <span class="xd-author-name">{{ author?.profile.displayName ?? '?' }}</span>
        <span class="xd-author-handle">@{{ author?.profile.userName ?? '?' }}</span>
        <span class="xd-post-date">{{ dateText }}</span>
      </div>

      <div class="xd-timeline-card-text">{{ previewText }}</div>

      <div v-if="flags.length > 0" class="xd-timeline-card-flags">
        <span v-for="flag in flags" :key="flag" class="xd-timeline-card-flag">{{ flag }}</span>
      </div>

      <div v-if="visibleMedia.length > 0 && mediaCount > 0" class="xd-timeline-card-media">
        <div
          v-for="(item, index) in visibleMedia"
          :key="item.id"
          class="xd-timeline-card-media-cell"
        >
          <img :src="getMediaThumbUrl(item)" loading="lazy" />
          <span v-if="item.type !== 'photo'" class="xd-timeline-card-media-badge">{{ item.type === 'video' ? 'VID' : 'GIF' }}</span>
          <span v-if="index === visibleMedia.length - 1 && extraCount > 0" class="xd-timeline-card-media-extra">+{{ extraCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xd-timeline-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.xd-timeline-card-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--xd-border);
  object-fit: cover;
  background: var(--xd-bg-secondary);
}

.xd-timeline-card-main {
  min-width: 0;
}

.xd-timeline-card-text {
  margin-top: 4px;
  color: var(--xd-text-primary);
  line-height: 1.45;
  word-break: break-word;
}

.xd-timeline-card-flags {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.xd-timeline-card-flag {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--xd-bg-secondary);
  color: var(--xd-text-muted);
  font-size: 9px;
}

.xd-timeline-card-media {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-top: 8px;
}

.xd-timeline-card-media-cell {
  position: relative;
  aspect-ratio: 1.35;
  overflow: hidden;
  border-radius: var(--xd-radius);
  background: var(--xd-bg-secondary);
  border: 1px solid var(--xd-border);
}

.xd-timeline-card-media-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.xd-timeline-card-media-badge,
.xd-timeline-card-media-extra {
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

.xd-timeline-card-media-extra {
  left: 4px;
  right: auto;
}
</style>
