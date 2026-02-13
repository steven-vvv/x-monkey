<script setup lang="ts">
import { computed } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser, getMediaForTweet } from '../lib/db-service';
import { toTweetStats, tweetText } from '../lib/view-format';
import { useShadowStyle } from '../lib/use-shadow-style';
import StatGrid from './StatGrid.vue';
import MediaThumbGrid from './MediaThumbGrid.vue';

const props = defineProps<{ tweet: DbTweet }>();

const emit = defineEmits<{
  (e: 'open-user', userId: string): void;
  (e: 'open-original', tweet: DbTweet): void;
  (e: 'open-media', url: string): void;
}>();

const author = computed(() => getDbUser(props.tweet.authorId));
const text = computed(() => tweetText(props.tweet));
const stats = computed(() => toTweetStats(props.tweet));
const media = computed(() => getMediaForTweet(props.tweet.id));

const STYLE_TEXT = `
.xd-detail-author {
  padding: 6px 0;
  margin-bottom: 4px;
}

.xd-detail-text {
  font-size: 12px;
  color: var(--xd-text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 8px;
}

.xd-detail-actions {
  padding: 4px 0;
}
`;

useShadowStyle('tweet-detail-card', STYLE_TEXT);
</script>

<template>
  <div class="xd-detail-author xd-list-item--clickable" @click="emit('open-user', tweet.authorId)">
    <span class="xd-author-name">{{ author?.name ?? '?' }}</span>
    <span class="xd-author-handle">@{{ author?.screenName ?? '?' }}</span>
  </div>

  <div v-if="text" class="xd-detail-text">{{ text }}</div>

  <StatGrid :stats="stats" />

  <MediaThumbGrid :media="media" @open="(url) => emit('open-media', url)" />

  <div class="xd-detail-actions">
    <button class="xd-btn xd-btn--accent" @click="emit('open-original', tweet)">Open Original</button>
  </div>
</template>
