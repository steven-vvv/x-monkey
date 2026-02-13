<script setup lang="ts">
import { computed } from 'vue';
import type { DbUser } from '../lib/db-service';
import { avatarFull, toUserStats } from '../lib/view-format';
import { useShadowStyle } from '../lib/use-shadow-style';
import StatGrid from './StatGrid.vue';

const props = defineProps<{ user: DbUser }>();

const emit = defineEmits<{
  (e: 'open-profile', userId: string): void;
}>();

const stats = computed(() => toUserStats(props.user));

const STYLE_TEXT = `
.xd-user-banner {
  border-radius: var(--xd-radius);
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid var(--xd-border);
}

.xd-user-banner img {
  width: 100%;
  height: auto;
  display: block;
}

.xd-user-avatar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.xd-user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--xd-border);
  flex-shrink: 0;
}

.xd-user-names {
  min-width: 0;
}

.xd-user-bio {
  font-size: 11px;
  color: var(--xd-text-secondary);
  line-height: 1.4;
  margin-bottom: 6px;
  word-break: break-word;
}

.xd-user-location {
  font-size: 10px;
  color: var(--xd-text-muted);
  margin-bottom: 8px;
}

.xd-detail-actions {
  padding: 4px 0;
}
`;

useShadowStyle('user-detail-card', STYLE_TEXT);
</script>

<template>
  <div v-if="user.bannerUrl" class="xd-user-banner">
    <img :src="user.bannerUrl + '/600x200'" loading="lazy" />
  </div>
  <div class="xd-user-avatar-row">
    <img class="xd-user-avatar" :src="avatarFull(user.avatarUrl)" loading="lazy" />
    <div class="xd-user-names">
      <div class="xd-author-name">{{ user.name }}</div>
      <div class="xd-author-handle">@{{ user.screenName }}</div>
    </div>
  </div>
  <div v-if="user.description" class="xd-user-bio">{{ user.description }}</div>
  <div v-if="user.location" class="xd-user-location">{{ user.location }}</div>

  <StatGrid :stats="stats" />

  <div class="xd-detail-actions">
    <button class="xd-btn xd-btn--accent" @click="emit('open-profile', user.id)">Open Profile</button>
  </div>
</template>
