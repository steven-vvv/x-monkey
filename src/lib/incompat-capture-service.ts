import { ref, shallowRef } from 'vue';
import { onIncompatibleResponse } from './fetch-interceptor';
import { appendWithLimits } from './incompat-buffer';
import type { IncompatRecord } from './incompat-diagnosis';

export type { IncompatDiagnosis, IncompatReason, IncompatRecord } from './incompat-diagnosis';

/**
 * Memory-only on purpose: the records hold request headers (session credentials), so they never reach GM storage
 * and the switch resets with the page.
 */
export const isIncompatCaptureOn = ref(false);
export const incompatCaptures = shallowRef<IncompatRecord[]>([]);
/** Older records evicted by the ring-buffer limits since the last clear. */
export const incompatDroppedCount = ref(0);

let unsubscribe: (() => void) | null = null;

export function setIncompatCapture(on: boolean): void {
  if (on === isIncompatCaptureOn.value) return;
  isIncompatCaptureOn.value = on;
  if (on) {
    unsubscribe = onIncompatibleResponse((record) => {
      const { list, dropped } = appendWithLimits(incompatCaptures.value, record, (item) => item.capture.responseBody.length);
      incompatCaptures.value = list;
      incompatDroppedCount.value += dropped;
    });
  } else {
    unsubscribe?.();
    unsubscribe = null;
  }
}

export function clearIncompatCaptures(): void {
  incompatCaptures.value = [];
  incompatDroppedCount.value = 0;
}

export function getIncompatCaptureById(id: string): IncompatRecord | undefined {
  return incompatCaptures.value.find((record) => record.capture.id === id);
}
