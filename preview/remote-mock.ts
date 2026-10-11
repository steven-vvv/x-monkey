/**
 * Simulated tweet-db server behind GM_xmlhttpRequest: /api/v1/session,
 * /api/v1/archive/query and /api/v1/archive/submit.
 *
 * Scenario (`?remote=`): ready (authenticated admin), anon, expired (submit gives 401, then the
 * session turns anonymous), error (network error), off (handled by the config, no requests).
 *
 * Post query status is decided by the last digit of the post id:
 *   1 identical (in_sync) | 2 lower counts (stale) | 3 different text (mismatch) | 4 failed | else missing.
 * Users and media are always found identical. Records submitted earlier are in_sync afterwards.
 */
import type { ArchiveRecordSource } from '../src/lib/remote-db/adapter';
import type {
  RemoteDbQueryResponse,
  RemoteDbQueryResult,
  RemoteDbSubmitResponse,
  RemoteDbSubmitResult,
  RemoteDbSubmitStatus,
} from '../src/lib/remote-db/types';
import type { Post } from '../src/archive/model';

export type RemoteScenario = 'ready' | 'anon' | 'expired' | 'error' | 'off';

export interface MockRequestDetails {
  method?: string;
  url: string;
  data?: string;
  onload?: (response: any) => void;
  onerror?: (response: any) => void;
  ontimeout?: (response: any) => void;
  onabort?: (response: any) => void;
  [key: string]: unknown;
}

const LATENCY_MS = 150;
const ACCOUNT_URL = 'https://tdb.preview.local/account';

let scenario: RemoteScenario = 'ready';
let source: ArchiveRecordSource | null = null;
let sessionExpired = false;
const submitted = new Set<string>();

export function configureMock(options: { scenario: RemoteScenario; source: ArchiveRecordSource }): void {
  scenario = options.scenario;
  source = options.source;
  sessionExpired = false;
  submitted.clear();
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const lastDigit = (id: string): number => Number(id.slice(-1));

function remotePost(local: Post): RemoteDbQueryResult<Post> {
  const digit = lastDigit(local.id);
  if (digit === 4) return { id: local.id, status: 'failed', error: 'Storage backend timed out' };
  const copy = clone(local);
  if (submitted.has(`post:${local.id}`) || digit === 1) return { id: local.id, status: 'found', data: copy };
  if (digit === 2) {
    if (copy.counts) {
      for (const key of Object.keys(copy.counts) as Array<keyof NonNullable<Post['counts']>>) {
        copy.counts[key] = Math.floor((copy.counts[key] ?? 0) * 0.8);
      }
    }
    return { id: local.id, status: 'found', data: copy };
  }
  if (digit === 3) {
    if (copy.text) copy.text = { text: `${copy.text.text} (earlier revision)` };
    else copy.createdAt = new Date(Date.parse(copy.createdAt) - 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    return { id: local.id, status: 'found', data: copy };
  }
  return { id: local.id, status: 'missing' };
}

function query(body: { users?: string[]; posts?: string[]; media?: string[] }): RemoteDbQueryResponse {
  const identical = <T extends { id: string }>(id: string, record: T | undefined): RemoteDbQueryResult<T> =>
    record ? { id, status: 'found', data: clone(record) } : { id, status: 'missing' };
  return {
    users: (body.users ?? []).map((id) => identical(id, source?.getUser(id))),
    posts: (body.posts ?? []).map((id) => {
      const local = source?.getPost(id);
      return local ? remotePost(local) : { id, status: 'missing' as const };
    }),
    media: (body.media ?? []).map((id) => identical(id, source?.getMedia(id))),
  };
}

function submit(body: { users?: Array<{ id: string }>; posts?: Array<{ id: string }>; media?: Array<{ id: string }> }): RemoteDbSubmitResponse {
  const result = (kind: string, id: string): RemoteDbSubmitResult => {
    const key = `${kind}:${id}`;
    const digit = lastDigit(id);
    if (kind === 'post' && digit === 4) return { id, status: 'failed', reason: 'Validation failed: unsupported card type' };
    if (kind === 'post' && digit === 9) { submitted.add(key); return { id, status: 'partial', reason: 'Media scheduling failed; will retry' }; }
    const status: RemoteDbSubmitStatus = submitted.has(key) || (kind === 'post' && digit === 1) ? 'unchanged' : 'accepted';
    submitted.add(key);
    return { id, status };
  };
  const users = (body.users ?? []).map((item) => result('user', item.id));
  const posts = (body.posts ?? []).map((item) => result('post', item.id));
  const media = (body.media ?? []).map((item) => result('media', item.id));
  const summary = { total: 0, accepted: 0, unchanged: 0, partial: 0, failed: 0 };
  for (const item of [...users, ...posts, ...media]) { summary.total += 1; summary[item.status] += 1; }
  return { summary, users, posts, media };
}

interface Reply { status: number; body: unknown }

function route(details: MockRequestDetails): Reply {
  const path = new URL(details.url).pathname;
  const body = details.data ? JSON.parse(details.data) as Record<string, never> : {};

  if (path === '/api/v1/session') {
    if ((scenario === 'ready' || scenario === 'expired') && !sessionExpired) {
      return { status: 200, body: { authenticated: true, registered: true, username: 'steven', role: 'admin', expires_at: '2026-10-12T00:00:00Z', account_url: ACCOUNT_URL } };
    }
    return { status: 200, body: { authenticated: false, registered: false, username: null, account_url: ACCOUNT_URL } };
  }
  if (path === '/api/v1/archive/query') return { status: 200, body: query(body) };
  if (path === '/api/v1/archive/submit') {
    if (scenario === 'expired') { sessionExpired = true; return { status: 401, body: { error: 'Session expired, please sign in again' } }; }
    return { status: 200, body: submit(body) };
  }
  return { status: 404, body: { error: `No route for ${path}` } };
}

export function handleMockRequest(details: MockRequestDetails): { abort(): void } {
  const timer = window.setTimeout(() => {
    if (scenario === 'error') { details.onerror?.({ error: 'Network error (preview mock)', status: 0 }); return; }
    const reply = route(details);
    const responseText = JSON.stringify(reply.body);
    details.onload?.({
      status: reply.status, statusText: reply.status === 200 ? 'OK' : 'Error', readyState: 4,
      responseText, response: responseText, responseHeaders: 'content-type: application/json\r\n', finalUrl: details.url,
    });
  }, LATENCY_MS);
  return { abort: () => { window.clearTimeout(timer); details.onabort?.({}); } };
}
