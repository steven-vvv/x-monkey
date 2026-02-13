# x-monkey

A lightweight userscript panel for capturing and browsing X (Twitter) TweetDetail data in real time.

## What it does

- Intercepts TweetDetail GraphQL responses from `x.com`.
- Parses and normalizes users, tweets, and media into an in-memory database.
- Shows a draggable/resizable Vue panel with three tabs:
  - **Feature**: current tweet context, parent chain, replies, and details.
  - **Database**: full captured tweet list and entity detail views.
  - **Settings**: panel size, scale, theme mode, and behavior options.
- Supports auto-clear on tweet navigation and route sync with the current URL.
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
