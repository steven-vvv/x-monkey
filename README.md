# x-monkey

A lightweight userscript panel for continuously capturing and browsing X (Twitter) GraphQL tweet data in real time.

## What it does

- Intercepts supported GraphQL responses from `x.com` across the userscript app session.
- Parses and normalizes users, tweets, and media into an in-memory database.
- Shows a draggable/resizable Vue panel with three tabs:
  - **Feature**: URL-driven feature entry points backed by the accumulated in-memory database.
  - **Database**: full captured tweet list and entity detail views.
  - **Settings**: panel size, scale, theme mode, and behavior options.
- Keeps captured entities for the current page session by default; optional auto-clear is available for navigation changes.
- Uses Shadow DOM style isolation and runtime theme switching.

## Tech stack

- Vue 3 + TypeScript
- Vite + `vite-plugin-monkey`
- Bun (runtime and package manager)

## Development

```bash
bun install
bun run dev
```

## Build

```bash
bun run build
```

Build output is generated in `dist/` as a userscript bundle.

## Remote Database Build Options

The tweet-db integration can now be configured in two ways:

1. Edit [remote-db.config.ts](/home/steven/code/x-monkey/remote-db.config.ts)
2. Override the same fields with Vite environment variables when needed

Default repository configuration:

- `enabled: true`
- `configurable: true`
- `baseUrl: ''`

This means the feature is enabled by default, the Settings tab will show the remote database section, and the Base URL can be entered later if it is not fixed in the file.

Build-time fields:

- `enabled`
- `configurable`
- `baseUrl`

Equivalent environment variables:

- `VITE_XD_REMOTE_DB_ENABLED`
  Enables the remote database feature.
- `VITE_XD_REMOTE_DB_CONFIGURABLE`
  Allows the Base URL to be edited from the Settings tab.
- `VITE_XD_REMOTE_DB_BASE_URL`
  Compile-time default Base URL. Must be a valid absolute `http(s)` URL when remote mode is enabled and not configurable. May be empty only when remote mode is enabled and configurable.

Precedence:

- Environment variables override `remote-db.config.ts`
- `remote-db.config.ts` supplies the default values used by normal builds

Rules enforced during build:

- `VITE_XD_REMOTE_DB_CONFIGURABLE=true` requires `VITE_XD_REMOTE_DB_ENABLED=true`.
- When remote mode is disabled, the other two variables are ignored.
- When remote mode is enabled and not configurable, `VITE_XD_REMOTE_DB_BASE_URL` is required.
- When remote mode is enabled and configurable, `VITE_XD_REMOTE_DB_BASE_URL` is optional and acts as the initial default.

Examples:

```bash
VITE_XD_REMOTE_DB_ENABLED=true \
VITE_XD_REMOTE_DB_CONFIGURABLE=false \
VITE_XD_REMOTE_DB_BASE_URL=http://127.0.0.1:3001 \
bun run build
```

```bash
VITE_XD_REMOTE_DB_ENABLED=true \
VITE_XD_REMOTE_DB_CONFIGURABLE=true \
VITE_XD_REMOTE_DB_BASE_URL= \
bun run build
```
