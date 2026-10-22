/**
 * Durable outbox for the continuous archive: records captured but not yet acknowledged by the remote database,
 * persisted in userscript storage so a reload, a tab close or a crash does not lose them. Pure logic over an injected
 * key-value store (see outbox-gm.ts), so it runs under `tsx --test`.
 *
 * Layout: every tab writes only its own segment (`xd_outbox:seg:<tab>`), so no write races between tabs. Another tab
 * adopts a segment once its owner marked it closed (pagehide) or stopped beating (crash). A single lease key decides
 * which tab sends. Delivery is at-least-once: the server merge is idempotent, so a duplicate send is harmless and the
 * lease is an efficiency measure, not a correctness requirement.
 */

export interface OutboxKv {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  /** Calls back when another tab (or this one) changes `key`; returns the unsubscribe function. */
  watch(key: string, listener: (value: string | undefined, remote: boolean) => void): () => void;
}

/** One archive record (`post:ID` / `user:ID` / `media:ID`). `rev` is the db change counter; 0 marks an adopted record. */
export interface OutboxRecord {
  key: string;
  rev: number;
  seq: number;
  at: number;
  size: number;
  data: { id: string };
}

export const OUTBOX_PREFIX = 'xd_outbox:';
export const LEASE_KEY = `${OUTBOX_PREFIX}lease`;
const SEGMENT_PREFIX = `${OUTBOX_PREFIX}seg:`;
const BEAT_PREFIX = `${OUTBOX_PREFIX}beat:`;

/** Per-tab cap of the persisted segment; the oldest records are dropped first beyond it. */
export const OUTBOX_MAX_BYTES = 3 * 1024 * 1024;
export const OUTBOX_MAX_RECORDS = 5000;
/** A segment whose owner has not beaten for this long (and is not marked closed) is an orphan. */
export const SEGMENT_STALE_MS = 3 * 60_000;

export interface OutboxOptions {
  kv: OutboxKv;
  tabId: string;
  now?: () => number;
  maxBytes?: number;
  maxRecords?: number;
  staleMs?: number;
  /** Debounce of persistence writes after a change; `persistNow` skips it. */
  persistDelayMs?: number;
  /** Called with the number of records dropped by the size cap. */
  onDrop?: (count: number) => void;
}

interface PersistedSegment {
  v: 1;
  records: OutboxRecord[];
}

interface Beat {
  open: boolean;
  at: number;
}

export interface Outbox {
  /** Adds or replaces a record; no-op for an unchanged `rev` (> 0). */
  put(key: string, rev: number, data: { id: string }): void;
  /** Removes records the server acknowledged from a db-built request: `1 <= stored rev <= sent rev`. */
  ackRevs(items: ReadonlyArray<{ key: string; rev: number }>): void;
  /** Removes exactly the records that were sent (a record replaced since has a new `seq` and stays). */
  ackSeqs(seqs: Iterable<number>): void;
  /** Oldest first. */
  list(): OutboxRecord[];
  count(): number;
  bytes(): number;
  persistNow(): Promise<void>;
  /** Writes pending changes and marks the segment adoptable (pagehide, stop). */
  close(): Promise<void>;
  /** Marks the segment live again (pageshow after bfcache, restart) and starts beating. */
  open(): Promise<void>;
  hasOrphans(): Promise<boolean>;
  /** Moves records of closed or stale segments of other tabs into this one; returns how many were adopted. */
  adoptOrphans(): Promise<number>;
  dispose(): void;
}

const kindOf = (key: string): string => key.slice(0, key.indexOf(':'));

