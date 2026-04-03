/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
//// <reference types="vite-plugin-monkey/global" />
/// <reference types="vite-plugin-monkey/style" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare const __XD_REMOTE_DB_ENABLED__: boolean;
declare const __XD_REMOTE_DB_CONFIGURABLE__: boolean;
declare const __XD_REMOTE_DB_DEFAULT_BASE_URL__: string | null;

interface Window {
  __XD_CSS_SINK__?: (cssText: string) => void;
  __XD_CSS_QUEUE__?: string[];
  onurlchange?: null;
  addEventListener(type: 'urlchange', cb: (data: { url: string }) => void): void;
  removeEventListener(type: 'urlchange', cb: (...args: any[]) => void): void;
}
