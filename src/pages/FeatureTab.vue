<script setup lang="ts">
import { computed } from 'vue';
import type { DbMedia, DbTweet, DbUser } from '../lib/db-service';
import {
  dbVersion,
  getDbTweet,
  getDbUser,
  getMediaForTweet,
  getParentChain,
  getRemoteTweetSyncStatus,
  getReplies,
} from '../lib/db-service';
import { HOME_FEATURE_TIMELINE_SOURCES, getFeatureTimelineLabel, getFeatureTimelineOperation, type FeatureTimelineSource } from '../lib/feature-timeline';
import { getTimelineTweetIdsByAlias, getTimelineVersionByAlias } from '../lib/timeline-store';
import { featureNavigateTo, featureRoute, type FeatureRoute } from '../lib/store';
import { GM_openInTab } from '$';
import { getTweetOpenUrl, getUserOpenUrl } from '../lib/tweet-selectors';
import { isRemoteDbTweetApiReady } from '../lib/remote-db';
import TweetDetailView from '../components/TweetDetailView.vue';
import UserDetailCard from '../components/UserDetailCard.vue';
import TweetSummaryCard from '../components/TweetSummaryCard.vue';
import RemoteDbTweetPanel from '../components/RemoteDbTweetPanel.vue';

interface TweetSummaryCardItem {
  tweet: DbTweet;
  author: DbUser | undefined;
  media: DbMedia[];
}

interface FeatureTimelineContext {
  source: FeatureTimelineSource;
  username?: string;
}

const route = featureRoute;

function getRouteTimelineContext(value: FeatureRoute): FeatureTimelineContext | null {
  if (value.page === 'timeline') {
    return {
      source: value.source,
      username: value.username,
    };
  }

  if ((value.page === 'tweet' || value.page === 'user') && value.source) {
    return {
      source: value.source,
      username: value.username,
    };
  }

  return null;
}

function buildTimelineCardItems(source: FeatureTimelineSource, username?: string | null): TweetSummaryCardItem[] {
  const operationName = getFeatureTimelineOperation(source);
  const tweetIds = getTimelineTweetIdsByAlias(operationName, username ?? null);

  return tweetIds.map((id) => {
    const tweet = getDbTweet(id);
    if (!tweet) return null;
    return {
      tweet,
      author: getDbUser(tweet.authorId),
      media: getMediaForTweet(tweet.id),
    };
  }).filter(Boolean) as TweetSummaryCardItem[];
}

function getTimelineWaitingText(source: FeatureTimelineSource): string {
  if (source === 'user-media') return 'Waiting for media data...';
  if (source === 'user-tweets') return 'Waiting for tweet timeline data...';
  if (source === 'bookmarks') return 'Waiting for bookmarks data...';
  if (source === 'home-timeline') return 'Waiting for HomeTimeline data...';
  return 'Waiting for HomeLatestTimeline data...';
}

function createRouteWithCurrentTimelineContext<T extends FeatureRoute>(fallbackRoute: T, withContext: (context: FeatureTimelineContext) => T): T {
  const context = getRouteTimelineContext(route.value);
  return context ? withContext(context) : fallbackRoute;
}

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

const detailReplies = computed(() => {
  void dbVersion.value;
  if (!detailTweet.value) return [];
  return getReplies(detailTweet.value.id);
});

const detailRemoteSyncTweets = computed(() => {
  if (!detailTweet.value) return [];
  return [detailTweet.value, ...detailReplies.value];
});

const detailUser = computed(() => {
  void dbVersion.value;
  if (route.value.page === 'user') return getDbUser(route.value.userId) ?? null;
  return null;
});

const timelineItems = computed(() => {
  if (route.value.page !== 'timeline') return [];
  void dbVersion.value;
  void getTimelineVersionByAlias(getFeatureTimelineOperation(route.value.source), route.value.username ?? null);
  return buildTimelineCardItems(route.value.source, route.value.username);
});

const homeEntryCards = computed(() => {
  return HOME_FEATURE_TIMELINE_SOURCES.map((source) => {
    const operationName = getFeatureTimelineOperation(source);
    void getTimelineVersionByAlias(operationName);
    return {
      source,
      label: getFeatureTimelineLabel(source),
      count: getTimelineTweetIdsByAlias(operationName).length,
    };
  });
});

function openTweet(tweetId: string) {
  featureNavigateTo(createRouteWithCurrentTimelineContext(
    { page: 'tweet', tweetId },
    (context) => ({ page: 'tweet', tweetId, source: context.source, username: context.username }),
  ));
}

function openUser(userId: string) {
  featureNavigateTo(createRouteWithCurrentTimelineContext(
    { page: 'user', userId },
    (context) => ({ page: 'user', userId, source: context.source, username: context.username }),
  ));
}

function openHomeTimeline(source: FeatureTimelineSource) {
  featureNavigateTo({ page: 'timeline', source });
}

function openOriginal(tweet: DbTweet) {
  const user = getDbUser(tweet.authorId);
  const url = getTweetOpenUrl(tweet, user);
  if (url) {
    GM_openInTab(url, { active: true });
  }
}

function openMediaUrl(url: string) {
  GM_openInTab(url, { active: true });
}

function openProfile(userId: string) {
  const user = getDbUser(userId);
  if (user) {
    GM_openInTab(getUserOpenUrl(user), { active: true });
  }
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

const focalRemoteSyncTweets = computed(() => {
  if (!focalTweet.value) return [];
  return [...focalParents.value, focalTweet.value, ...focalReplies.value];
});

const shouldShowRemoteDbPanel = computed(() => {
  return isRemoteDbTweetApiReady();
});
</script>

<template>
  <div class="xd-body">
    <template v-if="route.page === 'none'">
      <div class="xd-empty">No feature available for this page</div>
    </template>

    <template v-else-if="route.page === 'home-root'">
      <div v-for="entry in homeEntryCards" :key="entry.source" class="xd-list-item xd-list-item--clickable" @click="openHomeTimeline(entry.source)">
        <div class="xd-list-item-info">
          <div class="xd-list-item-title">{{ entry.label }}</div>
          <div class="xd-list-item-meta">{{ entry.count }} tweets captured</div>
        </div>
      </div>
    </template>

    <template v-else-if="route.page === 'status'">
      <div v-if="!focalTweet" class="xd-empty">Waiting for tweet data...</div>
      <template v-else>
        <TweetDetailView
          :tweet="focalTweet"
          :parents="focalParents"
          :replies="focalReplies"
          show-parents
          @open-user="openUser"
          @open-original="openOriginal"
          @open-media="openMediaUrl"
          @open-tweet="openTweet"
        >
          <template #after-detail>
            <RemoteDbTweetPanel
              v-if="shouldShowRemoteDbPanel"
              :tweet="focalTweet"
              :batch-sync-tweets="focalRemoteSyncTweets"
            />
          </template>
        </TweetDetailView>
      </template>
    </template>

    <template v-else-if="route.page === 'timeline'">
      <div v-if="timelineItems.length === 0" class="xd-empty">{{ getTimelineWaitingText(route.source) }}</div>
      <TweetSummaryCard
        v-for="item in timelineItems"
        :key="item.tweet.id"
        :tweet="item.tweet"
        :author="item.author"
        :media="item.media"
        :remote-sync-status="getRemoteTweetSyncStatus(item.tweet.id)"
        @select="openTweet"
      />
    </template>

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

    <template v-else-if="route.page === 'user'">
      <div v-if="!detailUser" class="xd-empty">User not found</div>
      <template v-else>
        <UserDetailCard :user="detailUser" @open-profile="openProfile" />
      </template>
    </template>
  </div>
</template>
