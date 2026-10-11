<script setup lang="ts">
// "当前页": shows what the current X page offers, driven by the feature route stack (store.ts).
// Same data logic as the classic FeatureTab; only presentation and copy differ.
import { computed, nextTick, ref, watch } from 'vue';
import type { Media, Post, User } from '../../archive/model';
import {
  dbVersion, getDbPost, getDbUser, getDisplayPost, getMediaForPost, getParentChain, getRemoteSyncStatus, getReplies,
} from '../../lib/db-service';
import {
  HOME_FEATURE_TIMELINES, getFeatureTimelineNamespace, isHomeFeatureTimelineSource, type FeatureTimelineSort, type FeatureTimelineSource,
} from '../../lib/feature-timeline';
import { getConfig, updateConfig, type HomeFeedView } from '../../lib/config-service';
import { getPostOpenUrl, getUserOpenUrl } from '../../lib/post-view';
import { isRemoteDbReady } from '../../lib/remote-db';
import {
  featureNavigateTo, featureNavigateToIndex, featureRoute, featureStackView, setActiveTab, type FeatureRoute,
} from '../../lib/store';
import {
  getTimelineFirstPageIdByAlias, getTimelinePagesByAlias, getTimelinePostIdsByAlias, getTimelineVersionByAlias,
} from '../../lib/timeline-store';
import { GM_openInTab } from '$';
import { PAGE_KINDS, SYNC_STATUS_ORDER, SYNC_STATUS_TITLES, formatClock, timelineLabel, timelineNavTitle } from '../labels';
import { HOME_FEED_OPTIONS } from '../settings-labels';
import { feedStateKey, getFeedState, goToFeedPage, pauseFeed, resetFeedState, resumeFeed } from '../feed-state';
import { useShimmer } from '../composables/useShimmer';
import { useTimelineSelection } from '../composables/useTimelineSelection';
import PostDetail from '../components/PostDetail.vue';
import UserProfile from '../components/UserProfile.vue';
import XmBanner from '../components/XmBanner.vue';
import XmEmpty from '../components/XmEmpty.vue';
import XmIcon from '../components/XmIcon.vue';
import XmNavBar, { type XmCrumb } from '../components/XmNavBar.vue';
import XmPostRow from '../components/XmPostRow.vue';
import XmSegmented from '../components/XmSegmented.vue';
import XmSyncMark from '../components/XmSyncMark.vue';
import type { IconName } from '../icons';

interface TimelineItem {
  /** Timeline entry id: the repost itself for reposts. */
  id: string;
  post: Post;
  author: User | undefined;
  media: Media[];
  repostedBy?: User;
  /** Page where the entry first appeared (repeat rows only). */
  firstPageId?: number;
}

interface TimelineContext {
  source: FeatureTimelineSource;
  scope?: string;
  sort?: FeatureTimelineSort;
}

const route = featureRoute;
const cfg = getConfig();

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

