import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/** Dev-only preview harness. Never imported by vite.config.ts, so it cannot reach the userscript build. */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Strips everything the app's URL rewrites add, so one image keeps its colors. */
function mediaKey(pathname: string): string {
  return pathname
    .replace(/^\/__media\//, '')
    .replace(/\/\d+x\d+$/, '')
    .replace(/\.\w+$/, '')
    .replace(/_(normal|bigger|mini|\d+x\d+)$/, '');
}

function mediaSvg(key: string): string {
  const hash = hashString(key);
  const hueA = hash % 360;
  const hueB = (hueA + 40 + ((hash >>> 9) % 120)) % 360;
  const label = key.split('/').pop() ?? key;
  const safe = label.replace(/[<>&"]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA} 62% 52%)"/><stop offset="1" stop-color="hsl(${hueB} 58% 34%)"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>
<text x="50%" y="50%" fill="#fff" fill-opacity="0.28" font-family="sans-serif" font-size="56" text-anchor="middle" dominant-baseline="middle">${safe}</text>
</svg>`;
}

function mediaPlugin(): Plugin {
  return {
    name: 'xm-preview-media',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || !req.url?.startsWith('/__media/')) { next(); return; }
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-store');
        res.end(mediaSvg(mediaKey(pathname)));
      });
    },
  };
}

export default defineConfig({
  root: resolve(import.meta.dirname, 'preview'),
  plugins: [vue(), mediaPlugin()],
  resolve: {
    alias: { $: resolve(import.meta.dirname, 'preview/gm-stub.ts') },
  },
  define: {
    __XD_REMOTE_DB_ENABLED__: 'true',
    __XD_REMOTE_DB_CONFIGURABLE__: 'true',
    __XD_REMOTE_DB_DEFAULT_BASE_URL__: JSON.stringify('https://tdb.preview.local'),
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    fs: { allow: [import.meta.dirname] },
  },
  // Pre-bundle up front so the dev server does not reload the page mid-screenshot.
  optimizeDeps: { include: ['vue', 'zod'] },
  cacheDir: resolve(import.meta.dirname, 'node_modules/.vite-preview'),
});
