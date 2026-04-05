function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function arraysEqual(left: unknown[], right: unknown[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!valuesEqual(left[index], right[index])) return false;
  }
  return true;
}

function objectsEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!valuesEqual(left[key], right[key])) return false;
  }

  return true;
}

function valuesEqual(current: unknown, incoming: unknown): boolean {
  if (Array.isArray(current) && Array.isArray(incoming)) {
    return arraysEqual(current, incoming);
  }

  if (isPlainObject(current) && isPlainObject(incoming)) {
    return objectsEqual(current, incoming);
  }

  return Object.is(current, incoming);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T;
  }

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key] = cloneValue(entry);
    }
    return next as T;
  }

  return value;
}

function shouldSkipIncoming(current: unknown, incoming: unknown): boolean {
  if (incoming == null) {
    return current != null;
  }

  if (typeof incoming === 'string') {
    return incoming === '' && typeof current === 'string' && current !== '';
  }

  if (Array.isArray(incoming)) {
    return incoming.length === 0 && Array.isArray(current) && current.length > 0;
  }

  if (isPlainObject(incoming)) {
    return Object.keys(incoming).length === 0 && isPlainObject(current) && Object.keys(current).length > 0;
  }

  return false;
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): boolean {
  let changed = false;

  for (const [key, incoming] of Object.entries(source)) {
    const current = target[key];

    if (shouldSkipIncoming(current, incoming)) continue;

    if (isPlainObject(incoming)) {
      if (isPlainObject(current)) {
        if (mergeInto(current, incoming)) {
          changed = true;
        }
        continue;
      }

      target[key] = cloneValue(incoming);
      changed = true;
      continue;
    }

    if (Array.isArray(incoming)) {
      if (Array.isArray(current) && arraysEqual(current, incoming)) continue;
      target[key] = cloneValue(incoming);
      changed = true;
      continue;
    }

    if (valuesEqual(current, incoming)) continue;

    target[key] = incoming;
    changed = true;
  }

  return changed;
}

export function mergeEntity<T extends Record<string, unknown>>(target: T, source: T): boolean {
  return mergeInto(target, source);
}