export function createOutbox(options: OutboxOptions): Outbox {
  const { kv, tabId } = options;
  const now = options.now ?? Date.now;
  const maxBytes = options.maxBytes ?? OUTBOX_MAX_BYTES;
  const maxRecords = options.maxRecords ?? OUTBOX_MAX_RECORDS;
  const staleMs = options.staleMs ?? SEGMENT_STALE_MS;
  const persistDelayMs = options.persistDelayMs ?? 1000;
  const segmentKey = `${SEGMENT_PREFIX}${tabId}`;
  const beatKey = `${BEAT_PREFIX}${tabId}`;

  /** Insertion order is age order: replacing a record moves it to the end. */
  const records = new Map<string, OutboxRecord>();
  let totalBytes = 0;
  let seq = 0;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  let beatTimer: ReturnType<typeof setInterval> | undefined;
  let writes: Promise<void> = Promise.resolve();

  function remove(key: string): void {
    const existing = records.get(key);
    if (!existing) return;
    totalBytes -= existing.size;
    records.delete(key);
  }

  function enforceCap(): void {
    let dropped = 0;
    for (const key of records.keys()) {
      if (records.size <= maxRecords && totalBytes <= maxBytes) break;
      // Keep the newest record even if it alone exceeds the cap.
      if (records.size === 1) break;
      remove(key);
      dropped += 1;
    }
    if (dropped > 0) options.onDrop?.(dropped);
  }

  function schedulePersist(): void {
    if (persistTimer !== undefined) return;
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      void persistNow();
    }, persistDelayMs);
  }

  /** Writes are chained so an older snapshot never lands after a newer one. */
  function persistNow(): Promise<void> {
    if (persistTimer !== undefined) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
    const value = records.size === 0 ? undefined : JSON.stringify({ v: 1, records: [...records.values()] } satisfies PersistedSegment);
    writes = writes.then(async () => {
      try {
        if (value === undefined) await kv.delete(segmentKey);
        else await kv.set(segmentKey, value);
      } catch {
        // Storage failures must never break capture; the in-memory copy still drives this session's sends.
      }
    });
    return writes;
  }

  function writeBeat(isOpen: boolean): Promise<void> {
    return Promise.resolve(kv.set(beatKey, JSON.stringify({ open: isOpen, at: now() } satisfies Beat))).catch(() => undefined);
  }

  function put(key: string, rev: number, data: { id: string }): void {
    const existing = records.get(key);
    if (existing && rev > 0 && existing.rev === rev) return;
    remove(key);
    const size = JSON.stringify(data).length;
    seq += 1;
    records.set(key, { key, rev, seq, at: now(), size, data });
    totalBytes += size;
    enforceCap();
    schedulePersist();
  }

  function ackRevs(items: ReadonlyArray<{ key: string; rev: number }>): void {
    let changed = false;
    for (const { key, rev } of items) {
      const existing = records.get(key);
      if (existing && existing.rev >= 1 && existing.rev <= rev) {
        remove(key);
        changed = true;
      }
    }
    if (changed) schedulePersist();
  }

  function ackSeqs(seqs: Iterable<number>): void {
    const wanted = new Set(seqs);
    let changed = false;
    for (const record of [...records.values()]) {
      if (wanted.has(record.seq)) {
        remove(record.key);
        changed = true;
      }
    }
    if (changed) schedulePersist();
  }

  function parseSegment(raw: string | undefined): OutboxRecord[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedSegment>;
      if (parsed?.v !== 1 || !Array.isArray(parsed.records)) return [];
      return parsed.records.filter((item): item is OutboxRecord => (
        !!item && typeof item.key === 'string' && !!item.data && typeof item.data === 'object' && typeof item.at === 'number'
      ));
    } catch {
      return [];
    }
  }

  async function findOrphanOwners(): Promise<string[]> {
    const owners: string[] = [];
    for (const name of await kv.keys()) {
      if (!name.startsWith(SEGMENT_PREFIX)) continue;
      const owner = name.slice(SEGMENT_PREFIX.length);
      if (owner === tabId) continue;
      let beat: Beat | undefined;
      try {
        beat = JSON.parse((await kv.get(`${BEAT_PREFIX}${owner}`)) ?? 'null') ?? undefined;
      } catch {
        beat = undefined;
      }
      if (!beat || !beat.open || now() - beat.at > staleMs) owners.push(owner);
    }
    return owners;
  }

  async function adoptOrphans(): Promise<number> {
    const owners = await findOrphanOwners();
    let adopted = 0;
    const adoptedOwners: string[] = [];
    for (const owner of owners) {
      const orphan = parseSegment(await kv.get(`${SEGMENT_PREFIX}${owner}`));
      for (const record of orphan) {
        // A live record of this tab for the same key is newer than anything an earlier page left behind.
        if (records.has(record.key) || !record.key.includes(':')) continue;
        seq += 1;
        records.set(record.key, { ...record, rev: 0, seq, size: record.size || JSON.stringify(record.data).length });
        totalBytes += records.get(record.key)!.size;
        adopted += 1;
      }
      adoptedOwners.push(owner);
    }
    if (adoptedOwners.length === 0) return 0;
    enforceCap();
    // Own copy first, then delete: a crash in between only duplicates records.
    await persistNow();
    for (const owner of adoptedOwners) {
      await kv.delete(`${SEGMENT_PREFIX}${owner}`).catch(() => undefined);
      await kv.delete(`${BEAT_PREFIX}${owner}`).catch(() => undefined);
    }
    return adopted;
  }

  return {
    put,
    ackRevs,
    ackSeqs,
    list: () => [...records.values()],
    count: () => records.size,
    bytes: () => totalBytes,
    persistNow,
    async close() {
      if (beatTimer !== undefined) clearInterval(beatTimer);
      beatTimer = undefined;
      await persistNow();
      await writeBeat(false);
    },
    async open() {
      await writeBeat(true);
      if (beatTimer === undefined) beatTimer = setInterval(() => void writeBeat(true), staleMs / 6);
    },
    hasOrphans: async () => (await findOrphanOwners()).length > 0,
    adoptOrphans,
    dispose() {
      if (persistTimer !== undefined) clearTimeout(persistTimer);
      if (beatTimer !== undefined) clearInterval(beatTimer);
      persistTimer = beatTimer = undefined;
    },
  };
}

