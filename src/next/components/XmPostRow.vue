<script setup lang="ts">
// Timeline row. `post` = displayed post (original for reposts); `author`; `media`; `repostedBy` (user who reposted);
// `syncStatus`; `selecting` shows the checkbox column and `selected` its state. Emits select (row click / Enter / Space)
// and open-media(url) (media cell click). Slot `head-extra`: extra inline content after the time (e.g. the repeat chip).
import { computed } from 'vue';
import type { Media, Post, User } from '../../archive/model';
import type { RemoteRecordStatus } from '../../lib/remote-db';
import { getAvatarUrl, getPlainText } from '../../lib/post-view';
import { formatCount, formatPostTime } from '../labels';
import XmAvatar from './XmAvatar.vue';
import XmCheck from './XmCheck.vue';
import XmIcon from './XmIcon.vue';
import XmMediaStrip from './XmMediaStrip.vue';
import type { IconName } from '../icons';

const props = defineProps<{
  post: Post;
  author?: User;
  media: Media[];
  repostedBy?: User;
  syncStatus?: RemoteRecordStatus;
  selecting?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'open-media', url: string): void;
}>();

const text = computed(() => getPlainText(props.post.text) || props.post.article?.title || '');
const time = computed(() => formatPostTime(props.post.createdAt));
const avatarUrl = computed(() => (props.author ? getAvatarUrl(props.author) : undefined));
const name = computed(() => props.author?.name ?? '?');
const handle = computed(() => props.author?.handle ?? '?');

const metrics = computed(() => {
  const counts = props.post.counts;
  const all: { icon: IconName; value: number | undefined; opt?: boolean; label: string }[] = [
    { icon: 'reply', value: counts?.replies, label: '回复' },
    { icon: 'repost', value: counts?.reposts, label: '转帖' },
    { icon: 'heart', value: counts?.likes, label: '喜欢' },
    { icon: 'views', value: counts?.views, opt: true, label: '浏览' },
  ];
  return all.filter((metric) => metric.value !== undefined);
});

const ariaLabel = computed(() => `${name.value} @${handle.value} ${time.value}${text.value ? '：' + text.value.slice(0, 80) : ''}`);

function onKey(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) return;
  event.preventDefault();
  emit('select');
}
</script>

<template>
  <div
    class="xm-post"
    :class="{ 'xm-post--selected': selected }"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-pressed="selecting ? !!selected : undefined"
    @click="emit('select')"
    @keydown.enter="onKey"
    @keydown.space="onKey"
  >
    <div class="xm-post__lead">
      <XmCheck v-if="selecting" :on="selected" />
      <XmAvatar :url="avatarUrl" :name="author?.name" :sync-status="syncStatus" />
    </div>
    <div class="xm-post__main">
      <div v-if="repostedBy" class="xm-post__context"><XmIcon name="repost" class="xm-ico--sm" />@{{ repostedBy.handle }} 转帖了</div>
      <div class="xm-post__head">
        <span class="xm-name" :title="name">{{ name }}</span>
        <span class="xm-handle" :title="'@' + handle">@{{ handle }}</span>
        <span class="xm-dot">·</span>
        <span class="xm-time">{{ time }}</span>
        <slot name="head-extra" />
      </div>
      <div v-if="text" class="xm-post__text">{{ text }}</div>
      <XmMediaStrip :media="media" :post="post" @open-media="emit('open-media', $event)" />
      <div v-if="metrics.length > 0" class="xm-metrics">
        <span v-for="metric in metrics" :key="metric.icon" class="xm-metric" :class="{ 'xm-metric--opt': metric.opt }" :title="metric.label">
          <XmIcon :name="metric.icon" />{{ formatCount(metric.value!) }}
        </span>
      </div>
    </div>
  </div>
</template>
