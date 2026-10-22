import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEASE_KEY, createLease, createOutbox, packRecords, type OutboxKv, type OutboxRecord } from './outbox.ts';

/** In-memory stand-in for GM storage, shared by several "tabs". */
function memoryKv(shared: Map<string, string> = new Map()): OutboxKv & { data: Map<string, string> } {
  const listeners = new Map<string, Array<(value: string | undefined, remote: boolean) => void>>();
  return {
    data: shared,
    async get(key) { return shared.get(key); },
    async set(key, value) { shared.set(key, value); for (const l of listeners.get(key) ?? []) l(value, true); },
    async delete(key) { shared.delete(key); for (const l of listeners.get(key) ?? []) l(undefined, true); },
    async keys() { return [...shared.keys()]; },
    watch(key, listener) {
      listeners.set(key, [...(listeners.get(key) ?? []), listener]);
      return () => listeners.set(key, (listeners.get(key) ?? []).filter((l) => l !== listener));
    },
  };
}

const post = (id: string, extra = '') => ({ id, text: `post ${id}${extra}` });
const tab = (shared: Map<string, string>, tabId: string, extra: Partial<Parameters<typeof createOutbox>[0]> = {}) => {
  const outbox = createOutbox({ kv: memoryKv(shared), tabId, persistDelayMs: 5, ...extra });
  return outbox;
};

test('put persists the segment and ackRevs removes only records up to the sent version', async () => {
  const shared = new Map<string, string>();
  const outbox = tab(shared, 'a');
  outbox.put('post:1', 3, post('1'));
  outbox.put('post:2', 1, post('2'));
  await outbox.persistNow();
  assert.equal(JSON.parse(shared.get('xd_outbox:seg:a')!).records.length, 2);

  outbox.put('post:1', 5, post('1', ' newer'));
  outbox.ackRevs([{ key: 'post:1', rev: 3 }, { key: 'post:2', rev: 1 }]);
  assert.deepEqual(outbox.list().map((r) => [r.key, r.rev]), [['post:1', 5]]);

  outbox.ackRevs([{ key: 'post:1', rev: 5 }]);
  await outbox.persistNow();
  assert.equal(shared.has('xd_outbox:seg:a'), false, 'an empty outbox leaves no key behind');
  outbox.dispose();
});

test('an unchanged revision is not rewritten and keeps its age', () => {
  const outbox = tab(new Map(), 'a');
  outbox.put('post:1', 2, post('1'));
  const [first] = outbox.list();
  outbox.put('post:1', 2, post('1'));
  assert.equal(outbox.list()[0].seq, first.seq);
  outbox.dispose();
});

test('the size cap drops the oldest records first and reports them', () => {
  const dropped: number[] = [];
  const outbox = tab(new Map(), 'a', { maxRecords: 3, onDrop: (n) => dropped.push(n) });
  for (let i = 1; i <= 5; i += 1) outbox.put(`post:${i}`, 1, post(String(i)));
  assert.deepEqual(outbox.list().map((r) => r.key), ['post:3', 'post:4', 'post:5']);
  assert.deepEqual(dropped, [1, 1]);

  const bytes = tab(new Map(), 'b', { maxBytes: 150, onDrop: (n) => dropped.push(n) });
  bytes.put('post:1', 1, post('1', 'x'.repeat(100)));
  bytes.put('post:2', 1, post('2', 'x'.repeat(100)));
  assert.deepEqual(bytes.list().map((r) => r.key), ['post:2']);
  assert.ok(bytes.bytes() <= 150 + 100, 'the newest record is kept even when it alone is large');
  outbox.dispose();
  bytes.dispose();
});

test('a closed segment is adopted once, by another tab, without its own newer records being replaced', async () => {
  const shared = new Map<string, string>();
  const old = tab(shared, 'old');
  old.put('post:1', 4, post('1', ' old'));
  old.put('post:2', 2, post('2'));
  await old.open();
  await old.close(); // pagehide
  old.dispose();

  const fresh = tab(shared, 'fresh');
  await fresh.open();
  fresh.put('post:1', 1, post('1', ' fresh'));
  assert.equal(await fresh.hasOrphans(), true);
  assert.equal(await fresh.adoptOrphans(), 1);
  assert.deepEqual(fresh.list().map((r) => [r.key, r.rev, (r.data as unknown as { text: string }).text]), [
    ['post:1', 1, 'post 1 fresh'],
    ['post:2', 0, 'post 2'],
  ]);
  assert.equal(shared.has('xd_outbox:seg:old'), false);
  assert.equal(shared.has('xd_outbox:beat:old'), false);
  assert.ok(shared.has('xd_outbox:seg:fresh'), 'adopted records are persisted before the orphan is deleted');
  assert.equal(await fresh.adoptOrphans(), 0);
  fresh.dispose();
});

