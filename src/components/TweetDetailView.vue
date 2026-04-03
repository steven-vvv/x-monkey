<script setup lang="ts">
import type { DbTweet } from '../lib/db-service';
import TweetDetailCard from './TweetDetailCard.vue';
import TweetSummaryItem from './TweetSummaryItem.vue';

const props = withDefaults(defineProps<{
  tweet: DbTweet;
  parents?: DbTweet[];
  replies?: DbTweet[];
  showParents?: boolean;
}>(), {
  parents: () => [],
  replies: () => [],
  showParents: false,
});

const emit = defineEmits<{
  (e: 'open-user', userId: string): void;
  (e: 'open-original', tweet: DbTweet): void;
  (e: 'open-media', url: string): void;
  (e: 'open-tweet', tweetId: string): void;
}>();
</script>

<template>
  <template v-if="showParents && props.parents.length > 0">
    <div class="xd-context-label">Thread above</div>
    <TweetSummaryItem
      v-for="item in props.parents"
      :key="item.id"
      :tweet="item"
      compact
      @select="(tweetId) => emit('open-tweet', tweetId)"
    />
    <div class="xd-context-divider"></div>
  </template>

  <TweetDetailCard
    :tweet="props.tweet"
    @open-user="(userId) => emit('open-user', userId)"
    @open-original="(tweet) => emit('open-original', tweet)"
    @open-media="(url) => emit('open-media', url)"
  />

  <slot name="after-detail" :tweet="props.tweet" :replies="props.replies" />

  <template v-if="props.replies.length > 0">
    <div class="xd-context-divider"></div>
    <div class="xd-context-label">Replies</div>
    <TweetSummaryItem
      v-for="item in props.replies"
      :key="item.id"
      :tweet="item"
      compact
      @select="(tweetId) => emit('open-tweet', tweetId)"
    />
  </template>
</template>
