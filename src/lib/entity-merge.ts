function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
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

  return false;
}

function valuesEqual(current: unknown, incoming: unknown): boolean {
  if (Array.isArray(current) && Array.isArray(incoming)) {
    return arraysEqual(current, incoming);
  }
  return Object.is(current, incoming);
}

export function mergeEntity<T extends Record<string, any>>(target: T, source: T): boolean {
  let changed = false;

  for (const [key, incoming] of Object.entries(source) as [keyof T, T[keyof T]][]) {
    const current = target[key];
    if (shouldSkipIncoming(current, incoming)) continue;
    if (valuesEqual(current, incoming)) continue;
    target[key] = incoming;
    changed = true;
  }

  return changed;
}
