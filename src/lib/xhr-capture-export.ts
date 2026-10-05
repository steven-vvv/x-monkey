import type { CapturedXhr } from './fetch-interceptor';

export const XHR_CAPTURE_EXPORT_FORMAT = 'x-monkey.xhr-capture';
export const XHR_CAPTURE_EXPORT_VERSION = 1;

/** Session credentials that must not leave the browser in exported files. */
const REDACTED_REQUEST_HEADERS = new Set(['authorization', 'cookie', 'x-csrf-token']);
const REDACTED_VALUE = '[redacted]';

const GRAPHQL_QUERY_PARAMS = ['variables', 'features', 'fieldToggles'] as const;

type GraphqlQueryParamName = (typeof GRAPHQL_QUERY_PARAMS)[number];
type BodyFormat = 'none' | 'json' | 'text';

export function hashHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function appendHeader(headers: Record<string, string>, name: string, value: string): void {
  headers[name] = name in headers ? `${headers[name]}, ${value}` : value;
}

/** Request headers keyed by lowercase name, with session credentials redacted. */
export function getCaptureRequestHeaders(capture: CapturedXhr): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [rawName, value] of capture.requestHeaders) {
    const name = rawName.trim().toLowerCase();
    appendHeader(headers, name, REDACTED_REQUEST_HEADERS.has(name) ? REDACTED_VALUE : value);
  }
  return headers;
}

export function getCaptureResponseHeaders(capture: CapturedXhr): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of capture.responseHeaders.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    appendHeader(headers, line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  }
  return headers;
}

/** Decodes a JSON-encoded GraphQL query parameter; undecodable values are returned as text. */
export function readCaptureQueryParam(capture: CapturedXhr, name: GraphqlQueryParamName): unknown {
  let raw: string | null;
  try {
    raw = new URL(capture.url).searchParams.get(name);
  } catch {
    return undefined;
  }
  if (raw == null) return undefined;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function isJsonText(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Embeds JSON bodies verbatim instead of re-serializing them, so exported
 * payloads keep X's exact text (including numbers beyond double precision).
 */
function createRawJsonWriter() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const rawValues: string[] = [];

  return {
    body(text: string | null): { bodyFormat: BodyFormat; body: unknown } {
      if (text == null) return { bodyFormat: 'none', body: null };
      if (!isJsonText(text)) return { bodyFormat: 'text', body: text };

      rawValues.push(text);
      return { bodyFormat: 'json', body: `__xd_raw_json_${token}_${rawValues.length - 1}__` };
    },
    stringify(value: unknown): string {
      const placeholder = new RegExp(`"__xd_raw_json_${token}_(\\d+)__"`, 'g');
      return JSON.stringify(value, null, 2).replace(placeholder, (_, index: string) => rawValues[Number(index)]);
    },
  };
}

function buildExportRecord(capture: CapturedXhr, writer: ReturnType<typeof createRawJsonWriter>) {
  const graphql: Record<string, unknown> = {
    queryId: capture.graphqlId,
    operationName: capture.operationName,
  };
  for (const name of GRAPHQL_QUERY_PARAMS) {
    const value = readCaptureQueryParam(capture, name);
    if (value !== undefined) graphql[name] = value;
  }

  return {
    id: capture.id,
    page: {
      url: capture.pageUrl,
    },
    timing: {
      startedAt: new Date(capture.startedAt).toISOString(),
      completedAt: new Date(capture.timestamp).toISOString(),
      durationMs: capture.timestamp - capture.startedAt,
    },
    request: {
      method: capture.method,
      url: capture.url,
      graphql,
      headers: getCaptureRequestHeaders(capture),
      ...writer.body(capture.requestBody),
    },
    response: {
      status: capture.status,
      statusText: capture.statusText,
      headers: getCaptureResponseHeaders(capture),
      ...writer.body(capture.responseBody),
    },
  };
}

/** Serializes captures (request, response and page context) into one JSON document. */
export function buildXhrCaptureExport(captures: readonly CapturedXhr[]): string {
  const writer = createRawJsonWriter();
  return writer.stringify({
    format: XHR_CAPTURE_EXPORT_FORMAT,
    version: XHR_CAPTURE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    records: captures.map((capture) => buildExportRecord(capture, writer)),
  });
}

function formatFileTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function getXhrCaptureExportFilename(captures: readonly CapturedXhr[]): string {
  if (captures.length === 1) {
    const [capture] = captures;
    return `xhr-capture-${capture.operationName}-${hashHex(capture.responseBody)}.json`;
  }
  return `xhr-capture-${formatFileTimestamp(new Date())}-${captures.length}.json`;
}
