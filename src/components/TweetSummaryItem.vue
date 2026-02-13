<script setup lang="ts">
import { computed } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser } from '../lib/db-service';
import { tweetText } from '../lib/view-format';
import { useShadowStyle } from '../lib/use-shadow-style';

const props = withDefaults(defineProps<{
  tweet: DbTweet;
  compact?: boolean;
  showFocalDot?: boolean;
}>(), {
  compact: false,
  showFocalDot: false,
});

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();

const author = computed(() => getDbUser(props.tweet.authorId));
const text = computed(() => tweetText(props.tweet) || '(no text)');

const STYLE_TEXT = `
.xd-summary-item--compact {
  padding: 4px 8px;
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

.xd-focal-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--xd-accent);
  margin-right: 4px;
  vertical-align: middle;
}
`;

useShadowStyle('tweet-summary-item', STYLE_TEXT);
</script>

<template>
  <div
    class="xd-list-item xd-list-item--clickable"
    :class="{ 'xd-summary-item--compact': compact }"
    @click="emit('select', tweet.id)"
  >
    <div class="xd-list-item-info">
      <div class="xd-list-item-title">
        <span v-if="showFocalDot && tweet._focal" class="xd-focal-dot"></span>
        <span class="xd-author-name">{{ author?.name ?? '?' }}</span>
        <span class="xd-author-handle">@{{ author?.screenName ?? '?' }}</span>
      </div>
      <div class="xd-list-item-meta xd-text-ellipsis">{{ text }}</div>
    </div>
    <div v-if="tweet.mediaIds.length > 0" class="xd-media-badge">{{ tweet.mediaIds.length }}</div>
  </div>
</template>
