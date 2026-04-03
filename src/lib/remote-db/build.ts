import type { RemoteDbBuildConfig } from './types';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeRemoteDbBaseUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  if (parsed.search || parsed.hash) {
    return null;
  }

  return trimTrailingSlash(parsed.toString());
}

export function isValidRemoteDbBaseUrl(raw: string | null | undefined): boolean {
  return normalizeRemoteDbBaseUrl(raw) !== null;
}

export const REMOTE_DB_BUILD = Object.freeze<RemoteDbBuildConfig>({
  enabled: __XD_REMOTE_DB_ENABLED__,
  configurable: __XD_REMOTE_DB_CONFIGURABLE__,
  defaultBaseUrl: normalizeRemoteDbBaseUrl(__XD_REMOTE_DB_DEFAULT_BASE_URL__),
});
