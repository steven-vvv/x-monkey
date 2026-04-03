import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import monkey, { cdn } from 'vite-plugin-monkey';
import remoteDbBuildConfig from './remote-db.config';

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const fileConfig = remoteDbBuildConfig ?? {};

  const remoteDbEnabled = resolveBooleanConfig(
    env.VITE_XD_REMOTE_DB_ENABLED,
    fileConfig.enabled,
    'VITE_XD_REMOTE_DB_ENABLED',
    true,
  );
  const remoteDbConfigurable = remoteDbEnabled
    ? resolveBooleanConfig(
        env.VITE_XD_REMOTE_DB_CONFIGURABLE,
        fileConfig.configurable,
        'VITE_XD_REMOTE_DB_CONFIGURABLE',
        false,
      )
    : false;
  const remoteDbDefaultBaseUrl = remoteDbEnabled
    ? normalizeConfiguredBaseUrl(resolveStringConfig(env.VITE_XD_REMOTE_DB_BASE_URL, fileConfig.baseUrl), 'VITE_XD_REMOTE_DB_BASE_URL')
    : null;

  if (remoteDbEnabled && !remoteDbConfigurable && !remoteDbDefaultBaseUrl) {
    throw new Error('VITE_XD_REMOTE_DB_BASE_URL must be a valid absolute http(s) URL when remote database is enabled and not configurable');
  }

  return {
    build: {
      minify: true,
    },
    define: {
      __XD_REMOTE_DB_ENABLED__: JSON.stringify(remoteDbEnabled),
      __XD_REMOTE_DB_CONFIGURABLE__: JSON.stringify(remoteDbConfigurable),
      __XD_REMOTE_DB_DEFAULT_BASE_URL__: JSON.stringify(remoteDbDefaultBaseUrl),
    },
    plugins: [
      vue(),
      monkey({
        entry: 'src/main.ts',
        userscript: {
          name: 'X Downloader',
          namespace: 'x-downloader',
          match: ['https://x.com/*'],
          connect: remoteDbEnabled ? ['*'] : undefined,
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
  };
});

function parseBooleanEnv(raw: string | undefined, key: string, fallback: boolean): boolean {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error(`${key} must be a boolean-like value, received "${raw}"`);
}

function resolveBooleanConfig(
  rawEnv: string | undefined,
  fileValue: boolean | undefined,
  key: string,
  fallback: boolean,
): boolean {
  if (rawEnv != null && rawEnv.trim() !== '') {
    return parseBooleanEnv(rawEnv, key, fallback);
  }

  if (typeof fileValue === 'boolean') {
    return fileValue;
  }

  return fallback;
}

function resolveStringConfig(rawEnv: string | undefined, fileValue: string | null | undefined): string | undefined {
  if (rawEnv != null) {
    return rawEnv;
  }

  if (typeof fileValue === 'string') {
    return fileValue;
  }

  return undefined;
}

function normalizeConfiguredBaseUrl(raw: string | undefined, key: string): string | null {
  if (raw == null || raw.trim() === '') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`${key} must be a valid absolute URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${key} must use http or https`);
  }

  if (parsed.search || parsed.hash) {
    throw new Error(`${key} must not include query or hash components`);
  }

  return parsed.toString().replace(/\/+$/, '');
}
