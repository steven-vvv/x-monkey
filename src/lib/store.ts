import { reactive, computed, ref } from 'vue';
import { unsafeWindow } from '$';
import {
  getFeatureTimelineLabel,
  getFeatureTimelineNamespace,
  type FeatureTimelineSort,
  type FeatureTimelineSource,
} from './feature-timeline';
import { getTimelineCreatedOrderByAlias } from './timeline-store';

export type TabId = 'feature' | 'database' | 'settings' | 'tools';

interface FeatureTimelineContext {
  source?: FeatureTimelineSource;
  username?: string;
  sort?: FeatureTimelineSort;
}

export type FeatureRoute =
  | { page: 'status'; tweetId: string }
  | { page: 'home-root' }
  | ({ page: 'timeline' } & Required<Pick<FeatureTimelineContext, 'source'>> & Pick<FeatureTimelineContext, 'username' | 'sort'>)
  | ({ page: 'tweet'; tweetId: string } & FeatureTimelineContext)
  | ({ page: 'user'; userId: string } & FeatureTimelineContext)
  | { page: 'none' };

export type DbRoute =
  | { page: 'list' }
  | { page: 'tweet'; tweetId: string }
  | { page: 'user'; userId: string };

export type ToolsRoute =
  | { page: 'list' }
  | { page: 'xhr-capture' }
  | { page: 'xhr-detail'; captureId: string };

export interface Breadcrumb {
  label: string;
  index: number;
  active: boolean;
}

interface NavState {
  activeTab: TabId;
  featureStack: FeatureRoute[];
  featureIndex: number;
  dbStack: DbRoute[];
  dbIndex: number;
  toolsStack: ToolsRoute[];
  toolsIndex: number;
}

const nav = reactive<NavState>({
  activeTab: 'feature',
  featureStack: [{ page: 'none' }],
  featureIndex: 0,
  dbStack: [{ page: 'list' }],
  dbIndex: 0,
  toolsStack: [{ page: 'list' }],
  toolsIndex: 0,
});

export const currentUrl = ref(unsafeWindow.location.href);

const RESERVED_USER_ROOTS = new Set([
  'home',
  'explore',
  'notifications',
  'messages',
  'compose',
  'settings',
  'search',
  'i',
]);

function parseXUrl(url: string): { segments: string[]; params: URLSearchParams } {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://x.com') return { segments: [], params: new URLSearchParams() };
    return { segments: parsed.pathname.split('/').filter(Boolean), params: parsed.searchParams };
  } catch {
    return { segments: [], params: new URLSearchParams() };
  }
}

/** Profile tabs: `/<user>` is Posts, `/<user>/<tab>` the others (2026-10 layout). */
const PROFILE_TAB_SOURCES: Record<string, FeatureTimelineSource> = {
  all: 'user-all',
  highlights: 'user-highlights',
  with_replies: 'user-replies',
  reposts: 'user-reposts',
  articles: 'user-articles',
};

const SORTABLE_SOURCES = new Set<FeatureTimelineSource>(['user-posts', 'user-all', 'user-highlights']);

function resolveInitialHomeSource(): FeatureTimelineSource {
  const homeTimelineOrder = getTimelineCreatedOrderByAlias(getFeatureTimelineNamespace('home-timeline'));
  const homeLatestOrder = getTimelineCreatedOrderByAlias(getFeatureTimelineNamespace('home-latest-timeline'));

  if (homeTimelineOrder == null && homeLatestOrder == null) {
    return 'home-timeline';
  }
  if (homeTimelineOrder == null) {
    return 'home-latest-timeline';
  }
  if (homeLatestOrder == null) {
    return 'home-timeline';
  }
  return homeLatestOrder < homeTimelineOrder ? 'home-latest-timeline' : 'home-timeline';
}

function resolveFeatureStack(url: string): FeatureRoute[] {
  const { segments, params } = parseXUrl(url);

  if (segments.length >= 3 && segments[1] === 'status' && /^\d+$/.test(segments[2])) {
    return [{ page: 'status', tweetId: segments[2] }];
  }

  if (segments[0] === 'i') {
    const path = segments.slice(1).join('/');
    if (path === 'bookmarks' || path === 'history') return [{ page: 'timeline', source: 'bookmarks' }];
    if (path === 'history/likes') return [{ page: 'timeline', source: 'likes' }];
    return [{ page: 'none' }];
  }

  if (segments.length === 1 && segments[0] === 'home') {
    return [
      { page: 'home-root' },
      { page: 'timeline', source: resolveInitialHomeSource() },
    ];
  }

  if (segments.length === 0 || segments.length > 2 || RESERVED_USER_ROOTS.has(segments[0])) {
    return [{ page: 'none' }];
  }

  const [username, tab] = segments;
  const source: FeatureTimelineSource | undefined = tab === undefined
    ? 'user-posts'
    : tab === 'media'
      ? (params.get('filter') === 'photo' ? 'user-photos' : 'user-videos')
      : PROFILE_TAB_SOURCES[tab];
  if (!source) return [{ page: 'none' }];

  const sort = SORTABLE_SOURCES.has(source) && params.get('sort') === 'popular' ? 'popular' : undefined;
  return [{ page: 'timeline', source, username, sort }];
}

export function syncFeatureRoute(): void {
  nav.featureStack = resolveFeatureStack(currentUrl.value);
  nav.featureIndex = nav.featureStack.length - 1;
}

