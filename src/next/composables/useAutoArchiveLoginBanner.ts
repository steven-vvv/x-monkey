/**
 * 需要登录 banner state (SPEC section 11): visible while the engine is in `needs-login`, until dismissed. The dismissed
 * epoch lives at module level, so switching tabs (which unmounts the view) neither brings the banner back nor loses
 * the dismissal; the next entry into needs-login has a new epoch and shows it again.
 */
import { computed, ref } from 'vue';
import { autoArchiveState } from '../../lib/auto-archive';

const dismissedEpoch = ref(-1);

export function useAutoArchiveLoginBanner() {
  const visible = computed(() => autoArchiveState.phase === 'needs-login' && dismissedEpoch.value !== autoArchiveState.needsLoginEpoch);
  function dismiss(): void {
    dismissedEpoch.value = autoArchiveState.needsLoginEpoch;
  }
  return { visible, dismiss };
}
