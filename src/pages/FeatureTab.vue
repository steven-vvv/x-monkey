<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { DbMedia, DbTweet, DbUser } from '../lib/db-service';
import { dbVersion, getDbTweet, getDbUser, getMediaForTweet, getParentChain, getReplies } from '../lib/db-service';
import { HOME_FEATURE_TIMELINE_SOURCES, getFeatureTimelineLabel, getFeatureTimelineOperation, type FeatureTimelineSource } from '../lib/feature-timeline';
import { getTimelineTweetIdsByAlias, getTimelineVersionByAlias } from '../lib/timeline-store';
import { featureNavigateTo, featureRoute, type FeatureRoute } from '../lib/store';
import { GM_openInTab } from '$';
import { getTweetOpenUrl, getUserOpenUrl } from '../lib/tweet-selectors';
import {
  compareRemoteDbTweetBundle,
  getRemoteDbClientState,
  isRemoteDbTweetApiReady,
  queryRemoteDbTweetBundles,
  type RemoteDbStatusComparison,
  type RemoteDbTweetBundle,
} from '../lib/remote-db';
import TweetDetailView from '../components/TweetDetailView.vue';
import UserDetailCard from '../components/UserDetailCard.vue';
import TweetSummaryCard from '../components/TweetSummaryCard.vue';

const REMOTE_STATUS_BATCH_SIZE = 50;
const REMOTE_DB_MISSING_SELECTOR_RESULT_ERROR = 'Remote database response is missing this selector result';

interface TweetSummaryCardItem {
  tweet: DbTweet;
  author: DbUser | undefined;
  media: DbMedia[];
}

interface FeatureTimelineContext {
  source: FeatureTimelineSource;
  username?: string;
}

type TweetSummaryRemoteSyncStatus = RemoteDbStatusComparison['overallStatus'];

const route = featureRoute;
const remoteDbState = getRemoteDbClientState();
const timelineRemoteSyncStatuses = reactive<Record<string, TweetSummaryRemoteSyncStatus>>({});

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

const timelineRemoteQueryKey = computed(() => {
  if (route.value.page !== 'timeline') return 'inactive';

  return [
    route.value.source,
    route.value.username ?? '',
    ...timelineItems.value.map((item) => [
      item.tweet.id,
      item.tweet._ts,
      item.author?._ts ?? 0,
      item.media.map((media) => `${media.id}:${media._ts}`).join(','),
    ].join(':')),
  ].join('|');
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

function clearTimelineRemoteSyncStatuses(): void {
  for (const tweetId of Object.keys(timelineRemoteSyncStatuses)) {
    delete timelineRemoteSyncStatuses[tweetId];
  }
}

function hasRemoteTweetSelectorResult(bundle: RemoteDbTweetBundle): boolean {
  return bundle.tweet.status !== 'failed'
    || bundle.tweet.error !== REMOTE_DB_MISSING_SELECTOR_RESULT_ERROR;
}

let remoteSyncQueryToken = 0;

async function loadTimelineRemoteSyncStatuses(): Promise<void> {
  remoteSyncQueryToken += 1;
  const currentToken = remoteSyncQueryToken;
  clearTimelineRemoteSyncStatuses();

  if (route.value.page !== 'timeline' || !isRemoteDbTweetApiReady()) return;

  const items = timelineItems.value;
  if (items.length === 0) return;

  for (let index = 0; index < items.length; index += REMOTE_STATUS_BATCH_SIZE) {
    const batchItems = items.slice(index, index + REMOTE_STATUS_BATCH_SIZE);

    try {
      const bundles = await queryRemoteDbTweetBundles({
        items: batchItems.map((item) => ({
          tweetId: item.tweet.id,
          authorId: item.author?.id,
          mediaIds: item.media.map((media) => media.id),
        })),
      });

      if (currentToken !== remoteSyncQueryToken) return;

      for (const [bundleIndex, bundle] of bundles.entries()) {
        const item = batchItems[bundleIndex];
        if (!item || !hasRemoteTweetSelectorResult(bundle)) continue;

        timelineRemoteSyncStatuses[item.tweet.id] = compareRemoteDbTweetBundle(
          item.tweet,
          item.author,
          item.media,
          bundle,
        ).overallStatus;
      }
    } catch {
      if (currentToken !== remoteSyncQueryToken) return;
      return;
    }
  }
}

watch(
  () => [
    timelineRemoteQueryKey.value,
    remoteDbState.baseUrl ?? '',
    remoteDbState.lifecycle,
    remoteDbState.sessionState,
    String(remoteDbState.runtimeEnabled),
  ] as const,
  () => {
    void loadTimelineRemoteSyncStatuses();
  },
  { immediate: true },
);
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
        />
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
        :remote-sync-status="timelineRemoteSyncStatuses[item.tweet.id]"
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
        />
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
