<script setup lang="ts">
import { computed } from 'vue';
import { featureRoute, featureNavigateTo } from '../lib/store';
import { getDbTweet, getDbUser, getParentChain, getReplies, getMediaForTweet, dbVersion } from '../lib/db-service';
import type { DbTweet } from '../lib/db-service';
import {
  getUserMediaTweetIds, getUserMediaVersion,
} from '../lib/fetch-interceptor';
import { useShadowStyle } from '../lib/use-shadow-style';
import { GM_openInTab } from '$';
import TweetSummaryItem from '../components/TweetSummaryItem.vue';
import TweetDetailCard from '../components/TweetDetailCard.vue';
import UserDetailCard from '../components/UserDetailCard.vue';
import UserMediaCard from '../components/UserMediaCard.vue';

const route = featureRoute;

const focalTweet = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'status') return getDbTweet(route.value.tweetId) ?? null;
  return null;
});

const detailTweet = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'tweet') return getDbTweet(route.value.tweetId) ?? null;
  return null;
});

const detailUser = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user') return getDbUser(route.value.userId) ?? null;
  return null;
});

function openTweet(id: string) {
  featureNavigateTo({ page: 'tweet', tweetId: id });
}

function openUser(id: string) {
  featureNavigateTo({ page: 'user', userId: id });
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

// --- UserMedia helpers ---
const umVersion = computed(() => getUserMediaVersion());

const umTweetList = computed(() => {
  void umVersion.value;
  void dbVersion.value;
  return getUserMediaTweetIds().map((id) => {
    const tweet = getDbTweet(id);
    if (!tweet) return null;
    const author = getDbUser(tweet.authorId);
    const media = getMediaForTweet(id);
    return { tweet, author, media };
  }).filter(Boolean) as { tweet: DbTweet; author: import('../lib/types').XUser | undefined; media: import('../lib/types').XMedia[] }[];
});

function openUserMediaTweet(id: string) {
  featureNavigateTo({ page: 'user-media-tweet', tweetId: id });
}

function openUserMediaUser(id: string) {
  featureNavigateTo({ page: 'user-media-user', userId: id });
}

// UserMedia tweet detail
const umDetailTweet = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user-media-tweet') {
    return getDbTweet(route.value.tweetId) ?? null;
  }
  return null;
});

// UserMedia user detail
const umDetailUser = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user-media-user') {
    return getDbUser(route.value.userId) ?? null;
  }
  return null;
});

function openUmOriginal(t: DbTweet) {
  const u = getDbUser(t.authorId);
  if (u) GM_openInTab(`https://x.com/${u.screenName}/status/${t.id}`, { active: true });
}

function openUmProfile(userId: string) {
  const u = getDbUser(userId);
  if (u) GM_openInTab(`https://x.com/${u.screenName}`, { active: true });
}

const focalParents = computed(() => {
  void dbVersion.value;
  if (!focalTweet.value) return [];
  return getParentChain(focalTweet.value.id);
});

const focalReplies = computed(() => {
  void dbVersion.value;
  if (!focalTweet.value) return [];
  return getReplies(focalTweet.value.id);
});

const STYLE_TEXT = `
.xd-context-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--xd-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.xd-context-divider {
  height: 1px;
  background: var(--xd-border);
  margin: 8px 0;
}
`;

useShadowStyle('feature-tab', STYLE_TEXT);
</script>

<template>
  <div class="xd-body">
    <!-- No matching page -->
    <template v-if="route.page === 'none'">
      <div class="xd-empty">No feature available for this page</div>
    </template>

    <!-- Status page (level 1): focal tweet detail -->
    <template v-else-if="route.page === 'status'">
      <div v-if="!focalTweet" class="xd-empty">Waiting for tweet data...</div>
      <template v-else>
        <template v-if="focalParents.length > 0">
          <div class="xd-context-label">Thread above</div>
          <TweetSummaryItem
            v-for="p in focalParents"
            :key="p.id"
            :tweet="p"
            compact
            @select="openTweet"
          />
          <div class="xd-context-divider"></div>
        </template>

        <TweetDetailCard
          :tweet="focalTweet"
          @open-user="openUser"
          @open-original="openOriginal"
          @open-media="openMediaUrl"
        />

        <template v-if="focalReplies.length > 0">
          <div class="xd-context-divider"></div>
          <div class="xd-context-label">Replies</div>
          <TweetSummaryItem
            v-for="r in focalReplies"
            :key="r.id"
            :tweet="r"
            compact
            @select="openTweet"
          />
        </template>
      </template>
    </template>

    <!-- Tweet detail (level 2, from thread above/replies) -->
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

    <!-- User detail (level 3) -->
    <template v-else-if="route.page === 'user'">
      <div v-if="!detailUser" class="xd-empty">User not found</div>
      <template v-else>
        <UserDetailCard :user="detailUser" @open-profile="openProfile" />
      </template>
    </template>

    <!-- UserMedia: media tweet list (level 1) -->
    <template v-else-if="route.page === 'user-media'">
      <div v-if="umTweetList.length === 0" class="xd-empty">Waiting for media data...</div>
      <UserMediaCard
        v-for="item in umTweetList"
        :key="item.tweet.id"
        :tweet="item.tweet"
        :author="item.author"
        :media="item.media"
        @select="openUserMediaTweet"
      />
    </template>

    <!-- UserMedia: tweet detail (level 2) -->
    <template v-else-if="route.page === 'user-media-tweet'">
      <div v-if="!umDetailTweet" class="xd-empty">Tweet not found</div>
      <template v-else>
        <TweetDetailCard
          :tweet="umDetailTweet"
          @open-user="openUserMediaUser"
          @open-original="openUmOriginal"
          @open-media="openMediaUrl"
        />
      </template>
    </template>

    <!-- UserMedia: user detail (level 3) -->
    <template v-else-if="route.page === 'user-media-user'">
      <div v-if="!umDetailUser" class="xd-empty">User not found</div>
      <template v-else>
        <UserDetailCard :user="umDetailUser" @open-profile="openUmProfile" />
      </template>
    </template>
  </div>
</template>
