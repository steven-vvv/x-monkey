/**
 * "有新页面" dot on the 当前页 tab (SPEC §4, F18): true while another tab is active (or the panel is collapsed) and the
 * feature route's home timeline captured a page since the user last had the feature tab open.
 */
import { computed, watch, type Ref } from 'vue';
import { getFeatureTimelineNamespace, isHomeFeatureTimelineSource } from '../../lib/feature-timeline';
import { activeTab, featureRoute } from '../../lib/store';
import { getTimelinePagesByAlias, getTimelineVersionByAlias } from '../../lib/timeline-store';
import { feedStateKey, getFeedState } from '../feed-state';

export function useFeedTabDot(expanded: Ref<boolean>) {
  const target = computed(() => {
    const route = featureRoute.value;
    if (route.page !== 'timeline' && route.page !== 'tweet' && route.page !== 'user') return null;
    if (!route.source || !isHomeFeatureTimelineSource(route.source)) return null;
    const namespace = getFeatureTimelineNamespace(route.source, route.sort);
    return { namespace, scope: route.scope ?? null, key: feedStateKey(namespace, route.scope) };
  });

  const latestId = computed(() => {
    const current = target.value;
    if (!current) return 0;
    void getTimelineVersionByAlias(current.namespace, current.scope);
    const pages = getTimelinePagesByAlias(current.namespace, current.scope);
    return pages.length > 0 ? pages[pages.length - 1].id : 0;
  });

  const featureVisible = computed(() => expanded.value && activeTab.value === 'feature');

  // Baseline: whatever is latest while the feature tab is visible (or the first time this timeline is seen).
  watch([target, latestId, featureVisible], () => {
    const current = target.value;
    if (!current) return;
    const state = getFeedState(current.key);
    if (featureVisible.value || state.viewedLatestId === null || latestId.value < state.viewedLatestId) {
      state.viewedLatestId = latestId.value;
    }
  }, { immediate: true, flush: 'sync' });

  return computed(() => {
    const current = target.value;
    if (!current || featureVisible.value) return false;
    const viewed = getFeedState(current.key).viewedLatestId;
    return viewed !== null && latestId.value > viewed;
  });
}
