import { reactive } from 'vue';
import { GM_log, GM_xmlhttpRequest } from '$';
import { REMOTE_DB_BUILD, normalizeRemoteDbBaseUrl } from './build';
import type {
  RemoteDbClientConfig,
  RemoteDbClientState,
  RemoteDbQueryObjectResult,
  RemoteDbQueryRequest,
  RemoteDbQueryResponse,
  RemoteDbQuerySummary,
  RemoteDbQueryTweetData,
  RemoteDbQueryUserData,
  RemoteDbSessionResponse,
  RemoteDbSessionResponseWire,
  RemoteDbSessionState,
  RemoteDbSubmissionEnvelope,
  RemoteDbSubmitResponse,
  RemoteDbTweetBundleBatchQuery,
  RemoteDbTweetBundle,
  RemoteDbTweetBundleQuery,
} from './types';

const REMOTE_DB_REQUEST_TIMEOUT_MS = 15000;

interface JsonRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

const remoteDbState = reactive<RemoteDbClientState>({
  enabled: REMOTE_DB_BUILD.enabled,
  runtimeEnabled: REMOTE_DB_BUILD.enabled,
  configurable: REMOTE_DB_BUILD.configurable,
  defaultBaseUrl: REMOTE_DB_BUILD.defaultBaseUrl,
  baseUrl: REMOTE_DB_BUILD.enabled ? REMOTE_DB_BUILD.defaultBaseUrl : null,
  lifecycle: REMOTE_DB_BUILD.enabled
    ? (REMOTE_DB_BUILD.defaultBaseUrl ? 'initializing' : 'unconfigured')
    : 'disabled',
  sessionState: REMOTE_DB_BUILD.enabled
    ? (REMOTE_DB_BUILD.defaultBaseUrl ? 'checking' : 'unknown')
    : 'unknown',
  session: null,
  lastError: null,
  lastCheckedAt: null,
});

let sessionRequestToken = 0;

export class RemoteDbHttpError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'RemoteDbHttpError';
    this.status = status;
    this.body = body;
  }
}

function applyClientState(partial: Partial<RemoteDbClientState>): void {
  remoteDbState.enabled = REMOTE_DB_BUILD.enabled;
  remoteDbState.configurable = REMOTE_DB_BUILD.configurable;
  remoteDbState.defaultBaseUrl = REMOTE_DB_BUILD.defaultBaseUrl;
  Object.assign(remoteDbState, partial);
}

function setDisabledState(): void {
  applyClientState({
    enabled: false,
    runtimeEnabled: false,
    configurable: false,
    defaultBaseUrl: null,
    baseUrl: null,
    lifecycle: 'disabled',
    sessionState: 'unknown',
    session: null,
    lastError: null,
    lastCheckedAt: null,
  });
}

function setPausedState(baseUrl: string | null): void {
  applyClientState({
    runtimeEnabled: false,
    baseUrl,
    lifecycle: 'paused',
    sessionState: 'unknown',
    session: null,
    lastError: null,
    lastCheckedAt: null,
  });
}

function setUnconfiguredState(): void {
  applyClientState({
    runtimeEnabled: true,
    baseUrl: null,
    lifecycle: 'unconfigured',
    sessionState: 'unknown',
    session: null,
    lastError: null,
    lastCheckedAt: null,
  });
}

function deriveSessionState(session: RemoteDbSessionResponse): RemoteDbSessionState {
  if (!session.authenticated) return 'anonymous';
  if (!session.registered) return 'pending_registration';
  return 'authenticated';
}

function applySessionResult(baseUrl: string, session: RemoteDbSessionResponse): void {
  applyClientState({
    runtimeEnabled: true,
    baseUrl,
    lifecycle: 'ready',
    sessionState: deriveSessionState(session),
    session,
    lastError: null,
    lastCheckedAt: Date.now(),
  });
}

function applySessionError(baseUrl: string | null, message: string): void {
  applyClientState({
    runtimeEnabled: true,
    baseUrl,
    lifecycle: 'error',
    sessionState: 'error',
    session: null,
    lastError: message,
    lastCheckedAt: Date.now(),
  });
}

function getConfiguredBaseUrl(): string {
  if (!REMOTE_DB_BUILD.enabled) {
    throw new Error('Remote database is disabled at build time');
  }

  if (!remoteDbState.runtimeEnabled) {
    throw new Error('Remote database is disabled in settings');
  }

  if (!remoteDbState.baseUrl) {
    throw new Error('Remote database base URL is not configured');
  }

  return remoteDbState.baseUrl;
}

