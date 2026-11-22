import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Media, Post, User } from '../../archive/model';
import type { ArchiveRecordSource } from './adapter.ts';
import { RemoteDbChunkedSubmitError, mergeSubmitResponses, planChunks, submitPostsChunked } from './chunked-submit.ts';
import { RemoteDbHttpError, RemoteDbNetworkError, RemoteDbTimeoutError, parseRetryAfterMs } from './errors.ts';
import type { RemoteDbSubmission, RemoteDbSubmitResponse } from './types';

/** Each post `p<i>` has author `u<i % authors>` and `media` media items `m<i>-<k>`. */
function makeSource(count: number, opts: { authors?: number; media?: number; text?: string } = {}): ArchiveRecordSource & { ids: string[] } {
  const authors = opts.authors ?? count;
  const mediaPer = opts.media ?? 0;
  const posts = new Map<string, Post>();
  const users = new Map<string, User>();
  const media = new Map<string, Media>();
  for (let i = 0; i < count; i += 1) {
    const mediaIds = Array.from({ length: mediaPer }, (_, k) => `m${i}-${k}`);
    for (const id of mediaIds) media.set(id, { id } as unknown as Media);
    users.set(`u${i % authors}`, { id: `u${i % authors}`, handle: `h${i % authors}` } as unknown as User);
    posts.set(`p${i}`, { id: `p${i}`, authorId: `u${i % authors}`, mediaIds, text: opts.text ?? 'x' } as unknown as Post);
  }
  return {
    ids: [...posts.keys()],
    getPost: (id) => posts.get(id),
    getUser: (id) => users.get(id),
    getMedia: (id) => media.get(id),
  };
}

const respond = (batch: RemoteDbSubmission): RemoteDbSubmitResponse => {
  const ok = (items: Array<{ id: string }>) => items.map((item) => ({ id: item.id, status: 'accepted' as const }));
  const total = batch.users.length + batch.posts.length + batch.media.length;
  return {
    summary: { accepted: total, unchanged: 0, partial: 0, failed: 0, total },
    users: ok(batch.users), posts: ok(batch.posts), media: ok(batch.media),
  };
};
const recordCount = (b: RemoteDbSubmission) => b.users.length + b.posts.length + b.media.length;
const noSleep = async () => {};

test('planChunks splits by record count and keeps the plan sequential in input order', () => {
  const source = makeSource(10); // 2 records per post (post + author)
  const chunks = planChunks(source.ids, source, { maxRecords: 6, maxBytes: Infinity });
  assert.deepEqual(chunks.map((c) => c.length), [3, 3, 3, 1]);
  assert.deepEqual(chunks.flat(), source.ids);
});

test('planChunks counts a record shared inside a chunk once', () => {
  const source = makeSource(8, { authors: 1 }); // one author for all: 1 + n records
  const chunks = planChunks(source.ids, source, { maxRecords: 5, maxBytes: Infinity });
  assert.deepEqual(chunks.map((c) => c.length), [4, 4]);
});

test('planChunks splits by serialized size', () => {
  const source = makeSource(6, { text: 'a'.repeat(1000) });
  const chunks = planChunks(source.ids, source, { maxRecords: 1000, maxBytes: 2500 });
  assert.ok(chunks.length > 1);
  assert.deepEqual(chunks.flat(), source.ids);
  // Multi-byte text is measured in UTF-8 bytes.
  const cjk = makeSource(4, { text: '汉'.repeat(500) });
  assert.ok(planChunks(cjk.ids, cjk, { maxRecords: 1000, maxBytes: 2000 }).length >= 2);
});

test('planChunks gives an oversized post its own chunk and skips posts not held locally', () => {
  const source = makeSource(3, { media: 10 }); // 12 records per post
  assert.deepEqual(planChunks(['p0', 'nope', 'p1', 'p0'], source, { maxRecords: 5, maxBytes: Infinity }), [['p0'], ['p1']]);
});

test('every request keeps each post with its author and media, and no request exceeds the limits', async () => {
  const source = makeSource(50, { authors: 7, media: 2 });
  const sent: RemoteDbSubmission[] = [];
  const result = await submitPostsChunked(source.ids, source, {
    submit: async (batch) => { sent.push(batch); return respond(batch); },
  }, { maxRecords: 40, maxBytes: Infinity, sleep: noSleep });

  assert.ok(sent.length > 1);
  for (const batch of sent) {
    assert.ok(recordCount(batch) <= 40);
    const userIds = new Set(batch.users.map((u) => u.id));
    const mediaIds = new Set(batch.media.map((m) => m.id));
    for (const post of batch.posts) {
      assert.ok(userIds.has(post.authorId));
      for (const id of post.mediaIds ?? []) assert.ok(mediaIds.has(id));
    }
  }
  assert.deepEqual(new Set(sent.flatMap((b) => b.posts.map((p) => p.id))), new Set(source.ids));
  assert.equal(result.posts.length, 50);
});

test('responses merge: summaries summed, arrays concatenated; progress counts posts', async () => {
  const source = makeSource(9);
  const progress: Array<[number, number]> = [];
  const result = await submitPostsChunked(source.ids, source, { submit: async (b) => respond(b) },
    { maxRecords: 6, sleep: noSleep, onProgress: (d, t) => progress.push([d, t]) });
  assert.deepEqual(result.summary, { accepted: 18, unchanged: 0, partial: 0, failed: 0, total: 18 });
  assert.equal(result.users.length, 9);
  assert.equal(result.posts.length, 9);
  assert.deepEqual(progress, [[0, 9], [3, 9], [6, 9], [9, 9]]);
  assert.equal(mergeSubmitResponses([]).summary.total, 0);
});

