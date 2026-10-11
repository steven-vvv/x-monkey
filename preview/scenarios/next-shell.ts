/** New UI: launcher, panel shell and the "当前页" views. Panel 360x440 unless noted. */
import { fixtureUrls } from '../fixtures';
import type { Scenario, Step } from '../scenarios';

const panel = { ui: 'next', w: '360', h: '440' } as const;
const launcherShot = { collapsed: true, viewport: { width: 220, height: 110 } } as const;
const continuous: Step[] = [{ click: '[data-role="page-label"]' }, { click: '[data-role="page-menu"] [data-role="home-feed"] button:has-text("连续")' }];
const row = (n: number) => `.xm-body > .xm-post:nth-child(${n}) .xm-post__head`;

export const nextShellScenarios: Scenario[] = [
  // Launcher (F1): count, empty, recording dot. Anchor = icon center.
  { name: 'next-launcher-light', query: { ...panel, bg: 'light', x: '40', y: '56' }, ...launcherShot },
  { name: 'next-launcher-dark', query: { ...panel, bg: 'dark', x: '40', y: '56' }, ...launcherShot },
  { name: 'next-launcher-empty', query: { ...panel, bg: 'light', empty: '1', x: '40', y: '56' }, ...launcherShot },
  { name: 'next-launcher-capture', query: { ...panel, bg: 'dark', capture: '1', x: '40', y: '56' }, ...launcherShot },

  // Timeline on the three page backgrounds (theme follows the page).
  { name: 'next-timeline-light', query: { ...panel, url: fixtureUrls.nasa, bg: 'light' } },
  { name: 'next-timeline-dark', query: { ...panel, url: fixtureUrls.nasa, bg: 'dark' } },
  { name: 'next-timeline-dim', query: { ...panel, url: fixtureUrls.nasa, bg: 'dim' } },
  { name: 'next-timeline-remote', query: { ...panel, url: fixtureUrls.nasa, bg: 'light', remote: 'ready' } },
  { name: 'next-timeline-remote-scrolled', query: { ...panel, url: fixtureUrls.nasa, bg: 'dark', remote: 'ready' }, steps: [{ scroll: ['.xm-body', 700] }] },

  // Batch selection (F3).
  {
    name: 'next-select',
    query: { ...panel, url: fixtureUrls.nasa, bg: 'dark', remote: 'ready' },
    steps: [{ click: '[data-role="select-mode"]' }, { click: row(1) }, { click: row(3) }, { scroll: ['.xm-body', 0] }],
  },
  {
    name: 'next-submit-expired',
    query: { ...panel, url: fixtureUrls.nasa, bg: 'dark', remote: 'expired' },
    steps: [{ click: '[data-role="select-mode"]' }, { click: row(1) }, { click: row(2) }, { click: '[data-role="submit"]' }, { wait: 400 }],
  },
  {
    name: 'next-submit-success',
    query: { ...panel, url: fixtureUrls.nasa, bg: 'light', remote: 'ready' },
    steps: [{ click: '[data-role="select-mode"]' }, { click: row(1) }, { click: row(2) }, { click: '[data-role="submit"]' }, { wait: 400 }],
  },

  // Home: entry list (F7) and a list reached through it, with crumbs.
  {
    name: 'next-home-root',
    query: { ...panel, url: fixtureUrls.home, bg: 'dark', h: '300' },
    steps: [{ click: '[data-nav="back"]' }],
  },
  {
    name: 'next-home-following',
    query: { ...panel, url: fixtureUrls.home, bg: 'dark', remote: 'ready' },
    steps: [{ click: '[data-nav="back"]' }, { click: '.xm-entry:nth-child(2)' }],
  },
  // Preview hook: a new For You page is captured while the list is open (paged + following: it becomes page 5).
  {
    name: 'next-home-foryou-added',
    query: { ...panel, url: fixtureUrls.home, bg: 'dark' },
    steps: [{ click: '[data-nav="back"]' }, { click: '.xm-entry:nth-child(1)' }, { call: ['addHomePage', 'forYou', 'newer', 6, 2] }, { wait: 300 }],
  },

  // Narrow panel (F13): icon-only tabs, no views metric, search title.
  { name: 'next-search-narrow', query: { ui: 'next', url: fixtureUrls.search, bg: 'dark', w: '280', h: '380' } },
  // Page with nothing to capture (F7 right) and the waiting state.
  { name: 'next-none', query: { ...panel, url: 'https://x.com/explore', bg: 'light', h: '300' } },
  { name: 'next-waiting', query: { ...panel, url: fixtureUrls.nasa, bg: 'light', empty: '1' } },
  // Detail routes: navbar + open-in-X button around the placeholder body.
  { name: 'next-status-placeholder', query: { ...panel, url: fixtureUrls.status, bg: 'dark', h: '300' } },
  // Other tabs: placeholders until their views land.
  { name: 'next-tab-captured', query: { ...panel, tab: 'database', bg: 'dark', h: '300' } },
  // Scaled UI (uiScale 150) and a panel anchored past the viewport edge (clamped at render time).
  { name: 'next-timeline-scale150', query: { ...panel, url: fixtureUrls.nasa, bg: 'dark', scale: '150', w: '480', h: '520' } },
  { name: 'next-clamped', query: { ...panel, url: fixtureUrls.nasa, bg: 'light', x: '1000', y: '700' } },

  // Sensitive media (home For You list, shown continuous so every post is on one list): masked, then revealed by hovering the cell.
  { name: 'next-masked', query: { ...panel, url: fixtureUrls.home, bg: 'dark', h: '300' }, steps: [...continuous, { hover: '.xm-post:has(.xm-media--masked) .xm-metrics' }] },
  { name: 'next-masked-hover', query: { ...panel, url: fixtureUrls.home, bg: 'dark', h: '300' }, steps: [...continuous, { hover: '.xm-media--masked' }] },
];
