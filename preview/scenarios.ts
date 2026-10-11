/**
 * Screenshot scenarios for `pnpm run preview:shoot`.
 *
 * Scenarios live in preview/scenarios/*.ts, one array per area, concatenated at the bottom of this file:
 *   classic.ts (classic UI + harness smoke tests), next-shell.ts (launcher, panel, current page),
 *   next-detail.ts, next-feed.ts (home feed paging), next-captured.ts, next-tools.ts, next-settings.ts (owned by the matching feature work;
 *   adding a scenario there never needs an edit to this file).
 * To add one, append an object to the area's array:
 *
 *   {
 *     name: 'next-feature-nasa',        // output file is <out>/<name>.png (must be unique)
 *     query: { ui: 'next', url: fixtureUrls.nasa, bg: 'dark', w: '420', h: '640' },
 *                                       // preview/main.ts query params, all strings:
 *                                       //   ui, theme, bg, url, tab, push, w, h, x, y, scale,
 *                                       //   remote (off|ready|anon|expired|error), capture=1, empty=1
 *     viewport: { width: 1100, height: 760 },   // optional, default 1100x760
 *     dpr: 1,                                   // optional device scale factor, default 1
 *     collapsed: false,                 // true = do NOT click the launcher first (shoot the launcher only)
 *     clip: 'panel',                    // 'panel' (default; panel box + 16px margin) | 'page' (whole viewport)
 *     steps: [                          // optional, run after the launcher click, in order
 *       { click: '.xm-tab[data-tab="database"]' },   // Playwright CSS selector; pierces open shadow roots
 *       { hover: '.xm-row' },
 *       { fill: ['input[type="search"]', 'artemis'] },
 *       { press: 'Enter' },
 *       { wait: 400 },                  // milliseconds
 *       { scroll: ['.xm-body', 600] },  // [selector, scrollTop]
 *       { call: ['addHomePage', 'forYou', 'newer', 6, 2] },
 *                                       // window.__xmPreview[fn](...args) in the page (hooks: preview/main.ts XmPreviewHooks):
 *                                       // addHomePage(list 'forYou'|'following', kind 'newer'|'older', count = 6, repeats = 0)
 *                                       // captures one more home response; add a { wait } afterwards if the UI animates
 *     ],
 *   }
 *
 * Fixture ids for `push` / `url` come from ./fixtures (FIXTURE_IDS, fixtureUrls); e.g.
 * `push: 'tweet:' + FIXTURE_IDS.posts.poll` with `tab: 'database'` opens that post.
 * A missing selector fails the run and names the scenario and step.
 * Run one: `pnpm run preview:shoot -- --out <dir> --only next-feature-nasa`; list: `--list`.
 */
import { classicScenarios } from './scenarios/classic';
import { nextCapturedScenarios } from './scenarios/next-captured';
import { nextDetailScenarios } from './scenarios/next-detail';
import { nextFeedScenarios } from './scenarios/next-feed';
import { nextSettingsScenarios } from './scenarios/next-settings';
import { nextShellScenarios } from './scenarios/next-shell';
import { nextToolsScenarios } from './scenarios/next-tools';

export type Step =
  | { click: string }
  | { hover: string }
  | { fill: [selector: string, text: string] }
  | { press: string }
  | { wait: number }
  | { scroll: [selector: string, top: number] }
  | { call: [fn: string, ...args: (string | number)[]] };

export interface Scenario {
  name: string;
  query: Record<string, string>;
  viewport?: { width: number; height: number };
  dpr?: number;
  steps?: Step[];
  collapsed?: boolean;
  clip?: 'panel' | 'page';
}

export const scenarios: Scenario[] = [
  ...classicScenarios,
  ...nextShellScenarios,
  ...nextDetailScenarios,
  ...nextFeedScenarios,
  ...nextCapturedScenarios,
  ...nextToolsScenarios,
  ...nextSettingsScenarios,
];
