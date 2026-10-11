/**
 * Reactive 持续归档 status label for the shell (button title, launcher title, popover pill). While the engine waits
 * to retry, `now` ticks once a second so the countdown stays current; no timer runs in any other phase.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { autoArchiveState } from '../../lib/auto-archive';
import { describeAutoArchive } from '../auto-archive-labels';

export function useAutoArchiveStatus() {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;

  function stop(): void {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  }

  watch(() => autoArchiveState.phase === 'backoff', (waiting) => {
    stop();
    if (!waiting) return;
    now.value = Date.now();
    timer = setInterval(() => { now.value = Date.now(); }, 1000);
  }, { immediate: true });
  onBeforeUnmount(stop);

  const status = computed(() => describeAutoArchive(autoArchiveState.phase, autoArchiveState.retryAt, now.value));
  return { status };
}
