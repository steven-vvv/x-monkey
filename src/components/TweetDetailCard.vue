<script setup lang="ts">
import { computed } from 'vue';
import type { Post } from '../archive/model';
import { getDbMedia, getDbPost, getDbUser, getMediaForPost } from '../lib/db-service';
import { formatDateTime, toPollLines, toTweetStats } from '../lib/view-format';
import { formatUrlForDisplay, getAvatarUrl, getPlainText, getRichTextSegments } from '../lib/post-view';
import StatGrid from './StatGrid.vue';
import MediaThumbGrid from './MediaThumbGrid.vue';

const props = defineProps<{ post: Post }>();

const emit = defineEmits<{
  (e: 'open-user', userId: string): void;
  (e: 'open-original', post: Post): void;
  (e: 'open-media', url: string): void;
  (e: 'open-tweet', postId: string): void;
}>();

const author = computed(() => getDbUser(props.post.authorId));
const avatarUrl = computed(() => author.value ? getAvatarUrl(author.value) : undefined);
const textSegments = computed(() => props.post.text ? getRichTextSegments(props.post.text) : []);
const stats = computed(() => toTweetStats(props.post.counts));
const media = computed(() => getMediaForPost(props.post));
const quotePostId = computed(() => props.post.quote?.postId);
const quotePost = computed(() => quotePostId.value ? getDbPost(quotePostId.value) ?? null : null);
const quoteAuthor = computed(() => quotePost.value ? getDbUser(quotePost.value.authorId) ?? null : null);
const verificationTag = computed(() => {
  const verified = author.value?.verified;
  return verified?.type ?? (verified?.blue ? 'Blue' : null);
});

// Only cards with something to show; unsupported types keep their raw values in `extra`.
const card = computed(() => {
  const value = props.post.card;
  return value && (value.title || value.image || value.player || value.poll) ? value : undefined;
});
const pollLines = computed(() => card.value?.poll ? toPollLines(card.value.poll) : []);
const article = computed(() => props.post.article);
const articleCover = computed(() => article.value?.coverMediaId ? getDbMedia(article.value.coverMediaId) : undefined);
const articleText = computed(() => {
  const blocks = article.value?.blocks;
  if (!blocks) return article.value?.preview ?? '';
  return blocks.filter((block) => block.type !== 'atomic').map((block) => block.text).join('\n');
});

const policyLines = computed(() => {
  const post = props.post;
  const lines: string[] = [];
  if (post.paidPromotion) lines.push('Paid promotion');
  if (post.aiGenerated) {
    lines.push(post.aiGenerated.media
      ? `AI-generated media (${post.aiGenerated.source})`
      : `No AI-generated media (${post.aiGenerated.source})`);
  }
  if (post.replyPolicy) lines.push(`Reply policy: ${post.replyPolicy}`);
  if (post.sensitive) lines.push('Marked as possibly sensitive');
  if (post.editIds) lines.push(`Edited: ${post.editIds.length} versions`);
  if (post.place) lines.push(`Location: ${post.place.fullName ?? post.place.name ?? post.place.id}`);
  return lines;
});
</script>

