import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appendWithLimits } from './incompat-buffer.ts';
import { diagnoseResponse, type IncompatRecord } from './incompat-diagnosis.ts';
import { buildIncompatCaptureExport, buildXhrCaptureExport, getIncompatExportFilename } from './xhr-capture-export.ts';
import type { CapturedXhr } from './captured-xhr.ts';

function makeCapture(id: string, responseBody = '{"data":{}}'): CapturedXhr {
  return {
    id, timestamp: 2000, startedAt: 1000, pageUrl: 'https://x.com/home', method: 'GET',
    url: 'https://x.com/i/api/graphql/abc/HomeTimeline?variables=%7B%22count%22%3A20%7D',
    graphqlId: 'abc', operationName: 'HomeTimeline',
    requestHeaders: [['authorization', 'Bearer secret'], ['Cookie', 'auth_token=secret'], ['x-csrf-token', 'secret'], ['accept', '*/*']],
    requestBody: null, status: 200, statusText: 'OK', responseHeaders: 'content-type: application/json\r\n',
    responseBody, responseSize: responseBody.length,
  };
}

const size = (item: { body: string }) => item.body.length;
const item = (body: string) => ({ body });

test('ring buffer evicts the oldest entries beyond the record limit', () => {
  let list: Array<{ body: string }> = [];
  let dropped = 0;
  for (let i = 0; i < 5; i++) {
    const result = appendWithLimits(list, item(String(i)), size, { maxRecords: 3, maxChars: 1000 });
    list = result.list;
    dropped += result.dropped;
  }
  assert.deepEqual(list.map((x) => x.body), ['2', '3', '4']);
  assert.equal(dropped, 2);
});

test('ring buffer evicts by total body size and always keeps the newest entry', () => {
  const limits = { maxRecords: 100, maxChars: 10 };
  let result = appendWithLimits([], item('aaaa'), size, limits);
  result = appendWithLimits(result.list, item('bbbb'), size, limits);
  assert.equal(result.dropped, 0);
  result = appendWithLimits(result.list, item('cccc'), size, limits);
  assert.deepEqual(result.list.map((x) => x.body), ['bbbb', 'cccc']);
  assert.equal(result.dropped, 1);
  result = appendWithLimits(result.list, item('x'.repeat(50)), size, limits);
  assert.deepEqual(result.list.map((x) => x.body.length), [50]);
  assert.equal(result.dropped, 2);
});

test('diagnosis: invalid JSON, handler errors', () => {
  const invalid = diagnoseResponse('timeline', { stage: 'json', error: new SyntaxError('Unexpected token <') });
  assert.equal(invalid?.reason, 'invalid-json');
  assert.deepEqual(invalid?.messages, ['Unexpected token <']);
  const failed = diagnoseResponse('user', { stage: 'handler', json: { errors: [{}, {}] }, error: new Error('boom') });
  assert.equal(failed?.reason, 'handler-error');
  assert.equal(failed?.graphqlErrorCount, 2);
  assert.deepEqual(failed?.messages, ['boom']);
});

test('diagnosis: no instructions vs partial warnings vs clean', () => {
  const none = diagnoseResponse('timeline', {
    stage: 'parsed', json: { errors: [{ code: 1 }] }, meta: { instructionPath: null, warnings: ['timeline: no instructions found at known paths'] },
  });
  assert.equal(none?.reason, 'no-instructions');
  assert.equal(none?.graphqlErrorCount, 1);
  const partial = diagnoseResponse('timeline', {
    stage: 'parsed', json: {}, meta: { instructionPath: 'data.home.home_timeline_urt.instructions', warnings: ['a', 'b'] },
  });
  assert.equal(partial?.reason, 'parse-warnings');
  assert.deepEqual(partial?.messages, ['a', 'b']);
  assert.equal(partial?.instructionPath, 'data.home.home_timeline_urt.instructions');
  assert.equal(diagnoseResponse('timeline', { stage: 'parsed', json: {}, meta: { instructionPath: 'p', warnings: [] } }), null);
  // Errors alone are information, not a trigger.
  assert.equal(diagnoseResponse('tweet-detail', { stage: 'parsed', json: { errors: [{}] }, meta: { instructionPath: 'p', warnings: [] } }), null);
  // UserUnavailable parses without a path and without a warning.
  assert.equal(diagnoseResponse('user', { stage: 'parsed', json: {}, meta: { instructionPath: null, warnings: [] } }), null);
});

test('incompat export carries the diagnosis and still redacts credentials', () => {
  const record: IncompatRecord = {
    capture: makeCapture('7'),
    diagnosis: { reason: 'parse-warnings', operationKind: 'timeline', messages: ['dropped one'], instructionPath: 'p', graphqlErrorCount: 0 },
  };
  const text = buildIncompatCaptureExport([record]);
  assert.ok(!text.includes('secret'));
  const json = JSON.parse(text);
  assert.equal(json.format, 'x-monkey.xhr-capture');
  assert.equal(json.version, 1);
  assert.equal(json.records[0].diagnosis.reason, 'parse-warnings');
  assert.deepEqual(json.records[0].diagnosis.messages, ['dropped one']);
  assert.equal(json.records[0].request.headers.authorization, '[redacted]');
  assert.equal(json.records[0].request.headers.cookie, '[redacted]');
  assert.equal(json.records[0].request.headers.accept, '*/*');
  assert.deepEqual(json.records[0].response.body, { data: {} });
});

test('plain capture export has no diagnosis field', () => {
  const json = JSON.parse(buildXhrCaptureExport([makeCapture('1')]));
  assert.equal('diagnosis' in json.records[0], false);
});

test('incompat export filename', () => {
  assert.match(getIncompatExportFilename(3), /^xhr-incompat-\d{8}-\d{6}-3\.json$/);
});