function normalizeSessionResponse(payload: RemoteDbSessionResponseWire): RemoteDbSessionResponse {
  return {
    authenticated: payload.authenticated,
    registered: payload.registered,
    username: payload.username,
    expiresAt: payload.expires_at ?? payload.expiresAt ?? null,
    accountUrl: payload.account_url ?? payload.accountUrl ?? null,
  };
}

function extractApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function buildRequestUrl(baseUrl: string, path: string): string {
  return new URL(path.replace(/^\//, ''), `${baseUrl}/`).toString();
}

function gmRequest(url: string, options: JsonRequestOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: options.method,
      url,
      anonymous: false,
      timeout: REMOTE_DB_REQUEST_TIMEOUT_MS,
      headers: options.body === undefined
        ? { Accept: 'application/json' }
        : {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
      data: options.body === undefined ? undefined : JSON.stringify(options.body),
      responseType: 'text',
      onload: (response) => {
        if (!response.responseText.trim()) {
          if (response.status >= 200 && response.status < 300) {
            resolve('');
            return;
          }

          reject(new RemoteDbHttpError(response.status, `Remote database request failed (${response.status})`));
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(response.responseText);
        } catch {
          reject(new Error(`Remote database returned invalid JSON for ${options.path}`));
          return;
        }

        if (response.status < 200 || response.status >= 300) {
          reject(new RemoteDbHttpError(
            response.status,
            extractApiErrorMessage(payload, `Remote database request failed (${response.status})`),
            payload,
          ));
          return;
        }

        resolve(JSON.stringify(payload));
      },
      onerror: () => {
        reject(new Error(`Remote database request failed for ${options.path}`));
      },
      ontimeout: () => {
        reject(new Error(`Remote database request timed out for ${options.path}`));
      },
      onabort: () => {
        reject(new Error(`Remote database request aborted for ${options.path}`));
      },
    });
  });
}

async function requestJson<T>(options: JsonRequestOptions): Promise<T> {
  const baseUrl = getConfiguredBaseUrl();
  const url = buildRequestUrl(baseUrl, options.path);
  const responseText = await gmRequest(url, options);
  return responseText ? JSON.parse(responseText) as T : null as T;
}

async function refreshSessionInternal(
  baseUrl: string,
  token: number,
): Promise<RemoteDbSessionResponse | null> {
  applyClientState({
    runtimeEnabled: true,
    baseUrl,
    lifecycle: 'initializing',
    sessionState: 'checking',
    session: null,
    lastError: null,
  });

  try {
    const payload = await requestJson<RemoteDbSessionResponseWire>({
      method: 'GET',
      path: '/api/v1/session',
    });
    const session = normalizeSessionResponse(payload);

    if (token !== sessionRequestToken) {
      return null;
    }

    applySessionResult(baseUrl, session);
    return session;
  } catch (error) {
    if (token !== sessionRequestToken) {
      return null;
    }

    const message = toErrorMessage(error, 'Failed to initialize remote database session');
    applySessionError(baseUrl, message);
    GM_log('[Remote DB] Session initialization failed', error);
    return null;
  }
}

async function handleProtectedRequestError(error: unknown): Promise<never> {
  if (error instanceof RemoteDbHttpError && error.status === 401) {
    await refreshRemoteDbSession();
  } else {
    remoteDbState.lastError = toErrorMessage(error, 'Remote database request failed');
  }

  throw error;
}

function findResult<T>(
  results: Array<RemoteDbQueryObjectResult<T>>,
  id: string,
): RemoteDbQueryObjectResult<T> {
  return results.find((item) => item.id === id) ?? {
    id,
    status: 'failed',
    error: 'Remote database response is missing this selector result',
  };
}

function createQuerySummary(results: Array<RemoteDbQueryObjectResult<unknown>>): RemoteDbQuerySummary {
  return results.reduce<RemoteDbQuerySummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.status === 'found') summary.found += 1;
      else if (item.status === 'missing') summary.missing += 1;
      else summary.failed += 1;
      return summary;
    },
    { total: 0, found: 0, missing: 0, failed: 0 },
  );
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(Boolean) as string[])];
}

export function getRemoteDbClientState(): RemoteDbClientState {
  return remoteDbState;
}

export async function configureRemoteDbClient(config: RemoteDbClientConfig): Promise<void> {
  if (!REMOTE_DB_BUILD.enabled) {
    setDisabledState();
    return;
  }

  const normalizedBaseUrl = normalizeRemoteDbBaseUrl(config.baseUrl);
  sessionRequestToken += 1;
  const currentToken = sessionRequestToken;

  if (!config.runtimeEnabled) {
    setPausedState(normalizedBaseUrl);
    return;
  }

  if (!normalizedBaseUrl) {
    setUnconfiguredState();
    return;
  }

  await refreshSessionInternal(normalizedBaseUrl, currentToken);
}

