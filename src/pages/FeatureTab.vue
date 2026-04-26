<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { DbMedia, DbTweet, DbUser } from '../lib/db-service';
import {
  dbVersion,
  enqueueRemoteTweetSyncStatusRefresh,
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
import {
  buildRemoteDbSubmissionBatch,
  isRemoteDbTweetApiReady,
  RemoteDbHttpError,
  submitRemoteDbSubmission,
} from '../lib/remote-db';
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

type TimelineBatchSubmitState = 'idle' | 'submitting' | 'success' | 'error';

const route = featureRoute;
const timelineMultiSelectActive = ref(false);
const selectedTimelineTweetIds = reactive(new Set<string>());
const timelineBatchSubmitState = ref<TimelineBatchSubmitState>('idle');
const timelineBatchSubmitMessage = ref<string | null>(null);

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

const shouldShowTimelineRemoteActions = computed(() => {
  return route.value.page === 'timeline' && isRemoteDbTweetApiReady();
});

const timelineRouteKey = computed(() => {
  if (route.value.page !== 'timeline') return 'inactive';
  return `${route.value.source}:${route.value.username ?? ''}`;
});

const selectedTimelineItems = computed(() => {
  return timelineItems.value.filter((item) => selectedTimelineTweetIds.has(item.tweet.id));
});

const timelineTweetIds = computed(() => timelineItems.value.map((item) => item.tweet.id));

const selectedTimelineCount = computed(() => selectedTimelineItems.value.length);

const allTimelineTweetsSelected = computed(() => {
  return timelineTweetIds.value.length > 0
    && timelineTweetIds.value.every((tweetId) => selectedTimelineTweetIds.has(tweetId));
});

const selectedTimelineBuildResult = computed(() => {
  return buildRemoteDbSubmissionBatch(selectedTimelineItems.value.map((item) => ({
    tweet: item.tweet,
    author: item.author,
    media: item.media,
  })));
});

const selectedTimelineSubmitIssue = computed(() => {
  if (selectedTimelineCount.value === 0) {
    return 'Select tweets to submit';
  }

  const result = selectedTimelineBuildResult.value;
  if (result.missingAuthorTweetIds.length > 0) {
    return `Submit unavailable: author data is missing for ${result.missingAuthorTweetIds.join(', ')}`;
  }
  if (result.invalidUserCreatedAtIds.length > 0) {
    return `Submit unavailable: invalid user time for ${result.invalidUserCreatedAtIds.join(', ')}`;
  }
  if (result.invalidTweetCreatedAtIds.length > 0) {
    return `Submit unavailable: invalid tweet time for ${result.invalidTweetCreatedAtIds.join(', ')}`;
  }
  return null;
});

const timelineSubmitDisabled = computed(() => {
  return timelineBatchSubmitState.value === 'submitting'
    || selectedTimelineCount.value === 0
    || !selectedTimelineBuildResult.value.submission;
});

const timelineSubmitButtonText = computed(() => {
  return timelineBatchSubmitState.value === 'submitting' ? 'Submitting...' : 'Submit';
});

const selectAllButtonText = computed(() => {
  return allTimelineTweetsSelected.value ? 'Clear All' : 'Select All';
});

const timelineActionMetaText = computed(() => {
  if (timelineBatchSubmitMessage.value) {
    return timelineBatchSubmitMessage.value;
  }

  if (timelineMultiSelectActive.value && selectedTimelineCount.value > 0 && selectedTimelineSubmitIssue.value) {
    return selectedTimelineSubmitIssue.value;
  }

  return `${selectedTimelineCount.value} selected`;
});

function firstSubmitIssue(
  result: Awaited<ReturnType<typeof submitRemoteDbSubmission>>,
): string | null {
  for (const collection of [result.users, result.tweets, result.media]) {
    for (const item of collection) {
      if (item.error) {
        return item.error;
      }

      const failedOperation = item.operations.find((operation) => operation.status === 'failed');
      if (failedOperation?.reason) {
        return `${item.id ?? 'unknown'}: ${failedOperation.reason}`;
      }
    }
  }

  return null;
}

function formatSubmitMessage(
  result: Awaited<ReturnType<typeof submitRemoteDbSubmission>>,
): string {
  const summary = result.summary;
  const issue = firstSubmitIssue(result);
  return issue
    ? `Submit accepted ${summary.accepted}, skipped ${summary.skipped}, partial ${summary.partial}, failed ${summary.failed}. First issue: ${issue}`
    : `Submit accepted ${summary.accepted}, skipped ${summary.skipped}, partial ${summary.partial}, failed ${summary.failed}.`;
}

function toRemoteSubmitErrorMessage(error: unknown): string {
  if (error instanceof RemoteDbHttpError) {
    if (error.status === 401) {
      return 'Remote database session expired. Open Settings and sign in again.';
    }

    if (error.status === 403) {
      return 'Remote database sync requires an administrator account.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to submit selected tweets to remote database';
}

function clearTimelineSelection(): void {
  selectedTimelineTweetIds.clear();
}

function clearTimelineBatchMessage(): void {
  timelineBatchSubmitState.value = 'idle';
  timelineBatchSubmitMessage.value = null;
}

function resetTimelineMultiSelect(): void {
  timelineMultiSelectActive.value = false;
  clearTimelineSelection();
  clearTimelineBatchMessage();
}

function toggleTimelineMultiSelect(): void {
  if (timelineMultiSelectActive.value) {
    resetTimelineMultiSelect();
    return;
  }

  timelineMultiSelectActive.value = true;
  clearTimelineBatchMessage();
}

function toggleTimelineTweetSelection(tweetId: string): void {
  if (selectedTimelineTweetIds.has(tweetId)) {
    selectedTimelineTweetIds.delete(tweetId);
  } else {
    selectedTimelineTweetIds.add(tweetId);
  }

  clearTimelineBatchMessage();
}

function toggleAllTimelineTweetSelection(): void {
  if (allTimelineTweetsSelected.value) {
    clearTimelineSelection();
    clearTimelineBatchMessage();
    return;
  }

  timelineMultiSelectActive.value = true;
  for (const tweetId of timelineTweetIds.value) {
    selectedTimelineTweetIds.add(tweetId);
  }
  clearTimelineBatchMessage();
}

function selectTimelineTweet(tweetId: string): void {
  if (timelineMultiSelectActive.value && shouldShowTimelineRemoteActions.value) {
    toggleTimelineTweetSelection(tweetId);
    return;
  }

  openTweet(tweetId);
}

async function submitSelectedTimelineTweets(): Promise<void> {
  const selectedIds = selectedTimelineItems.value.map((item) => item.tweet.id);
  const submission = selectedTimelineBuildResult.value.submission;

  if (!submission) {
    timelineBatchSubmitState.value = 'error';
    timelineBatchSubmitMessage.value = selectedTimelineSubmitIssue.value ?? 'Unable to build selected tweet submission';
    return;
  }

  timelineBatchSubmitState.value = 'submitting';
  timelineBatchSubmitMessage.value = null;

  try {
    const result = await submitRemoteDbSubmission(submission);
    enqueueRemoteTweetSyncStatusRefresh(selectedIds);
    clearTimelineSelection();
    timelineMultiSelectActive.value = false;
    timelineBatchSubmitState.value = 'success';
    timelineBatchSubmitMessage.value = formatSubmitMessage(result);
  } catch (error) {
    timelineBatchSubmitState.value = 'error';
    timelineBatchSubmitMessage.value = toRemoteSubmitErrorMessage(error);
  }
}

watch(
  () => [timelineRouteKey.value, shouldShowTimelineRemoteActions.value] as const,
  () => {
    resetTimelineMultiSelect();
  },
);

watch(
  () => timelineTweetIds.value.join('|'),
  () => {
    const currentIds = new Set(timelineTweetIds.value);
    for (const tweetId of [...selectedTimelineTweetIds]) {
      if (!currentIds.has(tweetId)) {
        selectedTimelineTweetIds.delete(tweetId);
      }
    }
  },
);
</script>

<template>
  <div class="xd-tab-wrapper">
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
          :selected="selectedTimelineTweetIds.has(item.tweet.id)"
          @select="selectTimelineTweet"
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

    <div v-if="shouldShowTimelineRemoteActions" class="xd-tab-actions">
      <div class="xd-tab-actions-left">
        <button
          class="xd-btn xd-btn--sm"
          :class="{ 'xd-btn--accent': timelineMultiSelectActive }"
          @click="toggleTimelineMultiSelect"
        >
          {{ timelineMultiSelectActive ? 'Cancel' : 'Select' }}
        </button>
        <button
          class="xd-btn xd-btn--sm"
          :class="{ 'xd-btn--accent': allTimelineTweetsSelected }"
          :disabled="timelineItems.length === 0"
          @click="toggleAllTimelineTweetSelection"
        >
          {{ selectAllButtonText }}
        </button>
        <button
          class="xd-btn xd-btn--sm xd-btn--accent"
          :disabled="timelineSubmitDisabled"
          @click="submitSelectedTimelineTweets"
        >
          {{ timelineSubmitButtonText }}
        </button>
      </div>
      <div class="xd-tab-actions-right">
        <span
          class="xd-tab-meta"
          :class="{
            'xd-tab-meta--error': timelineBatchSubmitState === 'error' || (timelineMultiSelectActive && selectedTimelineCount > 0 && selectedTimelineSubmitIssue),
            'xd-tab-meta--success': timelineBatchSubmitState === 'success',
          }"
        >
          {{ timelineActionMetaText }}
        </span>
      </div>
    </div>
  </div>
</template>
