<script setup lang="ts">
// One-line list row (thread context, replies, captured list). `post`, `author`, `media`, `syncStatus`; emits select.
import { computed } from 'vue';
import type { Media, Post, User } from '../../archive/model';
import type { RemoteRecordStatus } from '../../lib/remote-db';
import { getAvatarUrl, getPlainText } from '../../lib/post-view';
import { formatPostTime } from '../labels';
import XmAvatar from './XmAvatar.vue';
import XmIcon from './XmIcon.vue';

const props = defineProps<{
  post: Post;
  author?: User;
  media?: Media[];
  syncStatus?: RemoteRecordStatus;
}>();

const emit = defineEmits<{ (e: 'select'): void }>();

const text = computed(() => getPlainText(props.post.text) || props.post.article?.title || '');
const name = computed(() => props.author?.name ?? '?');
const handle = computed(() => props.author?.handle ?? '?');
const time = computed(() => formatPostTime(props.post.createdAt));
const mediaCount = computed(() => props.media?.length ?? props.post.mediaIds?.length ?? 0);
const hasVideo = computed(() => (props.media ?? []).some((item) => item.type === 'video'));
const ariaLabel = computed(() => `${name.value} @${handle.value} ${time.value}：${text.value || '无正文'}`.slice(0, 120));

function onKey(event: KeyboardEvent): void {
  event.preventDefault();
  emit('select');
}
</script>

<template>
  <div class="xm-row" role="button" tabindex="0" :aria-label="ariaLabel" @click="emit('select')" @keydown.enter="onKey" @keydown.space="onKey">
    <XmAvatar size="sm" :url="author ? getAvatarUrl(author) : undefined" :name="author?.name" :sync-status="syncStatus" />
    <div class="xm-row__main">
      <div class="xm-row__head">
        <span class="xm-name" :title="name">{{ name }}</span>
        <span class="xm-handle" :title="'@' + handle">@{{ handle }}</span>
        <span class="xm-dot">·</span>
        <span class="xm-time">{{ time }}</span>
      </div>
      <div class="xm-row__text" :class="{ 'xm-post__text--muted': !text }">{{ text || '（无正文）' }}</div>
    </div>
    <span v-if="mediaCount > 0" class="xm-row__chip"><XmIcon :name="hasVideo ? 'play' : 'image'" />{{ mediaCount }}</span>
  </div>
</template>
