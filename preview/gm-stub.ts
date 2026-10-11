/**
 * In-browser stand-in for the Tampermonkey API ('$' in vite-plugin-monkey).
 * Aliased in vite.preview.config.ts; never part of the userscript build.
 */
import { handleMockRequest, type MockRequestDetails } from './remote-mock';

export type GmValueListenerId = string | number;

declare global {
  interface Window {
    __gmMenu?: Map<string, { caption: string; run: () => void }>;
    __gmLog?: unknown[][];
  }
}

const query = new URLSearchParams(window.location.search);
/** The x.com URL the page pretends to be on. */
export const simulatedUrl = query.get('url') ?? 'https://x.com/home';

const values = new Map<string, unknown>();
const valueListeners = new Map<GmValueListenerId, { name: string; cb: (name: string, oldValue?: unknown, newValue?: unknown, remote?: boolean) => void }>();
let nextId = 1;

const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)) as T);

export function GM_getValue<T>(name: string, defaultValue?: T): Promise<T> {
  return Promise.resolve(values.has(name) ? clone(values.get(name)) as T : defaultValue as T);
}

export function GM_setValue(name: string, value: unknown): void {
  const old = values.get(name);
  values.set(name, clone(value));
  for (const listener of valueListeners.values()) {
    if (listener.name === name) listener.cb(name, old, clone(value), false);
  }
}

export function GM_addValueChangeListener(name: string, cb: (name: string, oldValue?: unknown, newValue?: unknown, remote?: boolean) => void): GmValueListenerId {
  const id = nextId++;
  valueListeners.set(id, { name, cb });
  return id;
}

export function GM_removeValueChangeListener(id: GmValueListenerId): void {
  valueListeners.delete(id);
}

export function GM_log(...args: unknown[]): void {
  (window.__gmLog ??= []).push(args);
  console.log('[gm]', ...args);
}

export function GM_registerMenuCommand(caption: string, run: () => void, options?: string | { id?: string | number }): string | number {
  const id = typeof options === 'object' && options?.id !== undefined ? options.id : nextId++;
  (window.__gmMenu ??= new Map()).set(String(id), { caption, run });
  return id;
}

export function GM_unregisterMenuCommand(id: string | number): void {
  window.__gmMenu?.delete(String(id));
}

export function GM_openInTab(url: string, options?: unknown): void {
  console.log('[gm] GM_openInTab', url, options ?? '');
}

export function GM_download(details: unknown, name?: string): void {
  console.log('[gm] GM_download', details, name ?? '');
}

export function GM_setClipboard(data: string, info?: unknown): void {
  console.log('[gm] GM_setClipboard', data.length > 200 ? `${data.slice(0, 200)}... (${data.length} chars)` : data, info ?? '');
}

export function GM_xmlhttpRequest(details: MockRequestDetails): { abort(): void } {
  return handleMockRequest(details);
}

const fakeLocation = new Proxy(window.location, {
  get(target, prop) {
    if (prop === 'href') return simulatedUrl;
    if (prop === 'toString') return () => simulatedUrl;
    const value = Reflect.get(target, prop, target) as unknown;
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/** The real window, except that `location.href` reports the simulated x.com URL. */
export const unsafeWindow: Window & typeof globalThis = new Proxy(window, {
  get(target, prop) {
    if (prop === 'location') return fakeLocation;
    const value = Reflect.get(target, prop, target) as unknown;
    // Bind plain functions (addEventListener, getComputedStyle ...) but leave constructors alone.
    if (typeof value === 'function' && !/^[A-Z]/.test(value.name)) return value.bind(target);
    return value;
  },
  set(target, prop, value) {
    return Reflect.set(target, prop, value, target);
  },
});