<template>
  <div class="xd-detail-card">
    <div class="xd-detail-head">
      <img v-if="avatarUrl" class="xd-detail-avatar" :src="avatarUrl" loading="lazy" />

      <div class="xd-detail-head-main">
        <div class="xd-detail-author xd-list-item--clickable" @click="emit('open-user', post.authorId)">
          <span class="xd-author-name">{{ author?.name ?? '?' }}</span>
          <span class="xd-author-handle">@{{ author?.handle ?? '?' }}</span>
          <span v-if="verificationTag" class="xd-detail-author-tag">{{ verificationTag }}</span>
        </div>

        <div class="xd-detail-meta">
          <span>{{ formatDateTime(post.createdAt) }}</span>
          <span v-if="post.source">{{ post.source }}</span>
        </div>
      </div>
    </div>

    <div v-if="textSegments.length > 0" class="xd-detail-text">
      <span
        v-for="(segment, index) in textSegments"
        :key="`${segment.kind}-${index}`"
        class="xd-detail-text-segment"
        :class="{
          'xd-detail-text-segment--emphasis': segment.kind !== 'plain',
          'xd-detail-text-segment--bold': segment.bold,
          'xd-detail-text-segment--italic': segment.italic,
          'xd-detail-text-segment--underline': segment.underline,
          'xd-detail-text-segment--strike': segment.strike,
        }"
        :title="segment.href"
      >{{ segment.text }}</span>
    </div>

    <div v-if="article" class="xd-detail-ref">
      <div class="xd-detail-ref-label">Article{{ article.blocks ? '' : ' (preview)' }}</div>
      <img v-if="articleCover" class="xd-detail-ref-image" :src="articleCover.url" loading="lazy" />
      <div class="xd-detail-ref-title">{{ article.title }}</div>
      <div v-if="articleText" class="xd-detail-ref-text xd-detail-ref-text--clamped">{{ articleText }}</div>
    </div>

    <div v-if="card" class="xd-detail-ref">
      <div class="xd-detail-ref-label">{{ card.poll ? 'Poll' : (card.domain ?? card.type) }}</div>
      <template v-if="card.poll">
        <div v-for="(line, index) in pollLines" :key="index" class="xd-detail-ref-text">{{ line }}</div>
        <div v-if="card.poll.endsAt" class="xd-detail-line">{{ card.poll.final ? 'Ended' : 'Ends' }} {{ formatDateTime(card.poll.endsAt) }}</div>
      </template>
      <img v-if="card.image" class="xd-detail-ref-image" :src="card.image.url" :alt="card.image.alt" loading="lazy" />
      <div v-if="card.title" class="xd-detail-ref-title">{{ card.title }}</div>
      <div v-if="card.description" class="xd-detail-ref-text">{{ card.description }}</div>
      <div v-if="card.player" class="xd-detail-line">{{ formatUrlForDisplay(card.player.url) }}</div>
    </div>

    <div
      v-if="quotePostId"
      class="xd-detail-ref xd-list-item--clickable"
      @click="emit('open-tweet', quotePostId)"
    >
      <div class="xd-detail-ref-label">Quote</div>
      <div class="xd-detail-ref-text xd-detail-ref-text--clamped">
        <template v-if="quotePost">
          {{ quoteAuthor?.name ?? '?' }} · {{ getPlainText(quotePost.text) || quotePost.article?.title || '(no text)' }}
        </template>
        <template v-else>
          {{ post.quote?.url ?? `Post ID ${quotePostId}` }}
        </template>
      </div>
    </div>

    <MediaThumbGrid :media="media" @open="(url) => emit('open-media', url)" />

    <div v-if="policyLines.length > 0" class="xd-detail-lines">
      <div v-for="line in policyLines" :key="line" class="xd-detail-line">{{ line }}</div>
    </div>

    <div v-if="post.communityNote" class="xd-detail-lines">
      <div class="xd-detail-note-title">{{ post.communityNote.title ?? 'Community Note' }}</div>
      <div class="xd-detail-line">{{ getPlainText(post.communityNote.text) }}</div>
    </div>

    <StatGrid :stats="stats" />

    <div class="xd-detail-actions">
      <button class="xd-btn xd-btn--accent" @click="emit('open-original', post)">Open Original</button>
    </div>
  </div>
</template>

<style scoped>
.xd-detail-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.xd-detail-head {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.xd-detail-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--xd-border);
  object-fit: cover;
  background: var(--xd-bg-secondary);
}

.xd-detail-head-main {
  min-width: 0;
}

.xd-detail-author {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.xd-detail-author-tag {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid var(--xd-border);
  background: var(--xd-bg-secondary);
  color: var(--xd-text-secondary);
  font-size: 9px;
  line-height: 1;
}

.xd-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  color: var(--xd-text-muted);
  font-size: 10px;
}

.xd-detail-text {
  font-size: 12px;
  color: var(--xd-text-primary);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.xd-detail-text-segment--emphasis {
  color: var(--xd-accent);
}

.xd-detail-text-segment--bold {
  font-weight: 700;
}

.xd-detail-text-segment--italic {
  font-style: italic;
}

.xd-detail-text-segment--underline {
  text-decoration: underline;
}

.xd-detail-text-segment--strike {
  text-decoration: line-through;
}

.xd-detail-text-segment--underline.xd-detail-text-segment--strike {
  text-decoration: underline line-through;
}

.xd-detail-ref {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border-radius: var(--xd-radius);
  background: var(--xd-bg-secondary);
  border: 1px solid var(--xd-border);
}

.xd-detail-ref-label {
  font-size: 10px;
  color: var(--xd-text-muted);
  text-transform: uppercase;
}

.xd-detail-ref-text {
  font-size: 11px;
  color: var(--xd-text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.xd-detail-ref-text--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
}

.xd-detail-ref-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--xd-text-primary);
  line-height: 1.4;
}

.xd-detail-ref-image {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: var(--xd-radius);
}

.xd-detail-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.xd-detail-note-title {
  font-size: 10px;
  color: var(--xd-text-secondary);
  text-transform: uppercase;
}

.xd-detail-line {
  font-size: 11px;
  color: var(--xd-text-secondary);
  line-height: 1.4;
  word-break: break-word;
}
</style>
