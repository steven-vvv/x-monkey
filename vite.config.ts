import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import monkey, { cdn } from 'vite-plugin-monkey';

const cssSideEffects = (css: string): void => {
  const globalObj = globalThis as {
    __XD_CSS_SINK__?: (cssText: string) => void;
    __XD_CSS_QUEUE__?: string[];
  };

  if (typeof globalObj.__XD_CSS_SINK__ === 'function') {
    globalObj.__XD_CSS_SINK__(css);
    return;
  }

  if (!Array.isArray(globalObj.__XD_CSS_QUEUE__)) {
    globalObj.__XD_CSS_QUEUE__ = [];
  }
  globalObj.__XD_CSS_QUEUE__.push(css);
};

export default defineConfig({
  build: {
    minify: true,
  },
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'X Downloader',
        namespace: 'x-downloader',
        match: ['https://x.com/*'],
        "run-at": 'document-start',
        sandbox: 'JavaScript',
      },
      build: {
        externalGlobals: {
          vue: cdn.jsdelivr('Vue', 'dist/vue.global.prod.js'),
        },
        cssSideEffects,
      },
    }),
  ],
});
