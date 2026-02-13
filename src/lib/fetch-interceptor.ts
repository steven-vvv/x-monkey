import { GM_log, unsafeWindow } from '$';
import { parseTweetDetailResponse } from './parser';
import { upsertTweet, upsertUser, upsertMedia } from './db-service';

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

// --- URL patterns ---
const GRAPHQL_RE = /^https:\/\/x\.com\/i\/api\/graphql\/([^/?]+)\/([^/?]+)/;
const TWEET_DETAIL_RE = /^https:\/\/x\.com\/i\/api\/graphql\/([^/]+)\/TweetDetail/;

let captureIdCounter = 0;

function extractFocalTweetId(url: string): string | null {
  try {
    const u = new URL(url);
    const vars = u.searchParams.get('variables');
    if (vars) {
      const parsed = JSON.parse(vars);
      return typeof parsed.focalTweetId === 'string' ? parsed.focalTweetId : null;
    }
  } catch { /* ignore */ }
  return null;
}

function ingestTweetDetailResponse(url: string, json: unknown): void {
  const focalId = extractFocalTweetId(url);
  if (focalId) {
    GM_log(`[TweetDetail] focalTweetId: ${focalId}`);
  }
  const parsed = parseTweetDetailResponse(json);

  for (const user of parsed.users.values()) {
    upsertUser(user);
  }

  for (const tweet of parsed.tweets.values()) {
    const isFocal = tweet.id === focalId;
    upsertTweet(tweet, isFocal);
  }

  for (const media of parsed.media.values()) {
    const tweet = parsed.tweets.get(media.tweetId);
    const isFocal = tweet ? tweet.id === focalId : false;
    upsertMedia(media, isFocal);
  }

  notifyListeners();
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

          const responseBody = this.responseText;
          const responseHeaders = this.getAllResponseHeaders();

          // Broadcast to all XHR capture listeners
          broadcastXhrCapture({
            id: String(++captureIdCounter),
            timestamp: Date.now(),
            method,
            url,
            graphqlId: match[1],
            operationName: match[2],
            status: this.status,
            statusText: this.statusText,
            responseHeaders,
            responseBody,
            responseSize: responseBody.length,
          });

          // TweetDetail-specific ingestion
          if (TWEET_DETAIL_RE.test(url) && this.status === 200) {
            try {
              const json = JSON.parse(responseBody);
              ingestTweetDetailResponse(url, json);
            } catch { /* ignore */ }
          }
        }
      });
    }
    return nativeSend.apply(this, args as any);
  };

  GM_log('[XHR Interceptor] XMLHttpRequest interceptor installed');
}
