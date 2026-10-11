<script lang="ts">
import { ref } from 'vue';

/** Filter text outlives the view so it survives opening a detail and coming back (and switching tabs). */
const filterText = ref('');
</script>

<script setup lang="ts">
// "已捕获": the local database as a filterable list, driven by the database route stack (store.ts).
// Same data logic as the classic DatabaseTab; the filter and the two-step clear are new.
import { computed, watch } from 'vue';
import type { Media, Post, User } from '../../archive/model';
import { clearCaptureState } from '../../lib/capture-state-service';
import {
  dbVersion, getDbPost, getDbUser, getDisplayPost, getMediaForPost, getRemoteSyncStatus, getReplies,
} from '../../lib/db-service';
import { getPlainText, getPostOpenUrl, getUserOpenUrl } from '../../lib/post-view';
import { dbNavigateTo, dbNavigateToIndex, dbRoute, dbStackView, type DbRoute } from '../../lib/store';
import { GM_openInTab } from '$';
import { capturedPosts } from '../captured-posts';
import { useConfirm } from '../composables/useConfirm';
import PostDetail from '../components/PostDetail.vue';
import UserProfile from '../components/UserProfile.vue';
import XmCompactRow from '../components/XmCompactRow.vue';
import XmEmpty from '../components/XmEmpty.vue';
import XmIcon from '../components/XmIcon.vue';
import XmNavBar, { type XmCrumb } from '../components/XmNavBar.vue';

interface CapturedItem {
  post: Post;
  author: User | undefined;
  media: Media[];
  /** Lower-cased search text: body (or article title), name, @handle. */
  haystack: string;
}

const route = dbRoute;
const confirm = useConfirm(5000);

// ---- data ----

const items = computed<CapturedItem[]>(() => capturedPosts.value.map((post) => {
  const author = getDbUser(post.authorId);
  const text = getPlainText(post.text) || post.article?.title || '';
  return {
    post,
    author,
    media: getMediaForPost(post),
    haystack: `${text}\n${author?.name ?? ''}\n@${author?.handle ?? ''}`.toLowerCase(),
  };
}));

const query = computed(() => filterText.value.trim().toLowerCase());
const filtered = computed(() => (query.value ? items.value.filter((item) => item.haystack.includes(query.value)) : items.value));
const metaText = computed(() => (query.value ? `${filtered.value.length} / ${items.value.length}` : String(items.value.length)));

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
const detailRemoteSyncPosts = computed(() => (detailPost.value ? [detailPost.value, ...detailReplies.value] : []));
const detailUser = computed(() => {
  void dbVersion.value;
  return route.value.page === 'user' ? getDbUser(route.value.userId) ?? null : null;
});

// ---- navigation ----

function openTweet(id: string): void {
  dbNavigateTo({ page: 'tweet', tweetId: id });
}

function openUser(id: string): void {
  dbNavigateTo({ page: 'user', userId: id });
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

function routeLabel(value: DbRoute): string {
  switch (value.page) {
    case 'list': return '全部帖子';
    case 'tweet': return '帖子';
    case 'user': return '用户';
    default: return '';
  }
}

const depth = computed(() => dbStackView.value.length);
const crumbs = computed<XmCrumb[]>(() => dbStackView.value.map((entry, index, all) => ({
  label: routeLabel(entry),
  onClick: index < all.length - 1 ? () => dbNavigateToIndex(index) : undefined,
})));
const back = computed(() => (depth.value > 1 ? () => dbNavigateToIndex(depth.value - 2) : undefined));

// ---- clear ----

function clearAll(): void {
  confirm.cancel();
  filterText.value = '';
  clearCaptureState();
}

watch(() => route.value.page, confirm.cancel);
</script>

<template>
  <div class="xm-view" data-view="captured">
    <!-- List: filter toolbar instead of a navbar -->
    <template v-if="route.page === 'list'">
      <div class="xm-toolbar">
        <label class="xm-search">
          <XmIcon name="search" class="xm-ico--sm" />
          <input
            v-model="filterText"
            class="xm-input"
            type="text"
            data-role="filter"
            placeholder="筛选正文、作者或 @用户名"
            aria-label="筛选正文、作者或 @用户名"
            autocomplete="off"
            spellcheck="false"
          >
          <button
            v-if="filterText"
            type="button"
            class="xm-iconbtn xm-iconbtn--sm xm-search__clear"
            title="清除筛选"
            aria-label="清除筛选"
            @click="filterText = ''"
          ><XmIcon name="x" class="xm-ico--sm" /></button>
        </label>
        <span class="xm-toolbar__meta" data-role="count">{{ metaText }}</span>
      </div>

      <div class="xm-body">
        <XmEmpty v-if="items.length === 0" icon="captured" title="还没有捕获任何帖子" hint="浏览 X 时，支持的页面会自动捕获。" />
        <XmEmpty v-else-if="filtered.length === 0" icon="search" title="没有匹配的帖子" />
        <XmCompactRow
          v-for="item in filtered"
          :key="item.post.id"
          :post="item.post"
          :author="item.author"
          :media="item.media"
          :sync-status="getRemoteSyncStatus(item.post.id)"
          @select="openTweet(item.post.id)"
        />
      </div>

      <div class="xm-footer" data-role="footer">
        <div class="xm-footer__meta"><span><strong class="xm-num">{{ items.length }}</strong> 条帖子</span></div>
        <template v-if="confirm.pending.value">
          <span class="xm-confirm__ask">清空全部？</span>
          <button type="button" class="xm-btn xm-btn--ghost" data-role="clear-cancel" @click="confirm.cancel()">取消</button>
          <button type="button" class="xm-btn xm-btn--danger-solid" data-role="clear-confirm" @click="clearAll()">
            <XmIcon name="trash" class="xm-ico--sm" />清空
          </button>
        </template>
        <button v-else type="button" class="xm-btn xm-btn--danger" data-role="clear" :disabled="items.length === 0" @click="confirm.ask()">
          <XmIcon name="trash" class="xm-ico--sm" />清空
        </button>
      </div>
    </template>

    <!-- Detail routes -->
    <template v-else>
      <XmNavBar :crumbs="crumbs" :back="back">
        <button
          v-if="route.page === 'tweet' && detailPost"
          type="button" class="xm-iconbtn" title="在 X 打开" aria-label="在 X 打开" @click="openOriginal(detailPost)"
        ><XmIcon name="external" /></button>
        <button
          v-else-if="route.page === 'user' && detailUser"
          type="button" class="xm-iconbtn" title="在 X 打开主页" aria-label="在 X 打开主页" @click="openProfile(detailUser)"
        ><XmIcon name="external" /></button>
      </XmNavBar>

      <div v-if="route.page === 'tweet'" class="xm-body">
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

<style scoped>
.xm-search__clear { position: absolute; right: 2px; top: 3px; }
.xm-search:has(.xm-search__clear) .xm-input { padding-right: 28px; }
.xm-confirm__ask { font-size: var(--xm-fs-xs); color: var(--xm-danger); font-weight: 600; white-space: nowrap; }
</style>
