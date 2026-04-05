<script setup lang="ts">
import { computed } from 'vue';
import type { DbUserRecord } from '../lib/types';
import { avatarFull, toUserStats } from '../lib/view-format';
import { getUserBioText } from '../lib/tweet-selectors';
import StatGrid from './StatGrid.vue';

const props = defineProps<{ user: DbUserRecord }>();

const emit = defineEmits<{
  (e: 'open-profile', userId: string): void;
}>();

const stats = computed(() => toUserStats(props.user));
const bio = computed(() => getUserBioText(props.user));
const labels = computed(() => [
  props.user.identity?.verification?.type,
  props.user.identity?.accountLabel?.text,
  props.user.identity?.parodyLabel,
  props.user.features?.canBeSubscribed ? 'Subscriptions' : null,
].filter(Boolean) as string[]);
</script>

<template>
  <div v-if="user.profile.bannerUrl" class="xd-user-banner">
    <img :src="user.profile.bannerUrl + '/600x200'" loading="lazy" />
  </div>

  <div class="xd-user-card-head">
    <img
      v-if="user.profile.avatarUrl"
      class="xd-user-avatar"
      :src="avatarFull(user.profile.avatarUrl)"
      loading="lazy"
    />
    <div class="xd-user-card-main">
      <div class="xd-author-name">{{ user.displayName }}</div>
      <div class="xd-author-handle">@{{ user.userName }}</div>
      <div v-if="labels.length > 0" class="xd-user-labels">
        <span v-for="label in labels" :key="label" class="xd-user-label">{{ label }}</span>
      </div>
    </div>
  </div>

  <div v-if="bio" class="xd-user-bio">{{ bio }}</div>

  <div v-if="user.profile.location || user.profile.profileLinks.length > 0" class="xd-user-meta">
    <div v-if="user.profile.location" class="xd-user-meta-row">{{ user.profile.location }}</div>
    <div v-for="link in user.profile.profileLinks" :key="link.url" class="xd-user-meta-row xd-text-ellipsis">{{ link.expandedUrl }}</div>
  </div>

  <StatGrid :stats="stats" />

  <div class="xd-detail-actions">
    <button class="xd-btn xd-btn--accent" @click="emit('open-profile', user.id)">Open Profile</button>
  </div>
</template>

<style scoped>
.xd-user-banner {
  border-radius: var(--xd-radius);
  overflow: hidden;
  margin-bottom: 10px;
  border: 1px solid var(--xd-border);
}

.xd-user-banner img {
  width: 100%;
  height: auto;
  display: block;
}

.xd-user-card-head {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.xd-user-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid var(--xd-border);
  object-fit: cover;
  background: var(--xd-bg-secondary);
}

.xd-user-card-main {
  min-width: 0;
}

.xd-user-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.xd-user-label {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--xd-bg-secondary);
  color: var(--xd-text-secondary);
  font-size: 9px;
}

.xd-user-bio {
  font-size: 11px;
  color: var(--xd-text-secondary);
  line-height: 1.45;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.xd-user-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.xd-user-meta-row {
  font-size: 10px;
  color: var(--xd-text-muted);
}
</style>
