<script setup lang="ts">
// "当前页": shows what the current X page offers, driven by the feature route stack (store.ts).
// Same data logic as the classic FeatureTab; only presentation and copy differ.
import { computed } from 'vue';
import type { Media, Post, User } from '../../archive/model';
import {
  dbVersion, getDbPost, getDbUser, getDisplayPost, getMediaForPost, getParentChain, getRemoteSyncStatus, getReplies,
} from '../../lib/db-service';
import {
  HOME_FEATURE_TIMELINES, getFeatureTimelineNamespace, type FeatureTimelineSort, type FeatureTimelineSource,
} from '../../lib/feature-timeline';
import { getPostOpenUrl, getUserOpenUrl } from '../../lib/post-view';
import { isRemoteDbReady } from '../../lib/remote-db';
import {
  featureNavigateTo, featureNavigateToIndex, featureRoute, featureStackView, setActiveTab, type FeatureRoute,
} from '../../lib/store';
import { getTimelinePostIdsByAlias, getTimelineVersionByAlias } from '../../lib/timeline-store';
import { GM_openInTab } from '$';
import { SYNC_STATUS_ORDER, SYNC_STATUS_TITLES, timelineLabel, timelineNavTitle } from '../labels';
import { useTimelineSelection } from '../composables/useTimelineSelection';
import PostDetail from '../components/PostDetail.vue';
import UserProfile from '../components/UserProfile.vue';
import XmBanner from '../components/XmBanner.vue';
import XmEmpty from '../components/XmEmpty.vue';
import XmIcon from '../components/XmIcon.vue';
import XmNavBar, { type XmCrumb } from '../components/XmNavBar.vue';
import XmPostRow from '../components/XmPostRow.vue';
import XmSyncMark from '../components/XmSyncMark.vue';
import type { IconName } from '../icons';

interface TimelineItem {
  /** Timeline entry id: the repost itself for reposts. */
  id: string;
  post: Post;
  author: User | undefined;
  media: Media[];
  repostedBy?: User;
}

interface TimelineContext {
  source: FeatureTimelineSource;
  scope?: string;
  sort?: FeatureTimelineSort;
}

const route = featureRoute;

// ---- data ----

function getRoutePost(postId: string): Post | null {
  const post = getDbPost(postId);
  return post ? getDisplayPost(post) : null;
}

function getRouteTimelineContext(value: FeatureRoute): TimelineContext | null {
  if (value.page === 'timeline' || ((value.page === 'tweet' || value.page === 'user') && value.source)) {
    return { source: value.source!, scope: value.scope, sort: value.sort };
  }
  return null;
}

