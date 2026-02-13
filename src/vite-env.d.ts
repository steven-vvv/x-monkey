/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
//// <reference types="vite-plugin-monkey/global" />
/// <reference types="vite-plugin-monkey/style" />

interface Window {
  onurlchange?: null;
  addEventListener(type: 'urlchange', cb: (data: { url: string }) => void): void;
  removeEventListener(type: 'urlchange', cb: (...args: any[]) => void): void;
}
