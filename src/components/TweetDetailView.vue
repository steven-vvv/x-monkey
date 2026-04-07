<script setup lang="ts">
import { computed } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser } from '../lib/db-service';
import { toTweetCompactCardItem } from '../lib/view-format';
import TweetDetailCard from './TweetDetailCard.vue';
import TweetCompactCard from './TweetCompactCard.vue';

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

const parentCards = computed(() => props.parents.map((tweet) => toTweetCompactCardItem(tweet, getDbUser(tweet.authorId))));
const replyCards = computed(() => props.replies.map((tweet) => toTweetCompactCardItem(tweet, getDbUser(tweet.authorId))));
</script>

<template>
  <template v-if="showParents && parentCards.length > 0">
    <div class="xd-context-label">Thread Above</div>
    <TweetCompactCard
      v-for="item in parentCards"
      :key="item.tweetId"
      :item="item"
      @select="(tweetId) => emit('open-tweet', tweetId)"
    />
    <div class="xd-context-divider"></div>
  </template>

  <TweetDetailCard
    :tweet="props.tweet"
    @open-user="(userId) => emit('open-user', userId)"
    @open-original="(tweet) => emit('open-original', tweet)"
    @open-media="(url) => emit('open-media', url)"
    @open-tweet="(tweetId) => emit('open-tweet', tweetId)"
  />

  <slot name="after-detail" :tweet="props.tweet" :replies="props.replies" />

  <template v-if="replyCards.length > 0">
    <div class="xd-context-divider"></div>
    <div class="xd-context-label">Replies</div>
    <TweetCompactCard
      v-for="item in replyCards"
      :key="item.tweetId"
      :item="item"
      @select="(tweetId) => emit('open-tweet', tweetId)"
    />
  </template>
</template>
