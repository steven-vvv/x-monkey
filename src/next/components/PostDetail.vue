<script setup lang="ts">
// Post detail body (status page, opened-from-list tweets, captured tab). Renders inside the caller's `xm-body`.
// Props: post (focal), parents (thread above, shown only with showParents), replies, batchSyncPosts (for "同步全部").
// Emits open-tweet(id), open-user(id), open-media(url).
import { computed, ref, watch } from 'vue';
import type { Post } from '../../archive/model';
import { dbVersion, getDbMedia, getDbPost, getDbUser, getMediaForPost, getRemoteSyncStatus } from '../../lib/db-service';
import { formatUrlForDisplay, getAvatarUrl, getPlainText } from '../../lib/post-view';
import { isRemoteDbReady } from '../../lib/remote-db';
import { formatDateTime } from '../../lib/view-format';
import { buildPostNotices, toPostStats, verifiedBadge } from '../labels';
import ArchivePanel from './ArchivePanel.vue';
import XmAvatar from './XmAvatar.vue';
import XmCompactRow from './XmCompactRow.vue';
import XmIcon from './XmIcon.vue';
import XmMediaGrid from './XmMediaGrid.vue';
import XmPoll from './XmPoll.vue';
import XmRichText from './XmRichText.vue';
import XmStats from './XmStats.vue';

const props = defineProps<{
  post: Post;
  parents?: Post[];
  replies?: Post[];
  showParents?: boolean;
  batchSyncPosts?: Post[];
}>();

const emit = defineEmits<{
  (e: 'open-tweet', id: string): void;
  (e: 'open-user', id: string): void;
  (e: 'open-media', url: string): void;
}>();

const parentsOpen = ref(true);
watch(() => props.post.id, () => { parentsOpen.value = true; archivePinned.value = false; });

const author = computed(() => { void dbVersion.value; return getDbUser(props.post.authorId); });
const badge = computed(() => verifiedBadge(author.value));
const media = computed(() => { void dbVersion.value; return getMediaForPost(props.post); });
const notices = computed(() => buildPostNotices(props.post));
const stats = computed(() => toPostStats(props.post.counts));
const syncStatus = computed(() => getRemoteSyncStatus(props.post.id));
const remoteReady = computed(() => isRemoteDbReady());
/** Keeps the archive card (and its result banner) mounted after a 401 turns the remote session off. */
const archivePinned = ref(false);

const quoteId = computed(() => props.post.quote?.postId);
const quotePost = computed(() => { void dbVersion.value; return quoteId.value ? getDbPost(quoteId.value) : undefined; });
const quoteAuthor = computed(() => (quotePost.value ? getDbUser(quotePost.value.authorId) : undefined));
const quoteFallback = computed(() => props.post.quote?.tombstone ?? props.post.quote?.url ?? `帖子 ID ${quoteId.value}`);

// Only cards with something to show; unsupported types keep their raw values in `extra`.
const card = computed(() => {
  const value = props.post.card;
  return value && (value.title || value.image || value.player || value.poll) ? value : undefined;
});
const article = computed(() => props.post.article);
const articleCover = computed(() => { void dbVersion.value; return article.value?.coverMediaId ? getDbMedia(article.value.coverMediaId) : undefined; });
const articleText = computed(() => {
  const blocks = article.value?.blocks;
  if (!blocks) return article.value?.preview ?? '';
  return blocks.filter((block) => block.type !== 'atomic').map((block) => block.text).join('\n');
});

const noteTitle = computed(() => props.post.communityNote?.title ?? '读者补充了背景信息');

function rowAuthor(item: Post) {
  return getDbUser(item.authorId);
}

function onKey(event: KeyboardEvent, action: () => void): void {
  event.preventDefault();
  action();
}
</script>

