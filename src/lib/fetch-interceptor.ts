import { GM_log, unsafeWindow } from '$';
import { getSupportedEndpoint, getTimelineNamespace, type EndpointSupportRecord } from './endpoint-support';
import { parseTimelineResponse, parseTweetDetailResponse, parseUserResponse, type TimelineParsedResponse } from './parser';
import { getDbUser, runDbBatch, upsertMedia, upsertPost, upsertUser } from './db-service';
import type { ParsedResponse } from './types';
import { buildTimelineRecordKey, ingestTimeline } from './timeline-store';

// --- Simple notification listeners (for badge count etc.) ---
type CaptureListener = () => void;

const listeners: Set<CaptureListener> = new Set();

export function onCapture(fn: CaptureListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

// --- XHR capture broadcast (fan-out to multiple subscribers) ---
export interface CapturedXhr {
  id: string;
  /** Time the response finished loading. */
  timestamp: number;
  /** Time `send()` was called. */
  startedAt: number;
  /** Page URL at the time `send()` was called. */
  pageUrl: string;
  method: string;
  url: string;
  graphqlId: string;
  operationName: string;
  /** Headers in `setRequestHeader()` call order, including sensitive values. */
  requestHeaders: Array<[string, string]>;
  requestBody: string | null;
  status: number;
  statusText: string;
  responseHeaders: string;
  responseBody: string;
  responseSize: number;
}

type XhrCaptureListener = (data: CapturedXhr) => void;
const xhrCaptureListeners: Set<XhrCaptureListener> = new Set();

export function onXhrCapture(fn: XhrCaptureListener): () => void {
  xhrCaptureListeners.add(fn);
  return () => xhrCaptureListeners.delete(fn);
}

function broadcastXhrCapture(data: CapturedXhr) {
  xhrCaptureListeners.forEach((fn) => fn(data));
}

// --- URL patterns ---
const GRAPHQL_RE = /^https:\/\/x\.com\/i\/api\/graphql\/([^/?]+)\/([^/?]+)/;

let captureIdCounter = 0;

interface GraphqlRequestContext {
  method: string;
  url: string;
  graphqlId: string;
  operationName: string;
  variables: Record<string, unknown> | null;
}

interface TrackedXhrRequest {
  method: string;
  url: string;
  requestHeaders: Array<[string, string]>;
  requestBody: string | null;
  pageUrl: string;
  startedAt: number;
}

/** GET requests carry the variables in the query; POST ones (home feeds) in the JSON body. */
function extractRequestVariables(url: string, body: string | null): Record<string, unknown> | null {
  try {
    const vars = new URL(url).searchParams.get('variables');
    const parsed = vars ? JSON.parse(vars) : body ? JSON.parse(body)?.variables : null;
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch { /* ignore */ }
  return null;
}

function readStringVariable(variables: Record<string, unknown> | null, names: string[]): string | null {
  if (!variables) return null;
  for (const name of names) {
    const value = variables[name];
    if (typeof value === 'string' && value) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function logParseWarnings(label: string, parsed: ParsedResponse): void {
  if (!parsed.meta.warnings.length) return;
  GM_log(`[${label}] Parse warnings: ${parsed.meta.warnings.join(' | ')}`);
}

function ingestEntities(parsed: ParsedResponse): void {
  runDbBatch(() => {
    for (const user of parsed.users.values()) upsertUser(user);
    for (const media of parsed.media.values()) upsertMedia(media);
    for (const post of parsed.posts.values()) upsertPost(post);
  });
}

/**
 * Finds the list a response belongs to. User timelines are requested by
 * `variables.userId`; the profile handle used in feature routes is added as an
 * alias once the owner's record is known. Search results belong to their query
 * and product.
 */
function resolveTimelineIdentity(
  endpoint: EndpointSupportRecord,
  request: GraphqlRequestContext,
  parsed: TimelineParsedResponse,
): { variant?: string; scope: string | null; aliases: string[] } {
  if (endpoint.scope === 'query') {
    const query = readStringVariable(request.variables, ['rawQuery']);
    return { variant: readStringVariable(request.variables, ['product']) ?? undefined, scope: query, aliases: query ? [query] : [] };
  }

  const popularVariable = endpoint.popularVariable;
  const variant = popularVariable && request.variables?.[popularVariable] === true ? 'popular' : undefined;
  if (endpoint.scope !== 'user') return { variant, scope: null, aliases: [] };

  const ownerId = readStringVariable(request.variables, ['userId', 'rest_id']);
  const screenName = readStringVariable(request.variables, ['screen_name', 'screenName']);
  const owner = ownerId ? parsed.users.get(ownerId) ?? getDbUser(ownerId) : undefined;
  const aliases = [ownerId, screenName, owner?.handle].filter((alias): alias is string => !!alias);
  return { variant, scope: ownerId ?? screenName, aliases };
}

function ingestTimelineResponse(endpoint: EndpointSupportRecord, request: GraphqlRequestContext, parsed: TimelineParsedResponse, capturedAt: number): void {
  const label = endpoint.operationName;
  logParseWarnings(label, parsed);

  const { variant, scope, aliases } = resolveTimelineIdentity(endpoint, request, parsed);
  const namespace = getTimelineNamespace(label, variant);
  const timelineKey = buildTimelineRecordKey(namespace, scope);

  if (parsed.postIds.length === 0 && parsed.posts.size === 0) {
    GM_log(`[${label}] Parsed empty response (path: ${parsed.meta.instructionPath ?? 'n/a'}, key: ${timelineKey})`);
    return;
  }

  ingestEntities(parsed);
  ingestTimeline({
    key: timelineKey,
    namespace,
    postIds: parsed.postIds,
    aliases,
    insertMode: endpoint.prepend ? 'prepend' : 'append',
    cursor: readStringVariable(request.variables, ['cursor']) ?? undefined,
    bottomCursor: parsed.bottomCursor,
    capturedAt,
  });

  notifyListeners();
  GM_log(`[${label}] Ingested ${parsed.postIds.length} ordered posts, ${parsed.posts.size} total posts (key: ${timelineKey})`);
}

function ingestTweetDetailResponse(request: GraphqlRequestContext, parsed: ParsedResponse): void {
  logParseWarnings('TweetDetail', parsed);

  if (parsed.posts.size === 0) {
    GM_log(`[TweetDetail] Parsed empty response (path: ${parsed.meta.instructionPath ?? 'n/a'})`);
    return;
  }

  const focalId = readStringVariable(request.variables, ['focalTweetId']);
  if (focalId) GM_log(`[TweetDetail] focalTweetId: ${focalId}`);

  ingestEntities(parsed);
  notifyListeners();
}

function ingestUserResponse(request: GraphqlRequestContext, parsed: ParsedResponse): void {
  logParseWarnings(request.operationName, parsed);
  // Suspended and other unavailable accounts come without an id.
  if (parsed.users.size === 0) return;

  ingestEntities(parsed);
  notifyListeners();
}

function handleGraphqlResponse(request: GraphqlRequestContext, responseBody: string, timestamp: number): void {
  const endpoint = getSupportedEndpoint(request.operationName);
  if (!endpoint) return;

  let json: unknown;
  try {
    json = JSON.parse(responseBody);
  } catch (error) {
    GM_log(`[XHR Interceptor] Failed to parse ${request.operationName} response JSON`, error);
    return;
  }

  try {
    const observedAt = new Date(timestamp).toISOString();
    if (endpoint.kind === 'tweet-detail') {
      ingestTweetDetailResponse(request, parseTweetDetailResponse(json, observedAt));
    } else if (endpoint.kind === 'user') {
      ingestUserResponse(request, parseUserResponse(json, observedAt));
    } else {
      ingestTimelineResponse(endpoint, request, parseTimelineResponse(json, observedAt), timestamp);
    }
  } catch (error) {
    GM_log(`[XHR Interceptor] Failed to handle ${request.operationName} response`, error);
  }
}

function describeRequestBody(body: unknown): string | null {
  if (body == null) return null;
  if (typeof body === 'string') return body;
  // Non-text bodies are not used by X GraphQL requests; keep only their type.
  return `[${Object.prototype.toString.call(body).slice(8, -1)}]`;
}

export function installXhrInterceptor(): void {
  const XHR = unsafeWindow.XMLHttpRequest.prototype;
  const nativeOpen = XHR.open;
  const nativeSetRequestHeader = XHR.setRequestHeader;
  const nativeSend = XHR.send;

  // State is reset on every open() so reused XHR objects never leak data between requests.
  const trackedRequests = new WeakMap<XMLHttpRequest, TrackedXhrRequest>();
  const listenedXhrs = new WeakSet<XMLHttpRequest>();

  function handleTrackedLoad(this: XMLHttpRequest) {
    if (this.readyState !== 4) return;
    const tracked = trackedRequests.get(this);
    if (!tracked) return;
    const timestamp = Date.now();
    trackedRequests.delete(this);

    const match = GRAPHQL_RE.exec(tracked.url);
    if (!match) return;
    const request: GraphqlRequestContext = {
      method: tracked.method,
      url: tracked.url,
      graphqlId: match[1],
      operationName: match[2],
      variables: extractRequestVariables(tracked.url, tracked.requestBody),
    };

    const responseBody = this.responseText;
    const responseHeaders = this.getAllResponseHeaders();

    // Broadcast to all XHR capture listeners
    broadcastXhrCapture({
      id: String(++captureIdCounter),
      timestamp,
      startedAt: tracked.startedAt,
      pageUrl: tracked.pageUrl,
      method: tracked.method,
      url: tracked.url,
      graphqlId: request.graphqlId,
      operationName: request.operationName,
      requestHeaders: tracked.requestHeaders,
      requestBody: tracked.requestBody,
      status: this.status,
      statusText: this.statusText,
      responseHeaders,
      responseBody,
      responseSize: responseBody.length,
    });

    if (this.status === 200) {
      handleGraphqlResponse(request, responseBody, timestamp);
    }
  }

  XHR.open = function (this: XMLHttpRequest, ...args: any[]) {
    const method = String(args[0]).toUpperCase();
    const url = String(args[1]);
    if (GRAPHQL_RE.test(url)) {
      trackedRequests.set(this, {
        method,
        url,
        requestHeaders: [],
        requestBody: null,
        pageUrl: '',
        startedAt: 0,
      });
    } else {
      trackedRequests.delete(this);
    }
    return nativeOpen.apply(this, args as any);
  };

  XHR.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const result = nativeSetRequestHeader.call(this, name, value);
    trackedRequests.get(this)?.requestHeaders.push([String(name), String(value)]);
    return result;
  };

  XHR.send = function (this: XMLHttpRequest, ...args: any[]) {
    const tracked = trackedRequests.get(this);
    if (tracked) {
      tracked.requestBody = describeRequestBody(args[0]);
      tracked.pageUrl = unsafeWindow.location.href;
      tracked.startedAt = Date.now();
      if (!listenedXhrs.has(this)) {
        listenedXhrs.add(this);
        this.addEventListener('load', handleTrackedLoad);
      }
    }
    return nativeSend.apply(this, args as any);
  };

  GM_log('[XHR Interceptor] XMLHttpRequest interceptor installed');
}
