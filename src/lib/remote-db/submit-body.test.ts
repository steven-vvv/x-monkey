import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SUBMIT_EXPLICIT_MERGE, buildSubmitBody } from './submit-body.ts';

const batch = { users: [{ id: '1', handle: 'ann', name: 'Ann', bannerUrl: null }], posts: [], media: [] };

test('the submit body carries merge: "explicit" next to the batch', () => {
  const body = buildSubmitBody(batch, true);
  assert.equal(body.merge, 'explicit');
  assert.deepEqual(JSON.parse(JSON.stringify(body)), { merge: 'explicit', ...batch });
});

test('without explicit merge the body is the plain batch', () => {
  const body = buildSubmitBody(batch, false);
  assert.ok(!('merge' in body));
  assert.deepEqual(body, batch);
});

test('the default follows SUBMIT_EXPLICIT_MERGE', () => {
  assert.equal('merge' in buildSubmitBody(batch), SUBMIT_EXPLICIT_MERGE);
});