export function setActiveTab(tab: TabId): void {
  nav.activeTab = tab;
}

export const activeTab = computed(() => nav.activeTab);

// --- Feature tab navigation ---
export const featureRoute = computed<FeatureRoute>(() => nav.featureStack[nav.featureIndex]);

export const featureBreadcrumbs = computed<Breadcrumb[]>(() => {
  return nav.featureStack.slice(0, nav.featureIndex + 1).map((r, i) => {
    let label = 'Page';
    if (r.page === 'status') label = 'Status';
    else if (r.page === 'home-root') label = 'Home';
    else if (r.page === 'timeline') label = getFeatureTimelineLabel(r.source, r.sort);
    else if (r.page === 'tweet') label = 'Tweet';
    else if (r.page === 'user') label = 'User';
    else label = 'Feature';
    return { label, index: i, active: i === nav.featureIndex };
  });
});

export function featureNavigateTo(route: FeatureRoute): void {
  // Max depth: home-root -> timeline -> tweet -> user (4 levels)
  if (nav.featureIndex >= 3) {
    nav.featureStack[nav.featureIndex] = route;
    return;
  }
  nav.featureStack.splice(nav.featureIndex + 1);
  nav.featureStack.push(route);
  nav.featureIndex = nav.featureStack.length - 1;
}

export function featureNavigateToIndex(index: number): void {
  if (index >= 0 && index <= nav.featureIndex) {
    nav.featureIndex = index;
  }
}

// --- Database tab navigation ---
export const dbRoute = computed<DbRoute>(() => nav.dbStack[nav.dbIndex]);

export const dbBreadcrumbs = computed<Breadcrumb[]>(() => {
  return nav.dbStack.slice(0, nav.dbIndex + 1).map((r, i) => {
    let label = 'Tweets';
    if (r.page === 'tweet') label = 'Tweet';
    else if (r.page === 'user') label = 'User';
    return { label, index: i, active: i === nav.dbIndex };
  });
});

export function dbNavigateTo(route: DbRoute): void {
  if (route.page === 'tweet') {
    // From list -> tweet, or replace current tweet
    if (nav.dbIndex === 0) {
      nav.dbStack.splice(1);
      nav.dbStack.push(route);
      nav.dbIndex = 1;
    } else {
      // Replace at current level (no deeper nesting for tweets)
      nav.dbStack[nav.dbIndex] = route;
    }
  } else if (route.page === 'user') {
    // User is always the deepest (level 2 max: list -> tweet -> user)
    if (nav.dbIndex >= 2) {
      nav.dbStack[nav.dbIndex] = route;
    } else {
      nav.dbStack.splice(nav.dbIndex + 1);
      nav.dbStack.push(route);
      nav.dbIndex = nav.dbStack.length - 1;
    }
  } else {
    // Back to list
    nav.dbStack = [{ page: 'list' }];
    nav.dbIndex = 0;
  }
}

export function dbNavigateToIndex(index: number): void {
  if (index >= 0 && index <= nav.dbIndex) {
    nav.dbIndex = index;
  }
}

// --- Tools tab navigation ---
export const toolsRoute = computed<ToolsRoute>(() => nav.toolsStack[nav.toolsIndex]);

export const toolsBreadcrumbs = computed<Breadcrumb[]>(() => {
  return nav.toolsStack.slice(0, nav.toolsIndex + 1).map((r, i) => {
    let label = 'Tools';
    if (r.page === 'xhr-capture') label = 'XHR Capture';
    else if (r.page === 'xhr-detail') label = 'Detail';
    return { label, index: i, active: i === nav.toolsIndex };
  });
});

export function toolsNavigateTo(route: ToolsRoute): void {
  if (route.page === 'xhr-capture') {
    if (nav.toolsIndex === 0) {
      nav.toolsStack.splice(1);
      nav.toolsStack.push(route);
      nav.toolsIndex = 1;
    } else {
      nav.toolsStack[1] = route;
      nav.toolsStack.splice(2);
      nav.toolsIndex = 1;
    }
  } else if (route.page === 'xhr-detail') {
    if (nav.toolsIndex >= 2) {
      nav.toolsStack[nav.toolsIndex] = route;
    } else {
      nav.toolsStack.splice(nav.toolsIndex + 1);
      nav.toolsStack.push(route);
      nav.toolsIndex = nav.toolsStack.length - 1;
    }
  } else {
    nav.toolsStack = [{ page: 'list' }];
    nav.toolsIndex = 0;
  }
}

export function toolsNavigateToIndex(index: number): void {
  if (index >= 0 && index <= nav.toolsIndex) {
    nav.toolsIndex = index;
  }
}

// --- Breadcrumbs for current tab ---
export const currentBreadcrumbs = computed<Breadcrumb[]>(() => {
  switch (nav.activeTab) {
    case 'feature': return featureBreadcrumbs.value;
    case 'database': return dbBreadcrumbs.value;
    case 'tools': return toolsBreadcrumbs.value;
    case 'settings': return [{ label: 'Settings', index: 0, active: true }];
    default: return [];
  }
});

export function navigateBreadcrumb(index: number): void {
  switch (nav.activeTab) {
    case 'feature': featureNavigateToIndex(index); break;
    case 'database': dbNavigateToIndex(index); break;
    case 'tools': toolsNavigateToIndex(index); break;
  }
}
