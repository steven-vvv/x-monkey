import { reactive, computed, ref } from 'vue';
import { unsafeWindow } from '$';

export type TabId = 'feature' | 'database' | 'settings' | 'tools';

export type FeatureRoute =
  | { page: 'status'; tweetId: string }
  | { page: 'tweet'; tweetId: string }
  | { page: 'user'; userId: string }
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

const STATUS_RE = /^https:\/\/x\.com\/([^/]+)\/status\/(\d+)/;

export function getStatusTweetId(): string | null {
  const m = STATUS_RE.exec(currentUrl.value);
  return m ? m[2] : null;
}

export function syncFeatureRoute(): void {
  const tweetId = getStatusTweetId();
  if (tweetId) {
    nav.featureStack = [{ page: 'status', tweetId }];
  } else {
    nav.featureStack = [{ page: 'none' }];
  }
  nav.featureIndex = 0;
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
    else if (r.page === 'tweet') label = 'Tweet';
    else if (r.page === 'user') label = 'User';
    else label = 'Feature';
    return { label, index: i, active: i === nav.featureIndex };
  });
});

export function featureNavigateTo(route: FeatureRoute): void {
  // Max depth: status -> tweet -> user (3 levels)
  if (nav.featureIndex >= 2) {
    // Replace current if at max depth
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
