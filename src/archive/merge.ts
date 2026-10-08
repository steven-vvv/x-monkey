function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => deepEqual(value, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    return leftKeys.length === Object.keys(right).length
      && leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
  }

  return false;
}

/** Records are plain JSON; a JSON round trip also copies Vue reactive proxies safely. */
export function cloneRecord<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Merges `incoming` into `target` with the archive rules: present values win,
 * absent values keep what is known, objects merge recursively and arrays are
 * replaced as a whole. Returns whether `target` changed.
 */
export function mergeArchiveRecord(target: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  let changed = false;

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    const current = target[key];

    if (isPlainObject(value) && isPlainObject(current)) {
      changed = mergeArchiveRecord(current, value) || changed;
      continue;
    }

    if (deepEqual(current, value)) continue;
    target[key] = cloneRecord(value);
    changed = true;
  }

  return changed;
}

/**
 * Merges each counter together with its capture time. Metadata-only changes
 * update the record but do not report a change for local sync versions.
 */
export function mergeCapturedArchiveRecord(target: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  const { counts, countsObservedAt, ...content } = incoming;
  let changed = mergeArchiveRecord(target, content);
  if (!isPlainObject(counts)) return changed;

  const currentCounts = isPlainObject(target.counts) ? target.counts : {};
  const currentTimes = isPlainObject(target.countsObservedAt) ? { ...target.countsObservedAt } : {};
  const incomingTimes = isPlainObject(countsObservedAt) ? countsObservedAt : {};
  for (const [key, value] of Object.entries(counts)) {
    if (value === undefined) continue;
    const observedAt = typeof incomingTimes[key] === 'string' ? incomingTimes[key] : undefined;
    const currentTime = typeof currentTimes[key] === 'string' ? currentTimes[key] : undefined;
    // A delayed/replayed observation must not overwrite a newer value.
    if (observedAt && currentTime && Date.parse(observedAt) < Date.parse(currentTime)) continue;

    const countChanged = !deepEqual(currentCounts[key], value);
    if (countChanged) {
      currentCounts[key] = cloneRecord(value);
      changed = true;
    }
    if (observedAt) currentTimes[key] = observedAt;
    // Untimed archive clients remain valid, but their changed value has no
    // known capture time; retaining the previous value's time would mislabel it.
    else if (countChanged) delete currentTimes[key];
  }

  if (Object.keys(currentCounts).length > 0) target.counts = currentCounts;
  if (Object.keys(currentTimes).length > 0) {
    if (!deepEqual(target.countsObservedAt, currentTimes)) target.countsObservedAt = currentTimes;
  } else {
    delete target.countsObservedAt;
  }
  return changed;
}
