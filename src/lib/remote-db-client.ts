import { reactive } from 'vue';
import { GM_log, GM_xmlhttpRequest } from '$';
import { REMOTE_DB_BUILD, normalizeRemoteDbBaseUrl } from './remote-db-build';
import type {
  RemoteDbClientState,
  RemoteDbIngestResponse,
  RemoteDbPostStatusItem,
  RemoteDbPostStatusQueryResponse,
  RemoteDbSessionResponse,
  RemoteDbSessionState,
  RemoteDbSubmissionEnvelope,
} from './remote-db-types';

const REMOTE_DB_REQUEST_TIMEOUT_MS = 15000;

interface JsonRequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

interface JsonResponse<T> {
  status: number;
  data: T;
}

const remoteDbState = reactive<RemoteDbClientState>({
  enabled: REMOTE_DB_BUILD.enabled,
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

function setDisabledState(): void {
  remoteDbState.enabled = false;
  remoteDbState.configurable = false;
  remoteDbState.defaultBaseUrl = null;
  remoteDbState.baseUrl = null;
  remoteDbState.lifecycle = 'disabled';
  remoteDbState.sessionState = 'unknown';
  remoteDbState.session = null;
  remoteDbState.lastError = null;
  remoteDbState.lastCheckedAt = null;
}

function deriveSessionState(session: RemoteDbSessionResponse): RemoteDbSessionState {
  if (!session.authenticated) return 'anonymous';
  if (!session.registered) return 'pending_registration';
  return 'authenticated';
}

function applySessionResult(baseUrl: string, session: RemoteDbSessionResponse): void {
  remoteDbState.enabled = REMOTE_DB_BUILD.enabled;
  remoteDbState.configurable = REMOTE_DB_BUILD.configurable;
  remoteDbState.defaultBaseUrl = REMOTE_DB_BUILD.defaultBaseUrl;
  remoteDbState.baseUrl = baseUrl;
  remoteDbState.lifecycle = 'ready';
  remoteDbState.sessionState = deriveSessionState(session);
  remoteDbState.session = session;
  remoteDbState.lastError = null;
  remoteDbState.lastCheckedAt = Date.now();
}

function applySessionError(baseUrl: string | null, message: string): void {
  remoteDbState.enabled = REMOTE_DB_BUILD.enabled;
  remoteDbState.configurable = REMOTE_DB_BUILD.configurable;
  remoteDbState.defaultBaseUrl = REMOTE_DB_BUILD.defaultBaseUrl;
  remoteDbState.baseUrl = baseUrl;
  remoteDbState.lifecycle = 'error';
  remoteDbState.sessionState = 'error';
  remoteDbState.session = null;
  remoteDbState.lastError = message;
  remoteDbState.lastCheckedAt = Date.now();
}

function setUnconfiguredState(): void {
  remoteDbState.enabled = REMOTE_DB_BUILD.enabled;
  remoteDbState.configurable = REMOTE_DB_BUILD.configurable;
  remoteDbState.defaultBaseUrl = REMOTE_DB_BUILD.defaultBaseUrl;
  remoteDbState.baseUrl = null;
  remoteDbState.lifecycle = 'unconfigured';
  remoteDbState.sessionState = 'unknown';
  remoteDbState.session = null;
  remoteDbState.lastError = null;
  remoteDbState.lastCheckedAt = null;
}

function getConfiguredBaseUrl(): string {
  if (!REMOTE_DB_BUILD.enabled) {
    throw new Error('Remote database is disabled at build time');
  }

  if (!remoteDbState.baseUrl) {
    throw new Error('Remote database base URL is not configured');
  }

  return remoteDbState.baseUrl;
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

async function requestJson<T>(options: JsonRequestOptions): Promise<JsonResponse<T>> {
  const baseUrl = getConfiguredBaseUrl();
  const url = buildRequestUrl(baseUrl, options.path);
  const responseText = await gmRequest(url, options);
  const data = responseText ? JSON.parse(responseText) as T : null as T;
  return {
    status: 200,
    data,
  };
}

async function refreshSessionInternal(baseUrl: string, token: number): Promise<RemoteDbSessionResponse | null> {
  remoteDbState.enabled = REMOTE_DB_BUILD.enabled;
  remoteDbState.configurable = REMOTE_DB_BUILD.configurable;
  remoteDbState.defaultBaseUrl = REMOTE_DB_BUILD.defaultBaseUrl;
  remoteDbState.baseUrl = baseUrl;
  remoteDbState.lifecycle = 'initializing';
  remoteDbState.sessionState = 'checking';
  remoteDbState.lastError = null;

  try {
    const { data } = await requestJson<RemoteDbSessionResponse>({
      method: 'GET',
      path: '/api/v1/session',
    });

    if (token !== sessionRequestToken) {
      return null;
    }

    applySessionResult(baseUrl, data);
    return data;
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

export function getRemoteDbClientState(): RemoteDbClientState {
  return remoteDbState;
}

export async function configureRemoteDbClient(rawBaseUrl: string | null | undefined): Promise<void> {
  if (!REMOTE_DB_BUILD.enabled) {
    setDisabledState();
    return;
  }

  const normalizedBaseUrl = normalizeRemoteDbBaseUrl(rawBaseUrl);
  sessionRequestToken += 1;
  const currentToken = sessionRequestToken;

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

  const baseUrl = remoteDbState.baseUrl;
  if (!baseUrl) {
    setUnconfiguredState();
    return null;
  }

  sessionRequestToken += 1;
  const currentToken = sessionRequestToken;
  return refreshSessionInternal(baseUrl, currentToken);
}

export function isRemoteDbPostApiReady(): boolean {
  return remoteDbState.enabled
    && remoteDbState.lifecycle === 'ready'
    && remoteDbState.sessionState === 'authenticated'
    && Boolean(remoteDbState.baseUrl);
}

export async function queryRemoteDbPostStatus(postId: string): Promise<RemoteDbPostStatusItem> {
  if (!isRemoteDbPostApiReady()) {
    throw new Error('Remote database client is not ready for post queries');
  }

  try {
    const { data } = await requestJson<RemoteDbPostStatusQueryResponse>({
      method: 'POST',
      path: '/api/v1/posts/status/query',
      body: {
        sourceKind: 'x',
        postIds: [postId],
      },
    });

    const item = data.items[0];
    if (!item) {
      throw new Error('Remote database returned an empty post status result');
    }

    remoteDbState.lastError = null;
    return item;
  } catch (error) {
    return handleProtectedRequestError(error);
  }
}

export async function submitRemoteDbSubmission(
  payload: RemoteDbSubmissionEnvelope,
): Promise<RemoteDbIngestResponse> {
  if (!isRemoteDbPostApiReady()) {
    throw new Error('Remote database client is not ready for submissions');
  }

  try {
    const { data } = await requestJson<RemoteDbIngestResponse>({
      method: 'POST',
      path: '/api/v1/ingest/submissions',
      body: payload,
    });

    remoteDbState.lastError = null;
    return data;
  } catch (error) {
    return handleProtectedRequestError(error);
  }
}
