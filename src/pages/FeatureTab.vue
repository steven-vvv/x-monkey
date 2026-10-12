<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Media, Post, User } from '../archive/model';
import {
  archiveRecords,
  dbVersion,
  enqueueRemoteSyncStatusRefresh,
  getDbPost,
  getDbUser,
  getDisplayPost,
  getMediaForPost,
  getParentChain,
  getRemoteSyncStatus,
  getReplies,
} from '../lib/db-service';
import {
  HOME_FEATURE_TIMELINES,
  getFeatureTimelineLabel,
  getFeatureTimelineNamespace,
  type FeatureTimelineSort,
  type FeatureTimelineSource,
} from '../lib/feature-timeline';
import { getTimelinePostIdsByAlias, getTimelineVersionByAlias } from '../lib/timeline-store';
import { featureNavigateTo, featureRoute, type FeatureRoute } from '../lib/store';
import { GM_openInTab } from '$';
import { getPostOpenUrl, getUserOpenUrl } from '../lib/post-view';
import {
  buildArchiveBatch,
  isRemoteDbReady,
  RemoteDbHttpError,
  submitRemoteDbArchive,
  type RemoteDbSubmitResponse,
} from '../lib/remote-db';
import TweetDetailView from '../components/TweetDetailView.vue';
import UserDetailCard from '../components/UserDetailCard.vue';
import TweetSummaryCard from '../components/TweetSummaryCard.vue';
import RemoteDbTweetPanel from '../components/RemoteDbTweetPanel.vue';

interface TimelineCardItem {
  /** Timeline entry id: the repost itself for reposts. */
  id: string;
  post: Post;
  author: User | undefined;
  media: Media[];
  repostedBy?: User;
}

interface FeatureTimelineContext {
  source: FeatureTimelineSource;
  scope?: string;
  sort?: FeatureTimelineSort;
}

type TimelineBatchSubmitState = 'idle' | 'submitting' | 'success' | 'error';

const route = featureRoute;
const timelineMultiSelectActive = ref(false);
const selectedTimelinePostIds = reactive(new Set<string>());
const timelineBatchSubmitState = ref<TimelineBatchSubmitState>('idle');
const timelineBatchSubmitMessage = ref<string | null>(null);

function getRouteTimelineContext(value: FeatureRoute): FeatureTimelineContext | null {
  if (value.page === 'timeline' || ((value.page === 'tweet' || value.page === 'user') && value.source)) {
    return { source: value.source!, scope: value.scope, sort: value.sort };
  }
  return null;
}

function buildTimelineCardItems(context: FeatureTimelineContext): TimelineCardItem[] {
  const postIds = getTimelinePostIdsByAlias(getFeatureTimelineNamespace(context.source, context.sort), context.scope ?? null);
  return postIds.flatMap((id) => {
    const entry = getDbPost(id);
    if (!entry) return [];
    const post = getDisplayPost(entry);
    return [{
      id,
      post,
      author: getDbUser(post.authorId),
      media: getMediaForPost(post),
      repostedBy: post !== entry ? getDbUser(entry.authorId) : undefined,
    }];
  });
}

function createRouteWithCurrentTimelineContext(fallbackRoute: FeatureRoute, withContext: (context: FeatureTimelineContext) => FeatureRoute): FeatureRoute {
  const context = getRouteTimelineContext(route.value);
  return context ? withContext(context) : fallbackRoute;
}

function getRoutePost(postId: string): Post | null {
  const post = getDbPost(postId);
  return post ? getDisplayPost(post) : null;
}

const focalPost = computed(() => {
  void dbVersion.value;
  return route.value.page === 'status' ? getRoutePost(route.value.tweetId) : null;
});

const detailPost = computed(() => {
  void dbVersion.value;
  return route.value.page === 'tweet' ? getRoutePost(route.value.tweetId) : null;
});

const detailReplies = computed(() => {
  void dbVersion.value;
  return detailPost.value ? getReplies(detailPost.value.id) : [];
});

const detailRemoteSyncPosts = computed(() => detailPost.value ? [detailPost.value, ...detailReplies.value] : []);

