import { reactive } from 'vue';
import { REMOTE_DB_BUILD, normalizeRemoteDbBaseUrl } from './build';
import type {
  RemoteDbClientConfig,
  RemoteDbClientState,
  RemoteDbIngestResponse,
  RemoteDbPostStatusItem,
  RemoteDbSessionResponse,
  RemoteDbSubmissionEnvelope,
} from './types';

const remoteDbState = reactive<RemoteDbClientState>({
  enabled: false,
  runtimeEnabled: false,
  configurable: false,
  defaultBaseUrl: REMOTE_DB_BUILD.defaultBaseUrl,
  baseUrl: null,
  lifecycle: 'disabled',
  sessionState: 'unknown',
  session: null,
  lastError: null,
  lastCheckedAt: null,
});

export async function configureRemoteDbClient(config: RemoteDbClientConfig): Promise<void> {
  remoteDbState.defaultBaseUrl = REMOTE_DB_BUILD.defaultBaseUrl;
  remoteDbState.baseUrl = normalizeRemoteDbBaseUrl(config.baseUrl);
  remoteDbState.enabled = false;
  remoteDbState.runtimeEnabled = false;
  remoteDbState.configurable = false;
  remoteDbState.lifecycle = 'disabled';
  remoteDbState.sessionState = 'unknown';
  remoteDbState.session = null;
  remoteDbState.lastError = null;
  remoteDbState.lastCheckedAt = Date.now();
}

export function getRemoteDbClientState(): RemoteDbClientState {
  return remoteDbState;
}

export async function refreshRemoteDbSession(): Promise<RemoteDbSessionResponse | null> {
  await configureRemoteDbClient({
    runtimeEnabled: false,
    baseUrl: remoteDbState.baseUrl,
  });
  return null;
}

export function isRemoteDbPostApiReady(): boolean {
  return false;
}

export async function queryRemoteDbPostStatus(_postId: string): Promise<RemoteDbPostStatusItem> {
  throw new Error('Remote database integration is disabled');
}

export async function submitRemoteDbSubmission(
  _payload: RemoteDbSubmissionEnvelope,
): Promise<RemoteDbIngestResponse> {
  throw new Error('Remote database integration is disabled');
}
