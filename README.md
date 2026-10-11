# x-monkey

A lightweight userscript panel for continuously capturing and browsing X (Twitter) GraphQL tweet data in real time.

## What it does

- Intercepts supported GraphQL responses from `x.com` across the userscript app session.
- Normalizes users, posts and media into archive records (see
  [`../design/x-archive-model.md`](../design/x-archive-model.md)) held in an
  in-memory database. Promoted posts are skipped.
- Shows a draggable/resizable Vue panel with four tabs:
  - **当前页** (Feature): the timeline of the current page (profile tabs, bookmarks, likes, search results, home feeds) and post details, backed by the in-memory database.
    In the new UI the home feeds (For You, Following) are shown one captured response per page by default,
    with follow / pause and a new-page hint; 设置 → 首页信息流 switches back to one continuous list.
  - **已捕获** (Database): full captured post list with a local filter, and entity detail views.
  - **工具** (Tools): XHR capture; selected requests can be exported with their page URL, request and response.
  - **设置** (Settings): panel size, scale, theme mode, behavior and remote database options.
- Has two interfaces. The redesigned one (Simplified Chinese, `src/next/`) is the
  default; its design notes and mockup are in
  [`../design/x-monkey/`](../design/x-monkey/). The previous English one is kept as
  the classic UI (`src/ClassicApp.vue`, `src/pages/`, `src/components/`). Switch
  between them under 设置 → 界面版本, the classic Settings tab's "UI Version"
  section, or the userscript menu (`Use Classic UI` / `Use New UI`).
- Keeps captured entities for the current page session by default; optional auto-clear is available for navigation changes.
- Uses Shadow DOM style isolation and runtime theme switching.

## Tech stack

- Vue 3 + TypeScript
- Vite + `vite-plugin-monkey`
- Node.js and pnpm

## Development

```bash
pnpm install
pnpm run dev
```

### UI preview

`preview/` mounts the app outside x.com with stubbed userscript APIs, synthetic
fixtures, a mocked remote database and placeholder images. It is never part of
the userscript build.

```bash
pnpm run preview:ui                      # dev server on http://127.0.0.1:5180/?ui=next&url=https://x.com/NASA
pnpm run preview:shoot -- --out <dir>    # screenshots of every scenario in preview/scenarios/
pnpm run preview:shoot -- --list         # scenario names; --only a,b runs a subset
pnpm run typecheck:preview
```

Screenshots use the system Chromium at `/usr/bin/chromium-browser` through
`playwright-core` (no browser download). `PREVIEW_PORT` changes the port so
several runs can share a machine. Query parameters and the scenario format are
documented at the top of `preview/scenarios.ts`.

## Build

```bash
pnpm run build
```

Build output is generated in `dist/` as a userscript bundle.

The scripts read fixtures from `dumps/`, which is gitignored: raw response
files named `<Operation>-<hash>.json` and XHR capture exports from the Tools
tab, in any subdirectory.

| Script | Purpose |
| --- | --- |
| `pnpm run verify:parsers` | Inline normalization scenarios, then every fixture through the parser and record schemas |
| `pnpm run verify:tweet-raw-schema` | Strict raw payload schema coverage; reports fields X added or stopped sending |
| `pnpm run analyze:dumps` | Instruction, entry and payload feature counts per operation |
| `pnpm run export:archive-sample` | Writes real archive records to `../tweet-db-v2/internal/projection/testdata/` for the Go projection tests |

Supported operations, as used by the X web client in 2026-10:

| Page | Operation |
| --- | --- |
| `/<user>` | `UserOriginalsTimeline` |
| `/<user>/all` | `UserTweetsAndReplies` |
| `/<user>/highlights` | `UserHighlightsTweets` |
| `/<user>/with_replies` | `UserRepliesTimeline` |
| `/<user>/reposts` | `UserRepostsTimeline` |
| `/<user>/articles` | `UserArticlesTweets` |
| `/<user>/media` | `UserVideoTimeline` |
| `/<user>/media?filter=photo` | `UserPhotoTimeline` |
| `/i/history`, `/i/bookmarks` | `Bookmarks` |
| `/i/history/likes` | `Likes` |
| `/search?q=…` (`f=top`, `f=live`, `f=media`) | `SearchTimeline` |
| `/home` | `HomeTimeline` (For You), `HomeLatestTimeline` (Following) |
| `/<user>/status/<id>` | `TweetDetail` |
| any profile (header) | `UserByScreenName`, the account record only |

`?sort=popular` on the Posts, All and Highlights tabs is kept as a separate timeline,
and so is the Popular sort of Following. On the home feeds a new page goes on
top, unless it was loaded by scrolling down: then it goes right below the page
it continues.
Search results are kept per query and tab; the People and Lists tabs are not post lists.
Pages and payload shapes that have not been captured yet (subscriber-only
posts, three-choice and image polls, other card types, list timelines) are not
supported; an unsupported card keeps its raw values in `extra`. The samples
still missing are listed in section 8 of the design note.

## Remote Database Build Options

The tweet-db integration targets the tweet-db v2 archive API:

- `GET /api/v1/session`
- `POST /api/v1/archive/query` with `{users, posts, media}` ID lists
- `POST /api/v1/archive/submit` with `{users, posts, media}` archive records

Records are submitted verbatim. The server merges them with what it already
stores (present fields win, absent fields are kept), so a timeline capture never
erases data first archived from a post detail page.

Users and posts captured by the userscript include optional `countsObservedAt`
maps: each counter is paired with the UTC time its XHR response finished
loading, with millisecond precision. Sparse captures update only the counters
they contain and their times. Recapturing identical values updates these times
without changing sync status; archive clients that omit the maps remain valid.

Runtime behavior in the userscript:

- Remote database sync is manual from the tweet detail panel.
- `Refresh` queries the remote state for the current post, author, and media.
- `Sync` submits the current post with its author, media, and the reposted or quoted post.
- `Sync All` submits the current post plus captured replies (and the thread above it on status pages).
- Status `Older Counts` means only counters such as likes, views or the votes of an open poll differ.
- Query requires a registered tweet-db session; submit requires an administrator session.

The integration can be configured in two ways:

1. Optionally create `remote-db.config.json` in the project root
2. Override the same fields with Vite environment variables when needed

A tracked example is available at [remote-db.config.example.json](remote-db.config.example.json). The actual `remote-db.config.json` file is optional and gitignored, so it can be used for machine-local build settings.

Default repository configuration:

- `enabled: true`
- `configurable: true`
- `baseUrl: ''`

This means the feature is enabled by default, the Settings tab will show the remote database section, and the Base URL can be entered later if it is not fixed in the file.

Settings behavior:

- A per-user `Enable remote database` switch is available in Settings.
- `Check` applies the current draft enable state and Base URL in memory immediately.
- `Save` persists the enable state and Base URL to userscript storage.

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

- Environment variables override `remote-db.config.json`
- `remote-db.config.json` overrides the built-in defaults used by normal builds

Userscript `@connect` generation:

- When remote mode is configurable, the build keeps `@connect *`.
- When a compile-time remote Base URL is set, its hostname is also added to `@connect`.
- When remote mode is fixed to a compile-time Base URL, the build emits that hostname instead of a wildcard.

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
pnpm run build
```

```bash
VITE_XD_REMOTE_DB_ENABLED=true \
VITE_XD_REMOTE_DB_CONFIGURABLE=true \
VITE_XD_REMOTE_DB_BASE_URL= \
pnpm run build
```
