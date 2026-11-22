/** Error types of the remote database client. Kept free of GM imports so tests can load them. */

/** The request did not finish in time; the server may still have processed it. */
export class RemoteDbTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteDbTimeoutError';
  }
}

/** The request failed without an HTTP response (connection error or abort). */
export class RemoteDbNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteDbNetworkError';
  }
}

export class RemoteDbHttpError extends Error {
  status: number;
  body: unknown;
  /** The `Retry-After` response header in milliseconds, when the server sent a usable one. */
  retryAfterMs?: number;

  constructor(status: number, message: string, body?: unknown, retryAfterMs?: number) {
    super(message);
    this.name = 'RemoteDbHttpError';
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

/** Reads `Retry-After` (delta-seconds or an HTTP date) from a raw header block; undefined when absent or unusable. */
export function parseRetryAfterMs(rawHeaders: string | undefined, now: number = Date.now()): number | undefined {
  const match = /^retry-after:[ \t]*(.+?)[ \t]*$/im.exec(rawHeaders ?? '');
  if (!match) return undefined;
  const value = match[1];
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}
