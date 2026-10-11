/**
 * One-shot shimmer flag: `trigger()` turns `active` on for one sweep (the CSS animation runs once, ~1.1s) and off
 * again, so the next trigger replays it. `minGapMs` drops triggers that follow the previous one too closely.
 */
import { onBeforeUnmount, ref } from 'vue';

const SWEEP_MS = 1200;

export function useShimmer(minGapMs = 0) {
  const active = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastAt = Number.NEGATIVE_INFINITY;

  function trigger(): void {
    const now = Date.now();
    if (now - lastAt < minGapMs) return;
    lastAt = now;
    clearTimeout(timer);
    active.value = true;
    timer = setTimeout(() => { active.value = false; }, SWEEP_MS);
  }

  onBeforeUnmount(() => clearTimeout(timer));

  return { active, trigger };
}