<template>
  <template v-if="showParents && parents && parents.length > 0">
    <div
      class="xm-section-title xm-section-title--toggle"
      role="button" tabindex="0" :aria-expanded="parentsOpen" data-role="toggle-parents"
      @click="parentsOpen = !parentsOpen"
      @keydown.enter="onKey($event, () => (parentsOpen = !parentsOpen))"
      @keydown.space="onKey($event, () => (parentsOpen = !parentsOpen))"
    >
      <XmIcon name="chev-d" class="xm-ico--sm xm-chev" :class="{ 'xm-chev--closed': !parentsOpen }" />上文 <span class="xm-num">{{ parents.length }}</span>
    </div>
    <div v-if="parentsOpen" class="xm-thread">
      <XmCompactRow
        v-for="item in parents"
        :key="item.id"
        :post="item"
        :author="rowAuthor(item)"
        :media="getMediaForPost(item)"
        :sync-status="getRemoteSyncStatus(item.id)"
        @select="emit('open-tweet', item.id)"
      />
    </div>
  </template>

  <div class="xm-detail">
    <div class="xm-detail__author">
      <XmAvatar size="md" :url="author ? getAvatarUrl(author) : undefined" :name="author?.name" :sync-status="syncStatus" />
      <div
        class="xm-detail__who" role="button" tabindex="0" :aria-label="`查看用户 ${author?.name ?? ''} @${author?.handle ?? ''}`"
        data-role="author"
        @click="emit('open-user', post.authorId)"
        @keydown.enter="onKey($event, () => emit('open-user', post.authorId))"
        @keydown.space="onKey($event, () => emit('open-user', post.authorId))"
      >
        <div class="xm-detail__name">
          <span class="xm-name" :title="author?.name">{{ author?.name ?? '?' }}</span>
          <span v-if="badge" class="xm-badge"><XmIcon name="verified" />{{ badge }}</span>
        </div>
        <div class="xm-detail__handle" :title="'@' + (author?.handle ?? '?')">@{{ author?.handle ?? '?' }}</div>
      </div>
    </div>

    <div v-if="post.text && post.text.text" class="xm-detail__text"><XmRichText :text="post.text" /></div>

    <div v-if="article" class="xm-embed">
      <div class="xm-embed__label"><XmIcon name="article" class="xm-ico--sm" />{{ article.blocks ? '文章' : '文章（预览）' }}</div>
      <img v-if="articleCover" class="xm-embed__img" :src="articleCover.url" alt="" loading="lazy" />
      <div class="xm-embed__title">{{ article.title }}</div>
      <div v-if="articleText" class="xm-embed__text">{{ articleText }}</div>
    </div>

    <div v-if="card" class="xm-embed">
      <div class="xm-embed__label">
        <XmIcon :name="card.poll ? 'poll' : 'link'" class="xm-ico--sm" />{{ card.poll ? '投票' : (card.domain ?? card.type) }}
      </div>
      <XmPoll v-if="card.poll" :poll="card.poll" />
      <img v-if="card.image" class="xm-embed__img" :src="card.image.url" :alt="card.image.alt ?? ''" loading="lazy" />
      <div v-if="card.title" class="xm-embed__title">{{ card.title }}</div>
      <div v-if="card.description" class="xm-embed__text">{{ card.description }}</div>
      <div v-if="card.player" class="xm-embed__text">{{ formatUrlForDisplay(card.player.url) }}</div>
    </div>

    <div
      v-if="quoteId"
      class="xm-embed"
      :class="{ 'xm-embed--click': quotePost }"
      :role="quotePost ? 'button' : undefined"
      :tabindex="quotePost ? 0 : undefined"
      data-role="quote"
      @click="quotePost && emit('open-tweet', quoteId)"
      @keydown.enter="quotePost && onKey($event, () => emit('open-tweet', quoteId!))"
      @keydown.space="quotePost && onKey($event, () => emit('open-tweet', quoteId!))"
    >
      <div class="xm-embed__label"><XmIcon name="quote" class="xm-ico--sm" />引用</div>
      <template v-if="quotePost">
        <div class="xm-row__head">
          <span class="xm-name" :title="quoteAuthor?.name">{{ quoteAuthor?.name ?? '?' }}</span>
          <span class="xm-handle" :title="'@' + (quoteAuthor?.handle ?? '?')">@{{ quoteAuthor?.handle ?? '?' }}</span>
        </div>
        <div class="xm-embed__text">{{ getPlainText(quotePost.text) || quotePost.article?.title || '（无正文）' }}</div>
      </template>
      <div v-else class="xm-embed__text">{{ quoteFallback }}</div>
    </div>

    <XmMediaGrid :media="media" :post="post" @open-media="(url) => emit('open-media', url)" />

    <div class="xm-detail__meta">
      <span>{{ formatDateTime(post.createdAt) }}</span>
      <template v-if="post.source"><span>·</span><span>{{ post.source }}</span></template>
    </div>

    <div v-if="notices.length > 0" class="xm-notices">
      <div v-for="notice in notices" :key="notice.text" class="xm-notice" :class="{ 'xm-notice--warn': notice.warn }">
        <XmIcon :name="notice.icon" />{{ notice.text }}
      </div>
    </div>

    <div v-if="post.communityNote" class="xm-note">
      <div class="xm-note__title"><XmIcon name="note" class="xm-ico--sm" />{{ noteTitle }}</div>
      <div class="xm-note__text"><XmRichText :text="post.communityNote.text" /></div>
    </div>

    <XmStats :items="stats" />

    <ArchivePanel v-if="remoteReady || archivePinned" :post="post" :batch-sync-posts="batchSyncPosts" @pin="archivePinned = $event" />
  </div>

  <template v-if="replies && replies.length > 0">
    <div class="xm-section-title">回复 <span class="xm-num">{{ replies.length }}</span></div>
    <XmCompactRow
      v-for="item in replies"
      :key="item.id"
      :post="item"
      :author="rowAuthor(item)"
      :media="getMediaForPost(item)"
      :sync-status="getRemoteSyncStatus(item.id)"
      @select="emit('open-tweet', item.id)"
    />
  </template>
</template>

<style scoped>
.xm-chev { transition: transform var(--xm-t); }
.xm-chev--closed { transform: rotate(-90deg); }
</style>
