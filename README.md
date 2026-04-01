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