function buildItems(ids: string[]): TimelineItem[] {
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

/** Flat list (everything except the paged home feed). */
const timelineItems = computed(() => {
  if (route.value.page !== 'timeline' || paged.value) return [];
  void dbVersion.value;
  const namespace = getFeatureTimelineNamespace(route.value.source, route.value.sort);
  const scope = route.value.scope ?? null;
  void getTimelineVersionByAlias(namespace, scope);
  return buildItems(getTimelinePostIdsByAlias(namespace, scope));
});

// ---- home feed paging (SPEC §4) ----

const homeFeed = computed(() => {
  const value = route.value;
  if (value.page !== 'timeline' || !isHomeFeatureTimelineSource(value.source)) return null;
  const namespace = getFeatureTimelineNamespace(value.source, value.sort);
  const scope = value.scope ?? null;
  return { namespace, scope, key: feedStateKey(namespace, scope) };
});
const feed = computed(() => getFeedState(homeFeed.value?.key ?? ''));
/** Captured pages in capture order (fresh array each version so dependants re-run). */
const feedPages = computed(() => {
  const target = homeFeed.value;
  if (!target) return [];
  void getTimelineVersionByAlias(target.namespace, target.scope);
  return getTimelinePagesByAlias(target.namespace, target.scope).slice();
});
const showPager = computed(() => homeFeed.value !== null && feedPages.value.length > 0);
const paged = computed(() => showPager.value && cfg.homeFeedView === 'paged');
const latestId = computed(() => feedPages.value[feedPages.value.length - 1]?.id ?? 0);
const currentId = computed(() => {
  if (feed.value.follow || !feedPages.value.some((page) => page.id === feed.value.pinnedPageId)) return latestId.value;
  return feed.value.pinnedPageId;
});
const currentIndex = computed(() => feedPages.value.findIndex((page) => page.id === currentId.value));
const currentPage = computed(() => feedPages.value[currentIndex.value]);
const prevPageEntry = computed(() => feedPages.value[currentIndex.value - 1]);
const nextPageEntry = computed(() => feedPages.value[currentIndex.value + 1]);
/** Page menu "新": arrived while paused and not opened since. Pages captured before the panel was looked at are not new. */
function isUnseenNewPage(pageId: number): boolean {
  return !feed.value.follow && pageId > feed.value.pausedAtLatestId && !feed.value.seenPageIds.has(pageId);
}

const pendingPages = computed(() => (paged.value && !feed.value.follow
  ? feedPages.value.filter((page) => page.id > feed.value.pausedAtLatestId)
  : []));
const pillText = computed(() => {
  const pages = pendingPages.value;
  const posts = pages.reduce((sum, page) => sum + page.newPostIds.length, 0);
  return pages.length === 1 ? `新页面 · 第 ${pages[0].id} 页 · ${posts} 条` : `${pages.length} 个新页面 · ${posts} 条`;
});
const pageKind = computed(() => PAGE_KINDS[currentPage.value?.kind ?? 'newer']);
const repeatCount = computed(() => (currentPage.value ? currentPage.value.postIds.length - currentPage.value.newPostIds.length : 0));
const pageInfoText = computed(() => {
  const page = currentPage.value;
  if (!page) return '';
  return repeatCount.value > 0 ? `${page.newPostIds.length} 条 · ${repeatCount.value} 重复` : `${page.newPostIds.length} 条`;
});
const pageInfoTitle = computed(() => {
  const page = currentPage.value;
  if (!page) return '';
  return `捕获于 ${formatClock(page.capturedAt)}${page.kind === 'older' && page.continues ? ` · 接第 ${page.continues} 页` : ''}`;
});
const flatCount = computed(() => {
  const target = homeFeed.value;
  if (!target) return timelineItems.value.length;
  void getTimelineVersionByAlias(target.namespace, target.scope);
  return getTimelinePostIdsByAlias(target.namespace, target.scope).length;
});

/** Posts first seen on the current page. */
const pageItems = computed(() => {
  if (!paged.value || !currentPage.value) return [];
  void dbVersion.value;
  return buildItems(currentPage.value.newPostIds);
});
/** Posts the current page's response repeated from earlier pages. */
const repeatItems = computed(() => {
  const page = currentPage.value;
  const target = homeFeed.value;
  if (!paged.value || !page || !target || repeatCount.value === 0) return [];
  void dbVersion.value;
  const fresh = new Set(page.newPostIds);
  return buildItems(page.postIds.filter((id) => !fresh.has(id)))
    .map((item) => ({ ...item, firstPageId: getTimelineFirstPageIdByAlias(target.namespace, target.scope, item.id) }));
});
const repeatsOpen = computed(() => feed.value.repeatsOpen.has(currentId.value));

const bodyEl = ref<HTMLElement | null>(null);
const menuEl = ref<HTMLElement | null>(null);
const labelEl = ref<HTMLElement | null>(null);
const menuOpen = ref(false);
const labelShimmer = useShimmer();
let ignoreScrollUntil = 0;

/** Programmatic scroll to top; the scroll events it causes must not pause following. */
function scrollBodyTop(): void {
  ignoreScrollUntil = performance.now() + 200;
  if (bodyEl.value) bodyEl.value.scrollTop = 0;
}

function pauseCurrent(): void {
  if (paged.value) pauseFeed(feed.value, currentId.value, latestId.value);
}

function goToPage(pageId: number): void {
  goToFeedPage(feed.value, pageId, currentId.value, latestId.value);
}

function resume(): void {
  resumeFeed(feed.value);
  scrollBodyTop();
}

function toggleFollow(): void {
  if (feed.value.follow) pauseCurrent();
  else resume();
}

function onBodyScroll(): void {
  if (!paged.value || !feed.value.follow || performance.now() < ignoreScrollUntil) return;
  if ((bodyEl.value?.scrollTop ?? 0) > 24) pauseCurrent();
}

function toggleRepeats(): void {
  const open = feed.value.repeatsOpen;
  if (open.has(currentId.value)) open.delete(currentId.value);
  else open.add(currentId.value);
}

function setHomeFeedView(value: HomeFeedView): void {
  updateConfig({ homeFeedView: value });
}

function openMenu(): void {
  menuOpen.value = true;
  void nextTick(() => {
    const current = menuEl.value?.querySelector<HTMLElement>('[aria-current="true"]');
    current?.focus({ preventScroll: true });
    current?.scrollIntoView({ block: 'nearest' });
  });
}

function closeMenu(refocus = false): void {
  menuOpen.value = false;
  if (refocus) void nextTick(() => labelEl.value?.focus());
}

function pickPage(pageId: number): void {
  goToPage(pageId);
  closeMenu(true);
}

/** Esc closes the page menu first; the shell's Esc (collapse) only sees the event when nothing is open. */
function onViewKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !menuOpen.value) return;
  event.stopPropagation();
  closeMenu(true);
}

