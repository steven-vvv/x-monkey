Object.assign(globalThis, {
  __XD_REMOTE_DB_ENABLED__: false,
  __XD_REMOTE_DB_CONFIGURABLE__: false,
  __XD_REMOTE_DB_DEFAULT_BASE_URL__: '',
});

await import('./verify-parsers.ts');
