<script setup lang="ts">
import type { TweetCompactCardItem } from '../lib/view-format';

const props = defineProps<{
  item: TweetCompactCardItem;
}>();

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();
</script>

<template>
  <div
    class="xd-tweet-compact-card xd-list-item--clickable"
    @click="emit('select', props.item.tweetId)"
  >
    <div class="xd-tweet-compact-card-main">
      <div class="xd-tweet-compact-card-head">
        <div class="xd-tweet-compact-card-author-line">
          <span class="xd-tweet-compact-card-author-name" :title="props.item.displayName">{{ props.item.displayName }}</span>
          <span class="xd-tweet-compact-card-author-handle" :title="`@${props.item.userName}`">@{{ props.item.userName }}</span>
          <span class="xd-tweet-compact-card-date">{{ props.item.dateText }}</span>
        </div>
      </div>

      <div class="xd-tweet-compact-card-text xd-text-ellipsis">{{ props.item.text }}</div>
    </div>

    <div v-if="props.item.mediaCount > 0" class="xd-tweet-compact-card-media-count">{{ props.item.mediaCount }}</div>
  </div>
</template>