// New page while following: shimmer the page label (view is mounted = visible). Cleared timeline: forget old state.
watch(() => [homeFeed.value?.key, latestId.value] as const, ([key, now], [previousKey, before]) => {
  if (!homeFeed.value) return;
  const state = feed.value;
  if (now < state.pausedAtLatestId || now === 0 || (!state.follow && now < state.pinnedPageId)) {
    resetFeedState(state);
    return;
  }
  if (key === previousKey && paged.value && state.follow && before > 0 && now > before) labelShimmer.trigger();
});

// Mark pages as seen: the current page when paged, every page in continuous mode.
watch([currentId, latestId, paged, showPager, () => homeFeed.value?.key], () => {
  if (!showPager.value) return;
  const seen = feed.value.seenPageIds;
  if (paged.value) seen.add(currentId.value);
  else for (const page of feedPages.value) seen.add(page.id);
}, { immediate: true });

// A page change shows the top of the new page.
watch(currentId, () => { void nextTick(scrollBodyTop); });
watch([paged, () => homeFeed.value?.key], () => { menuOpen.value = false; });

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
  pauseCurrent();
  const context = getRouteTimelineContext(route.value);
  featureNavigateTo(context ? { page: 'tweet', tweetId: postId, ...context } : { page: 'tweet', tweetId: postId });
}

