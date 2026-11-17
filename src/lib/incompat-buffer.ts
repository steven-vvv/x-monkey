/** Ring-buffer limits for the in-memory incompatible-request capture. Pure: no GM or Vue imports. */
export const INCOMPAT_MAX_RECORDS = 200;
export const INCOMPAT_MAX_CHARS = 32_000_000;

export interface BufferLimits {
  maxRecords: number;
  maxChars: number;
}

export const DEFAULT_BUFFER_LIMITS: BufferLimits = { maxRecords: INCOMPAT_MAX_RECORDS, maxChars: INCOMPAT_MAX_CHARS };

/**
 * Appends `item` and evicts the oldest entries until both limits hold. The newest item is always kept, even when
 * it alone exceeds `maxChars`. `dropped` is the number of evicted entries.
 */
export function appendWithLimits<T>(
  list: readonly T[],
  item: T,
  sizeOf: (item: T) => number,
  limits: BufferLimits = DEFAULT_BUFFER_LIMITS,
): { list: T[]; dropped: number } {
  const next = [...list, item];
  let chars = 0;
  for (const entry of next) chars += sizeOf(entry);
  let drop = 0;
  while (next.length - drop > 1 && (next.length - drop > limits.maxRecords || chars > limits.maxChars)) {
    chars -= sizeOf(next[drop]);
    drop += 1;
  }
  return { list: drop ? next.slice(drop) : next, dropped: drop };
}