export async function refreshRemoteDbSession(): Promise<RemoteDbSessionResponse | null> {
  if (!REMOTE_DB_BUILD.enabled) {
    setDisabledState();
    return null;
  }

  if (!remoteDbState.runtimeEnabled) {
    setPausedState(remoteDbState.baseUrl);
    return null;
  }

  const baseUrl = remoteDbState.baseUrl;
  if (!baseUrl) {
    setUnconfiguredState();
    return null;
  }

  sessionRequestToken += 1;
  const currentToken = sessionRequestToken;
  return refreshSessionInternal(baseUrl, currentToken);
}

export function isRemoteDbTweetApiReady(): boolean {
  return remoteDbState.enabled
    && remoteDbState.runtimeEnabled
    && remoteDbState.lifecycle === 'ready'
    && remoteDbState.sessionState === 'authenticated'
    && Boolean(remoteDbState.baseUrl);
}

export async function queryRemoteDbTweetBundle(
  query: RemoteDbTweetBundleQuery,
): Promise<RemoteDbTweetBundle> {
  if (!isRemoteDbTweetApiReady()) {
    throw new Error('Remote database client is not ready for tweet queries');
  }

  const normalizedMediaIds = [...new Set((query.mediaIds ?? []).filter(Boolean))];
  try {
    const body: RemoteDbQueryRequest = {
      users: query.authorId ? [{ id: query.authorId }] : [],
      tweets: [{ id: query.tweetId }],
      media: normalizedMediaIds.map((id) => ({ id })),
    };
    const payload = await requestJson<RemoteDbQueryResponse>({
      method: 'POST',
      path: '/api/v1/tweet/query',
      body,
    });

    remoteDbState.lastError = null;

    return {
      summary: payload.summary,
      tweet: findResult(payload.tweets, query.tweetId),
      author: query.authorId ? findResult(payload.users, query.authorId) : null,
      media: normalizedMediaIds.map((id) => findResult(payload.media, id)),
    };
  } catch (error) {
    return handleProtectedRequestError(error);
  }
}

export async function queryRemoteDbTweetBundles(
  query: RemoteDbTweetBundleBatchQuery,
): Promise<RemoteDbTweetBundle[]> {
  if (!isRemoteDbTweetApiReady()) {
    throw new Error('Remote database client is not ready for tweet queries');
  }

  const normalizedItems = query.items
    .filter((item) => item.tweetId)
    .map((item) => ({
      tweetId: item.tweetId,
      authorId: item.authorId ?? null,
      mediaIds: uniqueValues(item.mediaIds ?? []),
    }));

  if (normalizedItems.length === 0) {
    return [];
  }

  try {
    const body: RemoteDbQueryRequest = {
      users: uniqueValues(normalizedItems.map((item) => item.authorId)).map((id) => ({ id })),
      tweets: uniqueValues(normalizedItems.map((item) => item.tweetId)).map((id) => ({ id })),
      media: uniqueValues(normalizedItems.flatMap((item) => item.mediaIds)).map((id) => ({ id })),
    };
    const payload = await requestJson<RemoteDbQueryResponse>({
      method: 'POST',
      path: '/api/v1/tweet/query',
      body,
    });

    remoteDbState.lastError = null;

    return normalizedItems.map((item) => {
      const tweet = findResult(payload.tweets, item.tweetId);
      const author = item.authorId ? findResult(payload.users, item.authorId) : null;
      const media = item.mediaIds.map((id) => findResult(payload.media, id));
      const summary = createQuerySummary([
        tweet,
        ...(author ? [author] : []),
        ...media,
      ]);

      return {
        summary,
        tweet,
        author,
        media,
      };
    });
  } catch (error) {
    return handleProtectedRequestError(error);
  }
}

export async function submitRemoteDbSubmission(
  payload: RemoteDbSubmissionEnvelope,
): Promise<RemoteDbSubmitResponse> {
  if (!isRemoteDbTweetApiReady()) {
    throw new Error('Remote database client is not ready for submissions');
  }

  try {
    const response = await requestJson<RemoteDbSubmitResponse>({
      method: 'POST',
      path: '/api/v1/tweet/submit',
      body: payload,
    });

    remoteDbState.lastError = null;
    return response;
  } catch (error) {
    return handleProtectedRequestError(error);
  }
}

export type {
  RemoteDbQueryTweetData,
  RemoteDbQueryUserData,
};
