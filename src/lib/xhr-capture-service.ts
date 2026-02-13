import { ref, shallowRef } from 'vue';
import { onXhrCapture, type CapturedXhr } from './fetch-interceptor';

export type { CapturedXhr } from './fetch-interceptor';

export const captures = shallowRef<CapturedXhr[]>([]);
export const isCapturing = ref(false);

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
}

export function getCaptureById(id: string): CapturedXhr | undefined {
  return captures.value.find((c) => c.id === id);
}

export function hashHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
