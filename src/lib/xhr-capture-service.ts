import { reactive, ref, shallowRef } from 'vue';
import { onXhrCapture, type CapturedXhr } from './fetch-interceptor';

export type { CapturedXhr } from './fetch-interceptor';

export const captures = shallowRef<CapturedXhr[]>([]);
export const isCapturing = ref(false);

// Selection lives here so it survives switching panel tabs.
export const isSelectingCaptures = ref(false);
export const selectedCaptureIds = reactive(new Set<string>());

let unsubscribe: (() => void) | null = null;

export function startCapture(): void {
  if (isCapturing.value) return;
  isCapturing.value = true;
  unsubscribe = onXhrCapture((data) => {
    captures.value = [...captures.value, data];
  });
}

export function stopCapture(): void {
  if (!isCapturing.value) return;
  isCapturing.value = false;
  unsubscribe?.();
  unsubscribe = null;
}

export function toggleCapture(): void {
  if (isCapturing.value) stopCapture();
  else startCapture();
}

export function clearCaptures(): void {
  captures.value = [];
  selectedCaptureIds.clear();
}

export function getCaptureById(id: string): CapturedXhr | undefined {
  return captures.value.find((c) => c.id === id);
}

export function setCaptureSelectionMode(active: boolean): void {
  isSelectingCaptures.value = active;
  if (!active) selectedCaptureIds.clear();
}

export function toggleCaptureSelection(id: string): void {
  if (selectedCaptureIds.has(id)) selectedCaptureIds.delete(id);
  else selectedCaptureIds.add(id);
}

export function selectAllCaptures(): void {
  isSelectingCaptures.value = true;
  for (const capture of captures.value) {
    selectedCaptureIds.add(capture.id);
  }
}

/** Selected captures in capture order. */
export function getSelectedCaptures(): CapturedXhr[] {
  return captures.value.filter((c) => selectedCaptureIds.has(c.id));
}
