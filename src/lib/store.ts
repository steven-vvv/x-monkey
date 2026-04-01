import { reactive, computed, ref } from 'vue';
import { unsafeWindow } from '$';
import { getFeatureTimelineLabel, getFeatureTimelineOperation, type FeatureTimelineSource } from './feature-timeline';
import { getTimelineCreatedOrderByAlias } from './timeline-store';

export type TabId = 'feature' | 'database' | 'settings' | 'tools';

interface FeatureTimelineContext {
  source?: FeatureTimelineSource;
  username?: string;
}

export type FeatureRoute =
  | { page: 'status'; tweetId: string }
  | { page: 'home-root' }
  | ({ page: 'timeline' } & Required<Pick<FeatureTimelineContext, 'source'>> & Pick<FeatureTimelineContext, 'username'>)
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

function getPathSegments(url: string): string[] {
  try {
    const parsed = new URL(url);
    if (parsed.origin !== 'https://x.com') return [];
    return parsed.pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }
}

function resolveInitialHomeSource(): FeatureTimelineSource {
  const homeTimelineOrder = getTimelineCreatedOrderByAlias(getFeatureTimelineOperation('home-timeline'));
  const homeLatestOrder = getTimelineCreatedOrderByAlias(getFeatureTimelineOperation('home-latest-timeline'));

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
  const segments = getPathSegments(url);

  if (segments.length >= 3 && segments[1] === 'status' && /^\d+$/.test(segments[2])) {
    return [{ page: 'status', tweetId: segments[2] }];
  }

  if (segments.length === 2 && segments[0] === 'i' && segments[1] === 'bookmarks') {
    return [{ page: 'timeline', source: 'bookmarks' }];
  }

  if (segments.length === 1 && segments[0] === 'home') {
    return [
      { page: 'home-root' },
      { page: 'timeline', source: resolveInitialHomeSource() },
    ];
  }

  if (segments.length === 2 && segments[1] === 'media') {
    return [{ page: 'timeline', source: 'user-media', username: segments[0] }];
  }

  if (segments.length === 1 && !RESERVED_USER_ROOTS.has(segments[0])) {
    return [{ page: 'timeline', source: 'user-tweets', username: segments[0] }];
  }

  return [{ page: 'none' }];
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
    else if (r.page === 'timeline') label = getFeatureTimelineLabel(r.source);
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