test('a live tab is not adopted, a tab that stopped beating is', async () => {
  const shared = new Map<string, string>();
  let clock = 1_000_000;
  const owner = tab(shared, 'owner', { now: () => clock });
  owner.put('post:1', 1, post('1'));
  await owner.open();
  await owner.persistNow();
  const other = tab(shared, 'other', { now: () => clock, staleMs: 60_000 });
  assert.equal(await other.hasOrphans(), false);
  clock += 61_000;
  assert.equal(await other.hasOrphans(), true);
  assert.equal(await other.adoptOrphans(), 1);
  owner.dispose();
  other.dispose();
});

test('adopted records go out as stored and an acknowledgement by seq removes exactly those', async () => {
  const shared = new Map<string, string>();
  const old = tab(shared, 'old');
  old.put('user:9', 1, { id: '9' });
  old.put('media:5', 1, { id: '5' });
  old.put('post:1', 1, post('1'));
  await old.close();
  old.dispose();

  const fresh = tab(shared, 'fresh');
  await fresh.adoptOrphans();
  const { batch, taken } = packRecords(fresh.list(), { records: 10, bytes: 1e6 });
  assert.deepEqual(batch, { users: [{ id: '9' }], media: [{ id: '5' }], posts: [post('1')] });

  fresh.put('post:1', 2, post('1', ' captured meanwhile')); // replaced while the request was in flight
  fresh.ackSeqs(taken.map((r) => r.seq));
  assert.deepEqual(fresh.list().map((r) => r.key), ['post:1'], 'the newer copy of post 1 stays unacknowledged');
  fresh.dispose();
});

test('packRecords respects the record and byte limits but always takes one record', () => {
  const records: OutboxRecord[] = [1, 2, 3, 4].map((i) => ({ key: `post:${i}`, rev: 0, seq: i, at: i, size: 100, data: { id: String(i) } }));
  assert.equal(packRecords(records, { records: 3, bytes: 1e6 }).taken.length, 3);
  assert.equal(packRecords(records, { records: 10, bytes: 250 }).taken.length, 2);
  assert.equal(packRecords(records, { records: 10, bytes: 10 }).taken.length, 1);
  assert.equal(packRecords([], { records: 10, bytes: 10 }).taken.length, 0);
});

test('only one tab holds the lease; it can be taken after expiry or release', async () => {
  const shared = new Map<string, string>();
  let clock = 5_000;
  const make = (owner: string) => createLease({ kv: memoryKv(shared), owner, now: () => clock, ttlMs: 1000, sleep: async () => {}, verifyDelayMs: 0 });
  const a = make('a');
  const b = make('b');

  assert.equal(await a.acquire(), true);
  assert.equal(await b.acquire(), false);
  assert.equal(a.held(), true);
  assert.equal(await a.acquire(), true, 'the holder renews');

  clock += 1500; // a stalled
  assert.equal(await b.acquire(), true);
  assert.equal(a.held(), false);
  assert.equal(await a.acquire(), false);

  await b.release();
  assert.equal(shared.has(LEASE_KEY), false);
  assert.equal(await a.acquire(), true);
  a.dispose();
  b.dispose();
});

test('a lease released in one tab wakes the waiting tab', async () => {
  const shared = new Map<string, string>();
  const kv = memoryKv(shared);
  const a = createLease({ kv, owner: 'a', sleep: async () => {}, verifyDelayMs: 0 });
  const b = createLease({ kv, owner: 'b', sleep: async () => {}, verifyDelayMs: 0 });
  let woken = 0;
  const off = b.onChange(() => { woken += 1; });
  await a.acquire();
  await a.release();
  assert.ok(woken >= 1);
  off();
  a.dispose();
  b.dispose();
});

test('a lease that lost the read-back race is not held', async () => {
  const shared = new Map<string, string>();
  const kv = memoryKv(shared);
  const a = createLease({
    kv, owner: 'a', verifyDelayMs: 0,
    sleep: async () => { shared.set(LEASE_KEY, JSON.stringify({ owner: 'b', expires: Date.now() + 10_000 })); },
  });
  assert.equal(await a.acquire(), false);
  assert.equal(a.held(), false);
  a.dispose();
});