// --- lease -----------------------------------------------------------------

export interface LeaseOptions {
  kv: OutboxKv;
  owner: string;
  ttlMs?: number;
  now?: () => number;
  /** Wait between writing the lease and reading it back, to notice a concurrent writer. */
  verifyDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface Lease {
  /** True when this tab holds the lease afterwards. Renews it (and starts keeping it alive) when it already holds it. */
  acquire(): Promise<boolean>;
  release(): Promise<void>;
  held(): boolean;
  /** Calls back when the lease value changes in another tab (released or taken). */
  onChange(listener: () => void): () => void;
  dispose(): void;
}

export const LEASE_TTL_MS = 45_000;

interface LeaseValue {
  owner: string;
  expires: number;
}

/**
 * Best-effort mutual exclusion over a store without compare-and-swap: write the lease, wait a moment, read it back.
 * Two tabs can both think they won in a rare race; the server's idempotent merge makes that harmless.
 */
export function createLease(options: LeaseOptions): Lease {
  const { kv, owner } = options;
  const ttlMs = options.ttlMs ?? LEASE_TTL_MS;
  const now = options.now ?? Date.now;
  const verifyDelayMs = options.verifyDelayMs ?? 80;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let isHeld = false;
  let expires = 0;
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  async function read(): Promise<LeaseValue | undefined> {
    try {
      const parsed = JSON.parse((await kv.get(LEASE_KEY)) ?? 'null') as LeaseValue | null;
      return parsed && typeof parsed.owner === 'string' && typeof parsed.expires === 'number' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async function acquire(): Promise<boolean> {
    if (isHeld && expires - now() > ttlMs / 2) return true;
    const current = await read();
    if (current && current.owner !== owner && current.expires > now()) {
      isHeld = false;
      stopKeepAlive();
      return false;
    }
    expires = now() + ttlMs;
    await kv.set(LEASE_KEY, JSON.stringify({ owner, expires } satisfies LeaseValue));
    await sleep(verifyDelayMs);
    const check = await read();
    isHeld = check?.owner === owner;
    if (!isHeld) stopKeepAlive();
    else if (keepAlive === undefined) keepAlive = setInterval(() => void acquire(), ttlMs / 3);
    return isHeld;
  }

  function stopKeepAlive(): void {
    if (keepAlive !== undefined) clearInterval(keepAlive);
    keepAlive = undefined;
  }

  return {
    acquire,
    async release() {
      stopKeepAlive();
      const wasHeld = isHeld;
      isHeld = false;
      if (wasHeld && (await read())?.owner === owner) await kv.delete(LEASE_KEY);
    },
    held: () => isHeld && expires > now(),
    onChange: (listener) => kv.watch(LEASE_KEY, (_value, remote) => { if (remote) listener(); }),
    dispose: stopKeepAlive,
  };
}

// --- packing ---------------------------------------------------------------

export interface PackLimits {
  /** At most this many records per request (at least one is always taken). */
  records: number;
  /** Approximate JSON bytes per request. */
  bytes: number;
}

export interface PackedBatch {
  batch: { users: unknown[]; media: unknown[]; posts: unknown[] };
  taken: OutboxRecord[];
}

/** Takes the oldest records that fit the limits and groups them as an archive submission. */
export function packRecords(records: readonly OutboxRecord[], limits: PackLimits): PackedBatch {
  const taken: OutboxRecord[] = [];
  let bytes = 0;
  for (const record of records) {
    if (taken.length > 0 && (taken.length >= limits.records || bytes + record.size > limits.bytes)) break;
    taken.push(record);
    bytes += record.size;
  }
  const batch: PackedBatch['batch'] = { users: [], media: [], posts: [] };
  for (const record of taken) {
    const kind = kindOf(record.key);
    if (kind === 'user') batch.users.push(record.data);
    else if (kind === 'media') batch.media.push(record.data);
    else batch.posts.push(record.data);
  }
  return { batch, taken };
}
