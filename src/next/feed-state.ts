/**
 * Home feed paging state (SPEC §4 "首页信息流分页"). One FeedState per timeline (namespace + scope), kept at module
 * level so it survives route changes (post detail and back), tab switches and panel collapse.
 *
 * Current page = follow ? latest : pinned. Pausing records the latest page id at that moment (`pausedAtLatestId`);
 * pages above it are "pending" until the user resumes. All transitions go through the functions below.
 */
import { reactive } from 'vue';

export interface FeedState {
  /** Auto-advance to every newly captured page. */
  follow: boolean;
  /** Page shown while not following. */
  pinnedPageId: number;
  /** Latest page id when follow was turned off; pages above it are pending. */
  pausedAtLatestId: number;
  /** Pages that have been the current page while the view was visible (the page menu marks the others "新"). */
  seenPageIds: Set<number>;
  /** Pages whose repeated-posts block is expanded. */
  repeatsOpen: Set<number>;
  /** Latest page id the user has had the feature tab open on (null = not seen yet); drives the tab dot. */
  viewedLatestId: number | null;
}

const states = new Map<string, FeedState>();

export function feedStateKey(namespace: string, scope: string | null | undefined): string {
  return `${namespace}|${scope ?? ''}`;
}

export function getFeedState(key: string): FeedState {
  let state = states.get(key);
  if (!state) {
    state = reactive<FeedState>({
      follow: true,
      pinnedPageId: 0,
      pausedAtLatestId: 0,
      seenPageIds: new Set<number>(),
      repeatsOpen: new Set<number>(),
      viewedLatestId: null,
    }) as FeedState;
    states.set(key, state);
  }
  return state;
}

/** The timeline was cleared (pages restart at 1): forget everything about the old pages. */
export function resetFeedState(state: FeedState): void {
  state.follow = true;
  state.pinnedPageId = 0;
  state.pausedAtLatestId = 0;
  state.seenPageIds.clear();
  state.repeatsOpen.clear();
  state.viewedLatestId = null;
}

/** Stop following; stays on the current page. No-op when already paused. */
export function pauseFeed(state: FeedState, currentId: number, latestId: number): void {
  if (!state.follow) return;
  state.follow = false;
  state.pinnedPageId = currentId;
  state.pausedAtLatestId = latestId;
}

/** Follow again: the latest page becomes current and pending pages are cleared. */
export function resumeFeed(state: FeedState): void {
  state.follow = true;
}

/** Navigate to a page: the latest page resumes following, any other page pauses on it. */
export function goToFeedPage(state: FeedState, pageId: number, currentId: number, latestId: number): void {
  if (pageId === latestId) {
    resumeFeed(state);
    return;
  }
  pauseFeed(state, currentId, latestId);
  state.pinnedPageId = pageId;
}
