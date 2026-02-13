import { GM_log, unsafeWindow } from '$';
import { parseTweetDetailResponse } from './parser';
import { upsertTweet, upsertUser, upsertMedia } from './db-service';

type CaptureListener = () => void;

const listeners: Set<CaptureListener> = new Set();

export function onCapture(fn: CaptureListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

const TWEET_DETAIL_RE = /^https:\/\/x\.com\/i\/api\/graphql\/([^/]+)\/TweetDetail/;

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

function ingestResponse(url: string, json: unknown): void {
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

  const trackedUrls = new WeakMap<XMLHttpRequest, string>();

  XHR.open = function (this: XMLHttpRequest, ...args: any[]) {
    const url = String(args[1]);
    if (TWEET_DETAIL_RE.test(url)) {
      trackedUrls.set(this, url);
    }
    return nativeOpen.apply(this, args as any);
  };

  XHR.send = function (this: XMLHttpRequest, ...args: any[]) {
    const tracked = trackedUrls.get(this);
    if (tracked) {
      this.addEventListener('load', function () {
        if (this.readyState === 4 && this.status === 200) {
          try {
            const json = JSON.parse(this.responseText);
            ingestResponse(tracked, json);
          } catch { /* ignore */ }
        }
      });
    }
    return nativeSend.apply(this, args as any);
  };

  GM_log('[XHR Interceptor] XMLHttpRequest interceptor installed');
}
