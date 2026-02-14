<script setup lang="ts">
import { computed } from 'vue';
import type { XTweet, XMedia } from '../lib/types';
import type { XUser } from '../lib/types';
import { tweetText } from '../lib/view-format';
import { useShadowStyle } from '../lib/use-shadow-style';

const props = defineProps<{
  tweet: XTweet;
  author: XUser | undefined;
  media: XMedia[];
}>();

const emit = defineEmits<{
  (e: 'select', tweetId: string): void;
}>();

const text = computed(() => tweetText(props.tweet));

const STYLE_TEXT = `
.xd-media-card {
  padding: 8px;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-secondary);
  margin-bottom: 6px;
  cursor: pointer;
}

.xd-media-card:hover {
  border-color: var(--xd-accent);
}

.xd-media-card:last-child {
  margin-bottom: 0;
}

.xd-media-card-text {
  font-size: 11px;
  color: var(--xd-text-secondary);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 4px 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.xd-media-card-thumbs {
  display: flex;
  gap: 4px;
}

.xd-media-card-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: var(--xd-radius);
  overflow: hidden;
  border: 1px solid var(--xd-border);
  flex-shrink: 0;
}

.xd-media-card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.xd-media-card-thumb-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  padding: 1px 3px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 8px;
  font-weight: 600;
}

.xd-media-card-empty {
  font-size: 10px;
  color: var(--xd-text-muted);
  font-style: italic;
}
`;

useShadowStyle('user-media-card', STYLE_TEXT);
</script>

<template>
  <div class="xd-media-card" @click="emit('select', tweet.id)">
    <div class="xd-list-item-title">
      <span class="xd-author-name">{{ author?.name ?? '?' }}</span>
      <span class="xd-author-handle">@{{ author?.screenName ?? '?' }}</span>
    </div>

    <div v-if="text" class="xd-media-card-text">{{ text }}</div>

    <div v-if="media.length > 0" class="xd-media-card-thumbs">
      <div
        v-for="m in media"
        :key="m.id"
        class="xd-media-card-thumb"
      >
        <img :src="m.thumbUrl" loading="lazy" />
        <span v-if="m.type !== 'photo'" class="xd-media-card-thumb-badge">{{ m.type === 'video' ? 'VID' : 'GIF' }}</span>
      </div>
    </div>
    <div v-else class="xd-media-card-empty">No media</div>
  </div>
</template>
