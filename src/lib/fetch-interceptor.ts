import { GM_log, unsafeWindow } from '$';
import {
  parseHomeLatestTimelineResponse,
  parseHomeTimelineResponse,
  parseTweetDetailResponse,
  parseUserMediaResponse,
  parseUserTweetsResponse,
  type TimelineParsedResponse,
} from './parser';
import { runDbBatch, upsertTweet, upsertUser, upsertMedia } from './db-service';
import type { ParsedResponse } from './types';
import {
  clearTimeline,
  getTimelineTweetIds,
  getTimelineVersion,
  getUserMediaTimelineKey,
  ingestTimeline,
  setActiveUserMediaTimelineKey,
} from './timeline-store';

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
  timestamp: number;
  method: string;
  url: string;
  graphqlId: string;
  operationName: string;
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

export function getUserMediaTweetIds(): string[] {
  return getTimelineTweetIds(getUserMediaTimelineKey());
}

export function getUserMediaVersion(): number {
  return getTimelineVersion(getUserMediaTimelineKey());
}

export function clearUserMediaStore(): void {
  clearTimeline(getUserMediaTimelineKey());
  setActiveUserMediaTimelineKey('UserMedia');
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

interface EndpointHandler<TParsed extends ParsedResponse> {
  label: string;
  parse: (json: unknown) => TParsed;
  handle: (request: GraphqlRequestContext, parsed: TParsed) => void;
}

function extractRequestVariables(url: string): Record<string, unknown> | null {
  try {
    const u = new URL(url);
    const vars = u.searchParams.get('variables');
    if (vars) {
      const parsed = JSON.parse(vars);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    }
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

function resolveTimelineKey(request: GraphqlRequestContext): string {
  const scope = readStringVariable(request.variables, ['userId', 'rest_id', 'screen_name', 'screenName']);
  return scope ? `${request.operationName}:${scope}` : request.operationName;
}

function logParseWarnings(label: string, parsed: ParsedResponse): void {
  if (!parsed.meta?.warnings?.length) return;
  GM_log(`[${label}] Parse warnings: ${parsed.meta.warnings.join(' | ')}`);
}

function ingestTimelineEntities(parsed: ParsedResponse, focalId?: string | null): void {
  runDbBatch(() => {
    for (const user of parsed.users.values()) {
      upsertUser(user);
    }

    for (const tweet of parsed.tweets.values()) {
      const isFocal = focalId != null && tweet.id === focalId;
      upsertTweet(tweet, isFocal);
    }

    for (const media of parsed.media.values()) {
      const tweet = parsed.tweets.get(media.tweetId);
      const isFocal = focalId != null && tweet?.id === focalId;
      upsertMedia(media, isFocal);
    }
  });
}

function ingestTimelineResponse(
  label: string,
  request: GraphqlRequestContext,
  parsed: TimelineParsedResponse,
  onTimelineKeyResolved?: (timelineKey: string) => void,
): void {
  logParseWarnings(label, parsed);

  const timelineKey = resolveTimelineKey(request);
  onTimelineKeyResolved?.(timelineKey);

  if (parsed.tweetIds.length === 0 && parsed.tweets.size === 0) {
    GM_log(`[${label}] Parsed empty response (path: ${parsed.meta?.instructionPath ?? 'n/a'}, key: ${timelineKey})`);
    return;
  }

  ingestTimelineEntities(parsed);
  ingestTimeline(timelineKey, parsed.tweetIds);

  notifyListeners();
  GM_log(`[${label}] Ingested ${parsed.tweetIds.length} ordered tweets, ${parsed.tweets.size} total tweets (key: ${timelineKey})`);
}

function ingestTweetDetailResponse(request: GraphqlRequestContext, parsed: ParsedResponse): void {
  logParseWarnings('TweetDetail', parsed);

  const focalId = readStringVariable(request.variables, ['focalTweetId']);
  if (parsed.tweets.size === 0) {
    GM_log(`[TweetDetail] Parsed empty response (path: ${parsed.meta?.instructionPath ?? 'n/a'})`);
    return;
  }
  if (focalId) {
    GM_log(`[TweetDetail] focalTweetId: ${focalId}`);
  }

  ingestTimelineEntities(parsed, focalId);
  notifyListeners();
}

const ENDPOINT_HANDLERS: Record<string, EndpointHandler<any>> = {
  TweetDetail: {
    label: 'TweetDetail',
    parse: parseTweetDetailResponse,
    handle: (request, parsed: ParsedResponse) => {
      ingestTweetDetailResponse(request, parsed);
    },
  },
  HomeTimeline: {
    label: 'HomeTimeline',
    parse: parseHomeTimelineResponse,
    handle: (request, parsed: TimelineParsedResponse) => {
      ingestTimelineResponse('HomeTimeline', request, parsed);
    },
  },
  HomeLatestTimeline: {
    label: 'HomeLatestTimeline',
    parse: parseHomeLatestTimelineResponse,
    handle: (request, parsed: TimelineParsedResponse) => {
      ingestTimelineResponse('HomeLatestTimeline', request, parsed);
    },
  },
  UserTweets: {
    label: 'UserTweets',
    parse: parseUserTweetsResponse,
    handle: (request, parsed: TimelineParsedResponse) => {
      ingestTimelineResponse('UserTweets', request, parsed);
    },
  },
  UserMedia: {
    label: 'UserMedia',
    parse: parseUserMediaResponse,
    handle: (request, parsed: TimelineParsedResponse) => {
      ingestTimelineResponse('UserMedia', request, parsed, (timelineKey) => {
        setActiveUserMediaTimelineKey(timelineKey);
      });
    },
  },
};

function handleGraphqlResponse(request: GraphqlRequestContext, responseBody: string): void {
  const endpoint = ENDPOINT_HANDLERS[request.operationName];
  if (!endpoint) return;

  let json: unknown;
  try {
    json = JSON.parse(responseBody);
  } catch (error) {
    GM_log(`[XHR Interceptor] Failed to parse ${request.operationName} response JSON`, error);
    return;
  }

  try {
    const parsed = endpoint.parse(json);
    endpoint.handle(request, parsed);
  } catch (error) {
    GM_log(`[XHR Interceptor] Failed to handle ${request.operationName} response`, error);
  }
}

export function installXhrInterceptor(): void {
  const XHR = unsafeWindow.XMLHttpRequest.prototype;
  const nativeOpen = XHR.open;
  const nativeSend = XHR.send;

  const trackedUrls = new WeakMap<XMLHttpRequest, { url: string; method: string }>();

  XHR.open = function (this: XMLHttpRequest, ...args: any[]) {
    const method = String(args[0]).toUpperCase();
    const url = String(args[1]);
    if (GRAPHQL_RE.test(url)) {
      trackedUrls.set(this, { url, method });
    }
    return nativeOpen.apply(this, args as any);
  };

  XHR.send = function (this: XMLHttpRequest, ...args: any[]) {
    const tracked = trackedUrls.get(this);
    if (tracked) {
      this.addEventListener('load', function () {
        if (this.readyState === 4) {
          const { url, method } = tracked;
          const match = GRAPHQL_RE.exec(url);
          if (!match) return;
          const request: GraphqlRequestContext = {
            method,
            url,
            graphqlId: match[1],
            operationName: match[2],
            variables: extractRequestVariables(url),
          };

          const responseBody = this.responseText;
          const responseHeaders = this.getAllResponseHeaders();

          // Broadcast to all XHR capture listeners
          broadcastXhrCapture({
            id: String(++captureIdCounter),
            timestamp: Date.now(),
            method,
            url,
            graphqlId: request.graphqlId,
            operationName: request.operationName,
            status: this.status,
            statusText: this.statusText,
            responseHeaders,
            responseBody,
            responseSize: responseBody.length,
          });

          if (this.status === 200) {
            handleGraphqlResponse(request, responseBody);
          }
        }
      });
    }
    return nativeSend.apply(this, args as any);
  };

  GM_log('[XHR Interceptor] XMLHttpRequest interceptor installed');
}