const detailUser = computed(() => {
  void dbVersion.value;
  return route.value.page === 'user' ? getDbUser(route.value.userId) ?? null : null;
});

const timelineItems = computed(() => {
  if (route.value.page !== 'timeline') return [];
  void dbVersion.value;
  const context = { source: route.value.source, scope: route.value.scope, sort: route.value.sort };
  void getTimelineVersionByAlias(getFeatureTimelineNamespace(context.source, context.sort), context.scope ?? null);
  return buildTimelineCardItems(context);
});

const timelineWaitingText = computed(() => {
  return route.value.page === 'timeline'
    ? `Waiting for ${getFeatureTimelineLabel(route.value.source, route.value.sort)} data...`
    : '';
});

const homeEntryCards = computed(() => {
  return HOME_FEATURE_TIMELINES.map(({ source, sort }) => {
    const namespace = getFeatureTimelineNamespace(source, sort);
    void getTimelineVersionByAlias(namespace);
    return {
      namespace,
      source,
      sort,
      label: getFeatureTimelineLabel(source, sort),
      count: getTimelinePostIdsByAlias(namespace).length,
    };
  });
});

function openTweet(postId: string) {
  featureNavigateTo(createRouteWithCurrentTimelineContext(
    { page: 'tweet', tweetId: postId },
    (context) => ({ page: 'tweet', tweetId: postId, ...context }),
  ));
}

function openUser(userId: string) {
  featureNavigateTo(createRouteWithCurrentTimelineContext(
    { page: 'user', userId },
    (context) => ({ page: 'user', userId, ...context }),
  ));
}

