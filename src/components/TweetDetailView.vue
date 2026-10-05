<script setup lang="ts">
import { computed } from 'vue';
import type { Post } from '../archive/model';
import { getDbUser } from '../lib/db-service';
import { toTweetCompactCardItem } from '../lib/view-format';
import TweetDetailCard from './TweetDetailCard.vue';
import TweetCompactCard from './TweetCompactCard.vue';

const props = withDefaults(defineProps<{
  post: Post;
  parents?: Post[];
  replies?: Post[];
  showParents?: boolean;
}>(), {
  parents: () => [],
  replies: () => [],
  showParents: false,
});

const emit = defineEmits<{
  (e: 'open-user', userId: string): void;
  (e: 'open-original', post: Post): void;
  (e: 'open-media', url: string): void;
  (e: 'open-tweet', tweetId: string): void;
}>();

const parentCards = computed(() => props.parents.map((post) => toTweetCompactCardItem(post, getDbUser(post.authorId))));
const replyCards = computed(() => props.replies.map((post) => toTweetCompactCardItem(post, getDbUser(post.authorId))));
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
    :post="props.post"
    @open-user="(userId) => emit('open-user', userId)"
    @open-original="(post) => emit('open-original', post)"
    @open-media="(url) => emit('open-media', url)"
    @open-tweet="(tweetId) => emit('open-tweet', tweetId)"
  />

  <slot name="after-detail" :post="props.post" :replies="props.replies" />

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