function buildTimelineItems(context: TimelineContext): TimelineItem[] {
  const ids = getTimelinePostIdsByAlias(getFeatureTimelineNamespace(context.source, context.sort), context.scope ?? null);
  return ids.flatMap((id) => {
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

const timelineItems = computed(() => {
  if (route.value.page !== 'timeline') return [];
  void dbVersion.value;
  const context = { source: route.value.source, scope: route.value.scope, sort: route.value.sort };
  void getTimelineVersionByAlias(getFeatureTimelineNamespace(context.source, context.sort), context.scope ?? null);
  return buildTimelineItems(context);
});

const homeEntries = computed(() => HOME_FEATURE_TIMELINES.map(({ source, sort }) => {
  const namespace = getFeatureTimelineNamespace(source, sort);
  void getTimelineVersionByAlias(namespace);
  const icon: IconName = source === 'home-timeline' ? 'sparkle' : sort === 'popular' ? 'flame' : 'people';
  return { namespace, source, sort, icon, label: timelineLabel(source, sort), count: getTimelinePostIdsByAlias(namespace).length };
}));

const focalPost = computed(() => {
  void dbVersion.value;
  return route.value.page === 'status' ? getRoutePost(route.value.tweetId) : null;
});
const focalParents = computed(() => {
  void dbVersion.value;
  return focalPost.value ? getParentChain(focalPost.value.id) : [];
});
const focalReplies = computed(() => {
  void dbVersion.value;
  return focalPost.value ? getReplies(focalPost.value.id) : [];
});
const focalRemoteSyncPosts = computed(() => focalPost.value ? [...focalParents.value, focalPost.value, ...focalReplies.value] : []);

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

// ---- navigation ----

function openTweet(postId: string): void {
  const context = getRouteTimelineContext(route.value);
  featureNavigateTo(context ? { page: 'tweet', tweetId: postId, ...context } : { page: 'tweet', tweetId: postId });
}

function openUser(userId: string): void {
  const context = getRouteTimelineContext(route.value);
  featureNavigateTo(context ? { page: 'user', userId, ...context } : { page: 'user', userId });
}

function openHomeTimeline(source: FeatureTimelineSource, sort?: FeatureTimelineSort): void {
  featureNavigateTo({ page: 'timeline', source, sort });
}

function openMedia(url: string): void {
  GM_openInTab(url, { active: true });
}

function openOriginal(post: Post): void {
  GM_openInTab(getPostOpenUrl(post, getDbUser(post.authorId)), { active: true });
}

function openProfile(user: User): void {
  GM_openInTab(getUserOpenUrl(user), { active: true });
}

function routeLabel(value: FeatureRoute): string {
  switch (value.page) {
    case 'home-root': return '首页';
    case 'timeline': return timelineNavTitle(value.source, value.scope, value.sort).title;
    case 'status': return '帖子详情';
    case 'tweet': return '帖子';
    case 'user': return '用户';
    default: return '';
  }
}

const depth = computed(() => featureStackView.value.length);
const crumbs = computed<XmCrumb[]>(() => featureStackView.value.map((entry, index, all) => ({
  label: routeLabel(entry),
  onClick: index < all.length - 1 ? () => featureNavigateToIndex(index) : undefined,
})));
const back = computed(() => (depth.value > 1 ? () => featureNavigateToIndex(depth.value - 2) : undefined));

const navTitle = computed<{ title: string; subtitle?: string }>(() => {
  const value = route.value;
  if (value.page === 'timeline') return timelineNavTitle(value.source, value.scope, value.sort);
  return { title: routeLabel(value) };
});

const waitingLabel = computed(() => (route.value.page === 'timeline' ? timelineLabel(route.value.source, route.value.sort) : ''));

// ---- timeline footer, selection and submit ----

const remoteActions = computed(() => route.value.page === 'timeline' && isRemoteDbReady());
const routeKey = computed(() => {
  if (route.value.page !== 'timeline') return 'inactive';
  return `${route.value.source}:${route.value.scope ?? ''}:${route.value.sort ?? ''}`;
});
const entryIds = computed(() => timelineItems.value.map((item) => item.id));
const selection = useTimelineSelection(entryIds, routeKey, remoteActions);

const syncSummary = computed(() => {
  const counts = new Map<string, number>();
  for (const item of timelineItems.value) {
    const status = getRemoteSyncStatus(item.id);
    if (status) counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return SYNC_STATUS_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => ({ status, count: counts.get(status)! }));
});

const bannerAction = computed(() => (selection.banner.value?.openSettings
  ? { label: '打开设置', onClick: () => setActiveTab('settings') }
  : undefined));

function selectItem(item: TimelineItem): void {
  if (selection.active.value && remoteActions.value) selection.toggle(item.id);
  else openTweet(item.post.id);
}
</script>

<template>
  <div class="xm-view" data-view="current">
    <!-- No usable feature on this page -->
    <div v-if="route.page === 'none'" class="xm-body">
      <XmEmpty icon="page" title="此页面没有可采集的列表" hint="打开个人主页、书签、喜欢、搜索结果、首页或帖子详情，这里会显示捕获到的内容。" />
    </div>

    <!-- Home entries -->
    <template v-else>
      <XmNavBar :crumbs="crumbs" :back="back" :title="navTitle.title" :subtitle="navTitle.subtitle">
        <span v-if="route.page === 'timeline'" class="xm-navbar__meta xm-num" data-role="count">{{ timelineItems.length }} 条</span>
        <button
          v-else-if="route.page === 'status' && focalPost"
          type="button" class="xm-iconbtn" title="在 X 打开" aria-label="在 X 打开" @click="openOriginal(focalPost)"
        ><XmIcon name="external" /></button>
        <button
          v-else-if="route.page === 'tweet' && detailPost"
          type="button" class="xm-iconbtn" title="在 X 打开" aria-label="在 X 打开" @click="openOriginal(detailPost)"
        ><XmIcon name="external" /></button>
        <button
          v-else-if="route.page === 'user' && detailUser"
          type="button" class="xm-iconbtn" title="在 X 打开主页" aria-label="在 X 打开主页" @click="openProfile(detailUser)"
        ><XmIcon name="external" /></button>
      </XmNavBar>

      <div v-if="route.page === 'home-root'" class="xm-body">
        <div
          v-for="entry in homeEntries"
          :key="entry.namespace"
          class="xm-entry"
          role="button"
          tabindex="0"
          :aria-label="`${entry.label}，${entry.count} 条`"
          @click="openHomeTimeline(entry.source, entry.sort)"
          @keydown.enter.prevent="openHomeTimeline(entry.source, entry.sort)"
          @keydown.space.prevent="openHomeTimeline(entry.source, entry.sort)"
        >
          <div class="xm-entry__icon"><XmIcon :name="entry.icon" /></div>
          <div class="xm-entry__main"><div class="xm-entry__title">{{ entry.label }}</div></div>
          <div class="xm-entry__side">
            <span class="xm-num" :style="entry.count === 0 ? { color: 'var(--xm-text-3)' } : undefined">{{ entry.count }} 条</span>
            <XmIcon name="chev-r" class="xm-ico--sm" />
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <template v-else-if="route.page === 'timeline'">
        <div class="xm-body">
          <XmEmpty
            v-if="timelineItems.length === 0"
            icon="page"
            :title="`正在等待「${waitingLabel}」数据`"
            hint="在页面上滚动以加载帖子"
          />
          <XmPostRow
            v-for="item in timelineItems"
            :key="item.id"
            :post="item.post"
            :author="item.author"
            :media="item.media"
            :reposted-by="item.repostedBy"
            :sync-status="getRemoteSyncStatus(item.id)"
            :selecting="selection.active.value"
            :selected="selection.selected.has(item.id)"
            @select="selectItem(item)"
            @open-media="openMedia"
          />
        </div>

        <XmBanner
          v-if="selection.banner.value"
          class="xm-banner--dock"
          :tone="selection.banner.value.tone"
          :title="selection.banner.value.title"
          :text="selection.banner.value.text"
          :action="bannerAction"
          @close="selection.dismissBanner()"
        />
        <template v-if="remoteActions">
          <div v-if="selection.active.value" class="xm-footer" data-role="select-footer">
            <button type="button" class="xm-iconbtn" title="退出选择" aria-label="退出选择" @click="selection.toggleMode()"><XmIcon name="x" /></button>
            <div class="xm-footer__meta"><span>已选 <strong class="xm-num">{{ selection.selectedCount.value }}</strong> / {{ timelineItems.length }}</span></div>
            <button type="button" class="xm-btn xm-btn--ghost" :disabled="timelineItems.length === 0" @click="selection.toggleAll()">{{ selection.allSelected.value ? '取消全选' : '全选' }}</button>
            <button type="button" class="xm-btn xm-btn--primary" :disabled="selection.submitDisabled.value" data-role="submit" @click="selection.submit()">
              <XmIcon name="upload" class="xm-ico--sm" />{{ selection.submitting.value ? '提交中…' : `提交 ${selection.selectedCount.value} 条` }}
            </button>
          </div>
          <div v-else class="xm-footer" data-role="sync-footer">
            <div class="xm-footer__meta">
              <span v-for="entry in syncSummary" :key="entry.status" class="xm-legend" :title="SYNC_STATUS_TITLES[entry.status]">
                <XmSyncMark :status="entry.status" /><span class="xm-num">{{ entry.count }}</span>
              </span>
            </div>
            <button type="button" class="xm-btn" data-role="select-mode" @click="selection.toggleMode()"><XmIcon name="check" class="xm-ico--sm" />批量选择</button>
          </div>
        </template>
      </template>

      <!-- Post detail (status page / opened from a list) -->
      <div v-else-if="route.page === 'status'" class="xm-body">
        <XmEmpty v-if="!focalPost" icon="page" title="正在等待帖子数据" hint="在页面上滚动以加载帖子" />
        <PostDetail
          v-else
          :post="focalPost"
          :parents="focalParents"
          :replies="focalReplies"
          show-parents
          :batch-sync-posts="focalRemoteSyncPosts"
          @open-tweet="openTweet"
          @open-user="openUser"
          @open-media="openMedia"
        />
      </div>

      <div v-else-if="route.page === 'tweet'" class="xm-body">
        <XmEmpty v-if="!detailPost" icon="page" title="未找到该帖子" />
        <PostDetail
          v-else
          :post="detailPost"
          :replies="detailReplies"
          :batch-sync-posts="detailRemoteSyncPosts"
          @open-tweet="openTweet"
          @open-user="openUser"
          @open-media="openMedia"
        />
      </div>

      <div v-else-if="route.page === 'user'" class="xm-body">
        <XmEmpty v-if="!detailUser" icon="user" title="未找到该用户" />
        <UserProfile v-else :user="detailUser" />
      </div>
    </template>
  </div>
</template>