test('an empty selection sends nothing', async () => {
  let calls = 0;
  const result = await submitPostsChunked(['missing'], makeSource(1), { submit: async (b) => { calls += 1; return respond(b); } });
  assert.equal(calls, 0);
  assert.equal(result.summary.total, 0);
});

test('503 with Retry-After waits that long, then the chunk is retried', async () => {
  const source = makeSource(2);
  const waits: number[] = [];
  let calls = 0;
  const result = await submitPostsChunked(source.ids, source, {
    submit: async (b) => {
      calls += 1;
      if (calls <= 2) throw new RemoteDbHttpError(503, 'server busy', undefined, 7000);
      return respond(b);
    },
  }, { sleep: async (ms) => { waits.push(ms); } });
  assert.deepEqual(waits, [7000, 7000]);
  assert.equal(calls, 3);
  assert.equal(result.summary.accepted, 4);
});

test('timeouts and network errors back off 2 s, 4 s, 8 s and give up after 3 retries', async () => {
  const source = makeSource(2);
  const waits: number[] = [];
  let calls = 0;
  await assert.rejects(submitPostsChunked(source.ids, source, {
    submit: async () => { calls += 1; throw calls % 2 ? new RemoteDbTimeoutError('slow') : new RemoteDbNetworkError('down'); },
  }, { sleep: async (ms) => { waits.push(ms); } }), (error) => {
    assert.ok(error instanceof RemoteDbChunkedSubmitError);
    assert.equal(error.submittedPostIds.length, 0);
    assert.equal(error.totalPosts, 2);
    return true;
  });
  assert.equal(calls, 4);
  assert.deepEqual(waits, [2000, 4000, 8000]);
});

test('without Retry-After a 503 backs off 2 s, then 4 s', async () => {
  const waits: number[] = [];
  const source = makeSource(2);
  let calls = 0;
  await submitPostsChunked(source.ids, source, {
    submit: async (b) => { calls += 1; if (calls < 3) throw new RemoteDbHttpError(503, 'busy'); return respond(b); },
  }, { sleep: async (ms) => { waits.push(ms); } });
  assert.deepEqual(waits, [2000, 4000]);
});

test('400 and 413 split the chunk in halves; a lone post that is rejected fails the submit', async () => {
  const source = makeSource(4);
  const sizes: number[] = [];
  const result = await submitPostsChunked(source.ids, source, {
    submit: async (b) => {
      sizes.push(b.posts.length);
      if (b.posts.length > 1) throw new RemoteDbHttpError(413, 'too large');
      return respond(b);
    },
  }, { sleep: noSleep });
  assert.deepEqual(sizes, [4, 2, 1, 1, 2, 1, 1]);
  assert.equal(result.posts.length, 4);

  await assert.rejects(submitPostsChunked(source.ids, source, {
    submit: async (b) => {
      if (b.posts.some((p) => p.id === 'p2')) throw new RemoteDbHttpError(400, 'invalid_batch');
      return respond(b);
    },
  }, { sleep: noSleep }), (error) => {
    assert.ok(error instanceof RemoteDbChunkedSubmitError);
    assert.deepEqual(error.submittedPostIds, ['p0', 'p1']);
    assert.match(error.message, /已提交 2\/4 条/);
    assert.match(error.message, /invalid_batch/);
    return true;
  });
});

test('401 and 403 stop at once and are rethrown unchanged', async () => {
  const source = makeSource(6);
  for (const status of [401, 403]) {
    let calls = 0;
    const failure = new RemoteDbHttpError(status, 'nope');
    await assert.rejects(submitPostsChunked(source.ids, source, {
      submit: async (b) => { calls += 1; if (calls === 2) throw failure; return respond(b); },
    }, { maxRecords: 4, sleep: async () => assert.fail('no retry') }), (error) => error === failure);
    assert.equal(calls, 2);
  }
});

test('a failure after some chunks reports how many posts were stored, and requests never overlap', async () => {
  const source = makeSource(9);
  let inFlight = 0;
  let calls = 0;
  await assert.rejects(submitPostsChunked(source.ids, source, {
    submit: async (b) => {
      inFlight += 1;
      assert.equal(inFlight, 1);
      await Promise.resolve();
      inFlight -= 1;
      calls += 1;
      if (calls === 3) throw new RemoteDbHttpError(500, 'boom');
      return respond(b);
    },
  }, { maxRecords: 6, sleep: noSleep }), (error) => {
    assert.ok(error instanceof RemoteDbChunkedSubmitError);
    assert.equal(error.submittedPostIds.length, 6);
    assert.equal(error.totalPosts, 9);
    assert.match(error.message, /已提交 6\/9 条/);
    return true;
  });
  assert.equal(calls, 3);
});

test('a lone post fails with the original error', async () => {
  const source = makeSource(1);
  const failure = new RemoteDbHttpError(500, 'boom');
  await assert.rejects(submitPostsChunked(source.ids, source, { submit: async () => { throw failure; } }, { sleep: noSleep }), (e) => e === failure);
});

test('parseRetryAfterMs reads seconds and HTTP dates from a raw header block', () => {
  assert.equal(parseRetryAfterMs('content-type: application/json\r\nRetry-After: 5\r\nx: y'), 5000);
  assert.equal(parseRetryAfterMs('retry-after: 0\r\n'), 0);
  assert.equal(parseRetryAfterMs('Retry-After: Wed, 21 Oct 2026 07:28:10 GMT', Date.parse('Wed, 21 Oct 2026 07:28:00 GMT')), 10_000);
  assert.equal(parseRetryAfterMs('Retry-After: soon'), undefined);
  assert.equal(parseRetryAfterMs('content-type: x'), undefined);
  assert.equal(parseRetryAfterMs(undefined), undefined);
});