function openUser(userId: string): void {
  pauseCurrent();
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
/** Items of the list being shown: the current page's new posts when paged, else the flat list. */
const visibleItems = computed(() => (paged.value ? pageItems.value : timelineItems.value));
// Selection is per page: changing the page (or the display mode) starts a fresh selection.
const routeKey = computed(() => {
  if (route.value.page !== 'timeline') return 'inactive';
  return `${route.value.source}:${route.value.scope ?? ''}:${route.value.sort ?? ''}:${paged.value ? currentId.value : ''}`;
});
const entryIds = computed(() => visibleItems.value.map((item) => item.id));
const selection = useTimelineSelection(entryIds, routeKey, remoteActions);
// Entering selection mode pauses following (the page must not change under the selection).
watch(selection.active, (on) => { if (on) pauseCurrent(); });

const syncSummary = computed(() => {
  const counts = new Map<string, number>();
  for (const item of visibleItems.value) {
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
  <div class="xm-view" data-view="current" @keydown="onViewKeydown">
    <!-- No usable feature on this page -->
    <div v-if="route.page === 'none'" class="xm-body">
      <XmEmpty icon="page" title="此页面没有可采集的列表" hint="打开个人主页、书签、喜欢、搜索结果、首页或帖子详情，这里会显示捕获到的内容。" />
    </div>

    <!-- Home entries -->
    <template v-else>
      <XmNavBar :crumbs="crumbs" :back="back" :title="navTitle.title" :subtitle="navTitle.subtitle">
        <span v-if="route.page === 'timeline'" class="xm-navbar__meta xm-num" data-role="count">{{ paged ? `${feedPages.length} 页 · ` : '' }}{{ flatCount }} 条</span>
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
        <!-- Home feed: pager row (paged) or the continuous-mode bar -->
        <div v-if="showPager && paged && currentPage" class="xm-pager" data-role="pager">
          <button type="button" class="xm-iconbtn" title="上一页" aria-label="上一页" data-role="page-prev" :disabled="!prevPageEntry" @click="goToPage(prevPageEntry!.id)"><XmIcon name="back" /></button>
          <button
            ref="labelEl" type="button" class="xm-pager__label" :class="{ 'xm-shimmer': labelShimmer.active.value }"
            title="选择页面" aria-haspopup="true" :aria-expanded="menuOpen" data-role="page-label" @click="menuOpen ? closeMenu() : openMenu()"
          >第 {{ currentId }} 页<small>/ {{ feedPages.length }}</small><XmIcon name="chev-d" class="xm-ico--sm" /></button>
          <button
            type="button" class="xm-iconbtn" :class="{ 'xm-iconbtn--dot': pendingPages.length > 0 }" title="下一页" aria-label="下一页"
            data-role="page-next" :disabled="!nextPageEntry" @click="goToPage(nextPageEntry!.id)"
          ><XmIcon name="chev-r" /></button>
          <div class="xm-pager__info" :title="pageInfoTitle" data-role="page-info">
            <span class="xm-pager__kind"><XmIcon :name="pageKind.icon" /><span class="xm-pager__kind-text">{{ pageKind.label }}</span></span><span>{{ pageInfoText }}</span>
          </div>
          <button
            type="button" class="xm-follow" :class="{ 'xm-follow--on': feed.follow }" data-role="follow"
            :title="feed.follow ? '新页面到达时自动翻到最新页，点击暂停' : '点击回到最新页并恢复跟随'" @click="toggleFollow"
          >{{ feed.follow ? '跟随' : '已暂停' }}</button>
        </div>
        <div v-else-if="showPager" class="xm-pager xm-pager--bar" data-role="pager-continuous">
          <div class="xm-pager__info"><span class="xm-pager__kind"><XmIcon name="pages" />连续浏览</span><span>共 {{ feedPages.length }} 页</span></div>
          <button type="button" class="xm-btn xm-btn--sm xm-btn--ghost" data-role="to-paged" @click="setHomeFeedView('paged')">按页浏览</button>
        </div>

        <div ref="bodyEl" class="xm-body" @scroll.passive="onBodyScroll">
          <div v-if="pendingPages.length > 0" class="xm-newpill-wrap">
            <button :key="latestId" type="button" class="xm-newpill xm-shimmer" data-role="new-pill" @click="resume"><XmIcon name="arrow-up" />{{ pillText }}</button>
          </div>
          <XmEmpty
            v-if="!paged && timelineItems.length === 0"
            icon="page"
            :title="`正在等待「${waitingLabel}」数据`"
            hint="在页面上滚动以加载帖子"
          />
          <XmPostRow
            v-for="item in visibleItems"
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
          <template v-if="paged && currentPage">
            <div
              v-if="repeatCount > 0" class="xm-repeats" role="button" tabindex="0" :aria-expanded="repeatsOpen" data-role="repeats"
              @click="toggleRepeats" @keydown.enter.prevent="toggleRepeats" @keydown.space.prevent="toggleRepeats"
            >
              <XmIcon name="chev-d" class="xm-ico--sm" :style="repeatsOpen ? { transform: 'rotate(180deg)' } : undefined" />另有 {{ repeatCount }} 条已在前面的页出现
            </div>
            <template v-if="repeatsOpen">
              <XmPostRow
                v-for="item in repeatItems"
                :key="`repeat:${item.id}`"
                class="xm-post--repeat"
                :post="item.post"
                :author="item.author"
                :media="item.media"
                :reposted-by="item.repostedBy"
                :sync-status="getRemoteSyncStatus(item.id)"
                @select="selection.active.value ? undefined : openTweet(item.post.id)"
                @open-media="openMedia"
              >
                <template #head-extra>
                  <button v-if="item.firstPageId" type="button" class="xm-post__repeat-chip" data-role="repeat-chip" @click.stop="goToPage(item.firstPageId)">见第 {{ item.firstPageId }} 页</button>
                </template>
              </XmPostRow>
            </template>
            <div class="xm-pageend" data-role="page-end">
              第 {{ currentId }} 页到底了
              <template v-if="nextPageEntry">
                <br><button type="button" class="xm-btn xm-btn--sm" data-role="page-end-next" @click="goToPage(nextPageEntry.id)">下一页 · 第 {{ nextPageEntry.id }} 页<XmIcon name="chev-r" class="xm-ico--sm" /></button>
              </template>
            </div>
          </template>
        </div>

        <!-- Page menu (F16) -->
        <template v-if="menuOpen && paged">
          <div class="xm-scrim" @click="closeMenu()"></div>
          <div ref="menuEl" class="xm-menu" role="group" aria-label="页列表" data-role="page-menu" style="left: 38px; top: 72px">
            <div class="xm-menu__head">
              <span>共 {{ feedPages.length }} 页 · {{ flatCount }} 条</span>
              <XmSegmented :model-value="cfg.homeFeedView" :options="HOME_FEED_OPTIONS" aria-label="显示方式" data-role="home-feed" @update:model-value="setHomeFeedView" />
            </div>
            <button
              v-for="entry in [...feedPages].reverse()"
              :key="entry.id"
              type="button"
              class="xm-menu__item"
              :aria-current="entry.id === currentId ? 'true' : undefined"
              :data-page="entry.id"
              @click="pickPage(entry.id)"
            >
              <span class="xm-menu__num">第 {{ entry.id }} 页</span>
              <span class="xm-menu__kind"><XmIcon :name="PAGE_KINDS[entry.kind].icon" />{{ PAGE_KINDS[entry.kind].label }}</span>
              <span class="xm-menu__time">{{ formatClock(entry.capturedAt) }}</span>
              <span class="xm-menu__count">{{ entry.newPostIds.length }} 条</span>
              <span v-if="isUnseenNewPage(entry.id)" class="xm-menu__new">新</span>
            </button>
          </div>
        </template>

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
            <div class="xm-footer__meta"><span>已选 <strong class="xm-num">{{ selection.selectedCount.value }}</strong> / {{ paged ? '本页 ' : '' }}{{ visibleItems.length }}</span></div>
            <button type="button" class="xm-btn xm-btn--ghost" :disabled="visibleItems.length === 0" @click="selection.toggleAll()">{{ selection.allSelected.value ? '取消全选' : '全选' }}</button>
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
