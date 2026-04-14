<script setup lang="ts">
import { computed } from 'vue';
import { dbRoute, dbNavigateTo } from '../lib/store';
import {
  getAllTweets, getDbTweet, getDbUser, getReplies,
  dbVersion,
} from '../lib/db-service';
import { clearCaptureState } from '../lib/capture-state-service';
import type { DbTweet } from '../lib/db-service';
import { GM_openInTab } from '$';
import { getTweetOpenUrl, getUserOpenUrl } from '../lib/tweet-selectors';
import { toTweetCompactCardItem } from '../lib/view-format';
import TweetCompactCard from '../components/TweetCompactCard.vue';
import TweetDetailView from '../components/TweetDetailView.vue';
import UserDetailCard from '../components/UserDetailCard.vue';
import RemoteDbTweetPanel from '../components/RemoteDbTweetPanel.vue';
import { isRemoteDbTweetApiReady } from '../lib/remote-db';

const route = dbRoute;

const tweetListCards = computed(() => {
  void dbVersion.value;
  return getAllTweets()
    .sort((a, b) => b._ts - a._ts)
    .map((tweet) => toTweetCompactCardItem(tweet, getDbUser(tweet.authorId)));
});

function openTweet(id: string) {
  dbNavigateTo({ page: 'tweet', tweetId: id });
}

function openUser(id: string) {
  dbNavigateTo({ page: 'user', userId: id });
}

function openOriginal(t: DbTweet) {
  const u = getDbUser(t.authorId);
  const url = getTweetOpenUrl(t, u);
  if (url) GM_openInTab(url, { active: true });
}

function openMediaUrl(url: string) {
  GM_openInTab(url, { active: true });
}

function openProfile(userId: string) {
  const u = getDbUser(userId);
  if (u) GM_openInTab(getUserOpenUrl(u), { active: true });
}

// Detail tweet computeds
const detailTweet = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'tweet') return getDbTweet(route.value.tweetId) ?? null;
  return null;
});

const detailReplies = computed(() => {
  void dbVersion.value;
  if (!detailTweet.value) return [];
  return getReplies(detailTweet.value.id);
});

const detailRemoteSyncTweets = computed(() => {
  if (!detailTweet.value) return [];
  return [detailTweet.value, ...detailReplies.value];
});

// User detail computeds
const detailUser = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user') return getDbUser(route.value.userId) ?? null;
  return null;
});

const shouldShowRemoteDbPanel = computed(() => {
  return isRemoteDbTweetApiReady();
});
</script>

<template>
  <div class="xd-tab-wrapper">
    <div class="xd-body">
      <!-- List page -->
      <template v-if="route.page === 'list'">
        <div v-if="tweetListCards.length === 0" class="xd-empty">Database is empty</div>
        <TweetCompactCard
          v-for="item in tweetListCards"
          :key="item.tweetId"
          :item="item"
          @select="openTweet"
        />
      </template>

      <!-- Tweet detail -->
      <template v-else-if="route.page === 'tweet'">
        <div v-if="!detailTweet" class="xd-empty">Tweet not found</div>
        <template v-else>
          <TweetDetailView
            :tweet="detailTweet"
            :replies="detailReplies"
            @open-user="openUser"
            @open-original="openOriginal"
            @open-media="openMediaUrl"
            @open-tweet="openTweet"
          >
            <template #after-detail>
              <RemoteDbTweetPanel
                v-if="shouldShowRemoteDbPanel"
                :tweet="detailTweet"
                :batch-sync-tweets="detailRemoteSyncTweets"
              />
            </template>
          </TweetDetailView>
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
      <span class="xd-tab-meta">{{ tweetListCards.length }} tweets</span>
      <button class="xd-btn xd-btn--sm xd-btn--error" @click="clearCaptureState">Clear</button>
    </div>
  </div>
</template>
