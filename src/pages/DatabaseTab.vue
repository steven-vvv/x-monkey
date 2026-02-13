<script setup lang="ts">
import { computed } from 'vue';
import { dbRoute, dbNavigateTo } from '../lib/store';
import {
  getAllTweets, getDbTweet, getDbUser,
  clearDb, dbVersion,
} from '../lib/db-service';
import type { DbTweet } from '../lib/db-service';
import { useShadowStyle } from '../lib/use-shadow-style';
import { GM_openInTab } from '$';
import TweetSummaryItem from '../components/TweetSummaryItem.vue';
import TweetDetailCard from '../components/TweetDetailCard.vue';
import UserDetailCard from '../components/UserDetailCard.vue';

const route = dbRoute;

const tweetList = computed(() => {
  void dbVersion.value;
  return getAllTweets().sort((a, b) => b._ts - a._ts);
});

function openTweet(id: string) {
  dbNavigateTo({ page: 'tweet', tweetId: id });
}

function openUser(id: string) {
  dbNavigateTo({ page: 'user', userId: id });
}

function openOriginal(t: DbTweet) {
  const u = getDbUser(t.authorId);
  if (u) GM_openInTab(`https://x.com/${u.screenName}/status/${t.id}`, { active: true });
}

function openMediaUrl(url: string) {
  GM_openInTab(url, { active: true });
}

function openProfile(userId: string) {
  const u = getDbUser(userId);
  if (u) GM_openInTab(`https://x.com/${u.screenName}`, { active: true });
}

// Detail tweet computeds
const detailTweet = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'tweet') return getDbTweet(route.value.tweetId) ?? null;
  return null;
});

// User detail computeds
const detailUser = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user') return getDbUser(route.value.userId) ?? null;
  return null;
});

const STYLE_TEXT = ``;

useShadowStyle('database-tab', STYLE_TEXT);
</script>

<template>
  <div class="xd-tab-wrapper">
    <div class="xd-body">
      <!-- List page -->
      <template v-if="route.page === 'list'">
        <div v-if="tweetList.length === 0" class="xd-empty">Database is empty</div>
        <TweetSummaryItem
          v-for="item in tweetList"
          :key="item.id"
          :tweet="item"
          show-focal-dot
          @select="openTweet"
        />
      </template>

      <!-- Tweet detail -->
      <template v-else-if="route.page === 'tweet'">
        <div v-if="!detailTweet" class="xd-empty">Tweet not found</div>
        <template v-else>
          <TweetDetailCard
            :tweet="detailTweet"
            @open-user="openUser"
            @open-original="openOriginal"
            @open-media="openMediaUrl"
          />
        </template>
      </template>

      <!-- User detail -->
      <template v-else-if="route.page === 'user'">
        <div v-if="!detailUser" class="xd-empty">User not found</div>
        <template v-else>
          <UserDetailCard :user="detailUser" @open-profile="openProfile" />
        </template>
      </template>
    </div>

    <div class="xd-tab-actions">
      <span class="xd-tab-meta">{{ tweetList.length }} tweets</span>
      <button class="xd-btn xd-btn--sm xd-btn--error" @click="clearDb">Clear</button>
    </div>
  </div>
</template>