function openHomeTimeline(source: FeatureTimelineSource, sort?: FeatureTimelineSort) {
  featureNavigateTo({ page: 'timeline', source, sort });
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

const focalParents = computed(() => {
  void dbVersion.value;
  return focalPost.value ? getParentChain(focalPost.value.id) : [];
});

const focalReplies = computed(() => {
  void dbVersion.value;
  return focalPost.value ? getReplies(focalPost.value.id) : [];
});

const focalRemoteSyncPosts = computed(() => focalPost.value ? [...focalParents.value, focalPost.value, ...focalReplies.value] : []);

const shouldShowRemoteDbPanel = computed(() => isRemoteDbReady());

const shouldShowTimelineRemoteActions = computed(() => route.value.page === 'timeline' && isRemoteDbReady());

const timelineRouteKey = computed(() => {
  if (route.value.page !== 'timeline') return 'inactive';
  return `${route.value.source}:${route.value.scope ?? ''}:${route.value.sort ?? ''}`;
});

const timelineEntryIds = computed(() => timelineItems.value.map((item) => item.id));

const selectedTimelineIds = computed(() => timelineEntryIds.value.filter((id) => selectedTimelinePostIds.has(id)));

const selectedTimelineCount = computed(() => selectedTimelineIds.value.length);

const allTimelinePostsSelected = computed(() => {
  return timelineEntryIds.value.length > 0 && timelineEntryIds.value.every((id) => selectedTimelinePostIds.has(id));
});

const timelineSubmitDisabled = computed(() => timelineBatchSubmitState.value === 'submitting' || selectedTimelineCount.value === 0);

const timelineSubmitButtonText = computed(() => timelineBatchSubmitState.value === 'submitting' ? 'Submitting...' : 'Submit');

const selectAllButtonText = computed(() => allTimelinePostsSelected.value ? 'Clear All' : 'Select All');

const timelineActionMetaText = computed(() => timelineBatchSubmitMessage.value ?? `${selectedTimelineCount.value} selected`);

function formatSubmitMessage(result: RemoteDbSubmitResponse): string {
  const { summary } = result;
  const issue = [...result.posts, ...result.users, ...result.media].find((item) => item.status === 'failed' || item.status === 'partial');
  const counts = `accepted ${summary.accepted}, unchanged ${summary.unchanged}, partial ${summary.partial}, failed ${summary.failed}`;
  return issue ? `Submit ${counts}. First issue: ${issue.id}: ${issue.reason ?? issue.status}` : `Submit ${counts}.`;
}

function toRemoteSubmitErrorMessage(error: unknown): string {
  if (error instanceof RemoteDbHttpError) {
    if (error.status === 401) return 'Remote database session expired. Open Settings and sign in again.';
    if (error.status === 403) return 'Remote database sync requires a contributor or administrator account.';
  }
  return error instanceof Error && error.message.trim() ? error.message : 'Failed to submit selected posts to remote database';
}

function clearTimelineSelection(): void {
  selectedTimelinePostIds.clear();
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

function toggleTimelinePostSelection(id: string): void {
  if (selectedTimelinePostIds.has(id)) selectedTimelinePostIds.delete(id);
  else selectedTimelinePostIds.add(id);
  clearTimelineBatchMessage();
}

function toggleAllTimelinePostSelection(): void {
  if (allTimelinePostsSelected.value) {
    clearTimelineSelection();
    clearTimelineBatchMessage();
    return;
  }
  timelineMultiSelectActive.value = true;
  for (const id of timelineEntryIds.value) selectedTimelinePostIds.add(id);
  clearTimelineBatchMessage();
}

function selectTimelineItem(item: TimelineCardItem): void {
  if (timelineMultiSelectActive.value && shouldShowTimelineRemoteActions.value) {
    toggleTimelinePostSelection(item.id);
    return;
  }
  openTweet(item.post.id);
}

async function submitSelectedTimelinePosts(): Promise<void> {
  const selectedIds = selectedTimelineIds.value;
  const { batch } = buildArchiveBatch(selectedIds, archiveRecords);
  timelineBatchSubmitState.value = 'submitting';
  timelineBatchSubmitMessage.value = null;

  try {
    const result = await submitRemoteDbArchive(batch);
    enqueueRemoteSyncStatusRefresh(selectedIds);
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
  () => timelineEntryIds.value.join('|'),
  () => {
    const currentIds = new Set(timelineEntryIds.value);
    for (const id of [...selectedTimelinePostIds]) {
      if (!currentIds.has(id)) selectedTimelinePostIds.delete(id);
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
        <div v-for="entry in homeEntryCards" :key="entry.namespace" class="xd-list-item xd-list-item--clickable" @click="openHomeTimeline(entry.source, entry.sort)">
          <div class="xd-list-item-info">
            <div class="xd-list-item-title">{{ entry.label }}</div>
            <div class="xd-list-item-meta">{{ entry.count }} tweets captured</div>
          </div>
        </div>
      </template>

      <template v-else-if="route.page === 'status'">
        <div v-if="!focalPost" class="xd-empty">Waiting for post data...</div>
        <template v-else>
          <TweetDetailView
            :post="focalPost"
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
                :post="focalPost"
                :batch-sync-posts="focalRemoteSyncPosts"
              />
            </template>
          </TweetDetailView>
        </template>
      </template>

      <template v-else-if="route.page === 'timeline'">
        <div v-if="timelineItems.length === 0" class="xd-empty">{{ timelineWaitingText }}</div>
        <TweetSummaryCard
          v-for="item in timelineItems"
          :key="item.id"
          :post="item.post"
          :author="item.author"
          :media="item.media"
          :reposted-by="item.repostedBy"
          :remote-sync-status="getRemoteSyncStatus(item.id)"
          :selected="selectedTimelinePostIds.has(item.id)"
          @select="selectTimelineItem(item)"
        />
      </template>

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
          :class="{ 'xd-btn--accent': allTimelinePostsSelected }"
          :disabled="timelineItems.length === 0"
          @click="toggleAllTimelinePostSelection"
        >
          {{ selectAllButtonText }}
        </button>
        <button
          class="xd-btn xd-btn--sm xd-btn--accent"
          :disabled="timelineSubmitDisabled"
          @click="submitSelectedTimelinePosts"
        >
          {{ timelineSubmitButtonText }}
        </button>
      </div>
      <div class="xd-tab-actions-right">
        <span
          class="xd-tab-meta"
          :class="{
            'xd-tab-meta--error': timelineBatchSubmitState === 'error',
            'xd-tab-meta--success': timelineBatchSubmitState === 'success',
          }"
        >
          {{ timelineActionMetaText }}
        </span>
      </div>
    </div>
  </div>
</template>
