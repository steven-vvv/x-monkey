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

The tweet-db integration is controlled at build time with three Vite environment variables:

- `VITE_XD_REMOTE_DB_ENABLED`
  Enables the remote database feature. Default: `false`.
- `VITE_XD_REMOTE_DB_CONFIGURABLE`
  Allows the Base URL to be edited from the Settings tab. Default: `false`.
- `VITE_XD_REMOTE_DB_BASE_URL`
  Compile-time default Base URL. Must be a valid absolute `http(s)` URL when remote mode is enabled and not configurable. May be empty only when remote mode is enabled and configurable.

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
