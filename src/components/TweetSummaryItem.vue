<script setup lang="ts">
import { computed } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser } from '../lib/db-service';
import { formatTweetDate } from '../lib/view-format';
import { getTweetDisplayText } from '../lib/tweet-selectors';

const props = withDefaults(defineProps<{
  tweet: DbTweet;
  compact?: boolean;
}>(), {
  compact: false,
});

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();

const author = computed(() => getDbUser(props.tweet.authorId));
const text = computed(() => getTweetDisplayText(props.tweet) || '(no text)');
const dateText = computed(() => formatTweetDate(props.tweet.createdAt));
const metaFlags = computed(() => [
  props.tweet.note ? 'Long' : null,
  props.tweet.quoteTweetId ? 'Quote' : null,
  props.tweet.repostTweetId ? 'Repost' : null,
].filter(Boolean) as string[]);
</script>

<template>
  <div
    class="xd-list-item xd-list-item--clickable"
    :class="{ 'xd-summary-item--compact': compact }"
    @click="emit('select', tweet.id)"
  >
    <div class="xd-list-item-info">
      <div class="xd-list-item-title">
        <span class="xd-author-name">{{ author?.profile.displayName ?? '?' }}</span>
        <span class="xd-author-handle">@{{ author?.profile.userName ?? '?' }}</span>
        <span class="xd-post-date">{{ dateText }}</span>
      </div>
      <div class="xd-list-item-meta xd-text-ellipsis">{{ text }}</div>
      <div v-if="metaFlags.length > 0" class="xd-summary-flags">
        <span v-for="flag in metaFlags" :key="flag" class="xd-summary-flag">{{ flag }}</span>
      </div>
    </div>
    <div v-if="tweet.mediaIds.length > 0" class="xd-media-badge">{{ tweet.mediaIds.length }}</div>
  </div>
</template>

<style scoped>
.xd-summary-item--compact {
  padding: 5px 8px;
}

.xd-summary-flags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.xd-summary-flag {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--xd-border);
  color: var(--xd-text-muted);
  font-size: 9px;
}

.xd-media-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--xd-radius);
  background: var(--xd-bg-tertiary);
  color: var(--xd-text-secondary);
  font-size: 10px;
  flex-shrink: 0;
}
</style>
