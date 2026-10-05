<script setup lang="ts">
import { computed } from 'vue';
import type { Post } from '../archive/model';
import { dbRoute, dbNavigateTo } from '../lib/store';
import { dbVersion, getAllPosts, getDbPost, getDbUser, getDisplayPost, getReplies } from '../lib/db-service';
import { clearCaptureState } from '../lib/capture-state-service';
import { GM_openInTab } from '$';
import { getPostOpenUrl, getUserOpenUrl } from '../lib/post-view';
import { toTweetCompactCardItem } from '../lib/view-format';
import TweetCompactCard from '../components/TweetCompactCard.vue';
import TweetDetailView from '../components/TweetDetailView.vue';
import UserDetailCard from '../components/UserDetailCard.vue';
import RemoteDbTweetPanel from '../components/RemoteDbTweetPanel.vue';
import { isRemoteDbReady } from '../lib/remote-db';

const route = dbRoute;

// Pure reposts are listed through the original they point to.
const postListCards = computed(() => {
  void dbVersion.value;
  const seen = new Set<string>();
  return getAllPosts()
    .map(getDisplayPost)
    .filter((post) => !seen.has(post.id) && seen.add(post.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((post) => toTweetCompactCardItem(post, getDbUser(post.authorId)));
});

function openTweet(id: string) {
  dbNavigateTo({ page: 'tweet', tweetId: id });
}

function openUser(id: string) {
  dbNavigateTo({ page: 'user', userId: id });
}

function openOriginal(post: Post) {
  GM_openInTab(getPostOpenUrl(post, getDbUser(post.authorId)), { active: true });
}

function openMediaUrl(url: string) {
  GM_openInTab(url, { active: true });
}

function openProfile(userId: string) {
  const user = getDbUser(userId);
  if (user) GM_openInTab(getUserOpenUrl(user), { active: true });
}

const detailPost = computed(() => {
  void dbVersion.value;
  if (route.value.page !== 'tweet') return null;
  const post = getDbPost(route.value.tweetId);
  return post ? getDisplayPost(post) : null;
});

const detailReplies = computed(() => {
  void dbVersion.value;
  return detailPost.value ? getReplies(detailPost.value.id) : [];
});

const detailRemoteSyncPosts = computed(() => {
  return detailPost.value ? [detailPost.value, ...detailReplies.value] : [];
});

const detailUser = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user') return getDbUser(route.value.userId) ?? null;
  return null;
});

const shouldShowRemoteDbPanel = computed(() => isRemoteDbReady());
</script>

<template>
  <div class="xd-tab-wrapper">
    <div class="xd-body">
      <!-- List page -->
      <template v-if="route.page === 'list'">
        <div v-if="postListCards.length === 0" class="xd-empty">Database is empty</div>
        <TweetCompactCard
          v-for="item in postListCards"
          :key="item.tweetId"
          :item="item"
          @select="openTweet"
        />
      </template>

      <!-- Tweet detail -->
      <template v-else-if="route.page === 'tweet'">
        <div v-if="!detailPost" class="xd-empty">Post not found</div>
        <template v-else>
          <TweetDetailView
            :post="detailPost"
            :replies="detailReplies"
            @open-user="openUser"
            @open-original="openOriginal"
            @open-media="openMediaUrl"
            @open-tweet="openTweet"
          >
            <template #after-detail>
              <RemoteDbTweetPanel
                v-if="shouldShowRemoteDbPanel"
                :post="detailPost"
                :batch-sync-posts="detailRemoteSyncPosts"
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
      <span class="xd-tab-meta">{{ postListCards.length }} posts</span>
      <button class="xd-btn xd-btn--sm xd-btn--error" @click="clearCaptureState">Clear</button>
    </div>
  </div>
</template>
