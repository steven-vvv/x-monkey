<script setup lang="ts">
import { computed } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbTweet, getDbUser, getMediaForTweet } from '../lib/db-service';
import { avatarFull, formatDateTime, toTweetStats } from '../lib/view-format';
import {
  getTweetDisplayText,
  getTweetDetailTextSegments,
  getTweetQuoteId,
  getTweetRepostId,
} from '../lib/tweet-selectors';
import StatGrid from './StatGrid.vue';
import MediaThumbGrid from './MediaThumbGrid.vue';

const props = defineProps<{ tweet: DbTweet }>();

const emit = defineEmits<{
  (e: 'open-user', userId: string): void;
  (e: 'open-original', tweet: DbTweet): void;
  (e: 'open-media', url: string): void;
  (e: 'open-tweet', tweetId: string): void;
}>();

const author = computed(() => getDbUser(props.tweet.authorId));
const textSegments = computed(() => getTweetDetailTextSegments(props.tweet));
const stats = computed(() => toTweetStats(props.tweet));
const media = computed(() => getMediaForTweet(props.tweet.id));
const quoteTweetId = computed(() => getTweetQuoteId(props.tweet));
const repostTweetId = computed(() => getTweetRepostId(props.tweet));
const quoteTweet = computed(() => quoteTweetId.value ? getDbTweet(quoteTweetId.value) ?? null : null);
const repostTweet = computed(() => repostTweetId.value ? getDbTweet(repostTweetId.value) ?? null : null);
const quoteAuthor = computed(() => quoteTweet.value ? getDbUser(quoteTweet.value.authorId) ?? null : null);
const repostAuthor = computed(() => repostTweet.value ? getDbUser(repostTweet.value.authorId) ?? null : null);
const verificationTag = computed(() => {
  const verification = author.value?.identity?.verification;
  const verificationType = verification?.type?.trim();

  if (verificationType && verificationType.toLowerCase() !== 'none') {
    return verificationType;
  }

  if (verification?.isBlueVerified) {
    return 'Blue';
  }

  return null;
});

const policyLines = computed(() => {
  const lines: string[] = [];

  if (props.tweet.policy?.paidPromotion) {
    lines.push('Paid Promotion');
  }
  if (props.tweet.policy?.replyPolicy) {
    lines.push(`Reply policy: ${props.tweet.policy.replyPolicy}`);
  }
  if (props.tweet.policy?.followersOnly) {
    lines.push('Followers-only conversation');
  }
  if (props.tweet.policy?.isPossiblySensitive) {
    lines.push('Marked as possibly sensitive');
  }
  if (props.tweet.policy?.limitedActions?.length) {
    lines.push(`Limited actions: ${props.tweet.policy.limitedActions.map((item) => item.action).join(', ')}`);
  }
  if (props.tweet.place?.fullName ?? props.tweet.place?.name) {
    lines.push(`Location: ${props.tweet.place?.fullName ?? props.tweet.place?.name}`);
  }

  return lines;
});
</script>

<template>
  <div class="xd-detail-card">
    <div class="xd-detail-head">
      <img
        v-if="author?.profile.avatarUrl"
        class="xd-detail-avatar"
        :src="avatarFull(author.profile.avatarUrl)"
        loading="lazy"
      />

      <div class="xd-detail-head-main">
        <div class="xd-detail-author xd-list-item--clickable" @click="emit('open-user', tweet.authorId)">
          <span class="xd-author-name">{{ author?.profile.displayName ?? '?' }}</span>
          <span class="xd-author-handle">@{{ author?.profile.userName ?? '?' }}</span>
          <span v-if="verificationTag" class="xd-detail-author-tag">{{ verificationTag }}</span>
        </div>

        <div class="xd-detail-meta">
          <span>{{ formatDateTime(tweet.createdAt) }}</span>
          <span v-if="tweet.source">{{ tweet.source }}</span>
        </div>
      </div>
    </div>

    <div v-if="textSegments.length > 0" class="xd-detail-text">
      <span
        v-for="(segment, index) in textSegments"
        :key="`${segment.kind}-${index}`"
        class="xd-detail-text-segment"
        :class="{
          'xd-detail-text-segment--emphasis': segment.emphasis,
          'xd-detail-text-segment--bold': segment.bold,
          'xd-detail-text-segment--italic': segment.italic,
          'xd-detail-text-segment--underline': segment.underline,
          'xd-detail-text-segment--strike': segment.strike,
        }"
      >{{ segment.text }}</span>
    </div>

    <div
      v-if="repostTweetId"
      class="xd-detail-ref xd-list-item--clickable"
      @click="emit('open-tweet', repostTweetId)"
    >
      <div class="xd-detail-ref-label">Repost</div>
      <div class="xd-detail-ref-text">
        <template v-if="repostTweet">
          {{ repostAuthor?.profile.displayName ?? '?' }} · {{ getTweetDisplayText(repostTweet) || '(no text)' }}
        </template>
        <template v-else>
          Tweet ID {{ repostTweetId }}
        </template>
      </div>
    </div>

    <div
      v-if="quoteTweetId"
      class="xd-detail-ref xd-list-item--clickable"
      @click="emit('open-tweet', quoteTweetId)"
    >
      <div class="xd-detail-ref-label">Quote</div>
      <div class="xd-detail-ref-text">
        <template v-if="quoteTweet">
          {{ quoteAuthor?.profile.displayName ?? '?' }} · {{ getTweetDisplayText(quoteTweet) || '(no text)' }}
        </template>
        <template v-else>
          Tweet ID {{ quoteTweetId }}
        </template>
      </div>
    </div>

    <MediaThumbGrid :media="media" @open="(url) => emit('open-media', url)" />

    <div v-if="policyLines.length > 0" class="xd-detail-lines">
      <div v-for="line in policyLines" :key="line" class="xd-detail-line">{{ line }}</div>
    </div>

    <div v-if="tweet.communityNote" class="xd-detail-lines">
      <div class="xd-detail-note-title">{{ tweet.communityNote.title ?? 'Community Note' }}</div>
      <div v-if="tweet.communityNote.subtitle?.text" class="xd-detail-line">{{ tweet.communityNote.subtitle.text }}</div>
      <div v-if="tweet.communityNote.footer?.text" class="xd-detail-line">{{ tweet.communityNote.footer.text }}</div>
    </div>

    <StatGrid :stats="stats" />

    <div class="xd-detail-actions">
      <button class="xd-btn xd-btn--accent" @click="emit('open-original', tweet)">Open Original</button>
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
