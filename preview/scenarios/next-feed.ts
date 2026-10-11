import { fixtureUrls } from '../fixtures';
import type { Scenario, Step } from '../scenarios';

/**
 * New UI: home feed paging (F14-F18). Panel 360x440 unless noted. The harness seeds For You as 4 pages
 * (1 initial, 2 older, 3 newer with 2 repeats, 4 older with 1 repeat) and Following as 3.
 */
const panel = { ui: 'next', w: '360', h: '440', url: fixtureUrls.home } as const;
const toFollowing: Step[] = [{ click: '[data-nav="back"]' }, { click: '.xm-entry:nth-child(2)' }];
const addNewer: Step = { call: ['addHomePage', 'forYou', 'newer', 6, 1] };
const openMenu: Step = { click: '[data-role="page-label"]' };
const gotoPage = (n: number): Step[] => [openMenu, { click: `[data-role="page-menu"] [data-page="${n}"]` }, { wait: 150 }];
const scrollDown: Step = { scroll: ['.xm-body', 200] };

export const nextFeedScenarios: Scenario[] = [
  { name: 'next-feed-paged-light', query: { ...panel, bg: 'light' } },
  { name: 'next-feed-following-dark', query: { ...panel, bg: 'dark' }, steps: toFollowing },
  // Following: a new page arrives, the label sweeps once (300ms), then settled (1500ms).
  { name: 'next-feed-autofollow-shimmer', query: { ...panel, bg: 'dark' }, steps: [addNewer, { wait: 300 }] },
  { name: 'next-feed-autofollow-settled', query: { ...panel, bg: 'dark' }, steps: [addNewer, { wait: 1500 }] },
  // Paused by scrolling: one pending page, then two.
  { name: 'next-feed-paused-pill', query: { ...panel, bg: 'dark' }, steps: [scrollDown, { wait: 100 }, addNewer, { wait: 300 }] },
  {
    name: 'next-feed-paused-pill-two',
    query: { ...panel, bg: 'light' },
    steps: [scrollDown, { wait: 100 }, addNewer, { wait: 100 }, { call: ['addHomePage', 'forYou', 'newer', 4, 0] }, { wait: 300 }, { scroll: ['.xm-body', 0] }, { wait: 1300 }],
  },
  {
    name: 'next-feed-pill-resumed',
    query: { ...panel, bg: 'dark' },
    steps: [scrollDown, { wait: 100 }, addNewer, { wait: 200 }, { click: '[data-role="new-pill"]' }, { wait: 300 }],
  },
  // Manual pause through the follow chip, and resume through 已暂停 after navigating back.
  { name: 'next-feed-manual-pause', query: { ...panel, bg: 'dark' }, steps: [{ click: '[data-role="follow"]' }, { wait: 100 }] },
  {
    // Pages that arrive while paused are the only ones marked 新 in the menu.
    name: 'next-feed-menu-new',
    query: { ...panel, bg: 'dark' },
    steps: [{ click: '[data-role="page-prev"]' }, { call: ['addHomePage', 'forYou', 'newer', 4] }, { call: ['addHomePage', 'forYou', 'older', 5] }, { wait: 150 }, openMenu, { wait: 100 }],
  },
  { name: 'next-feed-menu-dim', query: { ...panel, bg: 'dim' }, steps: [{ click: '[data-role="page-prev"]' }, { click: '[data-role="page-prev"]' }, openMenu, { wait: 100 }] },
  {
    // Esc closes the menu first; the panel stays open.
    name: 'next-feed-menu-esc',
    query: { ...panel, bg: 'dark' },
    steps: [openMenu, { press: 'Escape' }, { wait: 100 }],
  },
  { name: 'next-feed-repeats', query: { ...panel, bg: 'light' }, steps: [...gotoPage(3), { click: '[data-role="repeats"]' }, { scroll: ['.xm-body', 9999] }, { wait: 100 }] },
  { name: 'next-feed-pageend', query: { ...panel, bg: 'dark' }, steps: [...gotoPage(2), { scroll: ['.xm-body', 99999] }, { wait: 100 }] },
  {
    name: 'next-feed-select-all',
    query: { ...panel, bg: 'light', remote: 'ready' },
    steps: [...gotoPage(4), { click: '[data-role="select-mode"]' }, { click: '.xm-footer .xm-btn--ghost' }, { wait: 100 }, { scroll: ['.xm-body', 99999] }],
  },
  {
    name: 'next-feed-continuous',
    query: { ...panel, bg: 'light' },
    steps: [openMenu, { click: '[data-role="page-menu"] [data-role="home-feed"] button:has-text("连续")' }, { wait: 150 }],
  },
  {
    // Page 3 chip "见第 n 页" jumps to the first page of a repeated post.
    name: 'next-feed-repeat-chip',
    query: { ...panel, bg: 'dark' },
    steps: [...gotoPage(3), { click: '[data-role="repeats"]' }, { click: '[data-role="repeat-chip"]' }, { wait: 150 }],
  },
  {
    name: 'next-feed-tab-dot',
    query: { ...panel, bg: 'dark' },
    steps: [{ click: '.xm-tab[data-tab="database"]' }, addNewer, { wait: 200 }],
  },
  {
    name: 'next-feed-tab-dot-cleared',
    query: { ...panel, bg: 'dark' },
    steps: [{ click: '.xm-tab[data-tab="database"]' }, addNewer, { wait: 200 }, { click: '.xm-tab[data-tab="feature"]' }, { wait: 200 }],
  },
  {
    name: 'next-feed-launcher-shimmer-light',
    query: { ui: 'next', url: fixtureUrls.home, bg: 'light', x: '40', y: '56' },
    collapsed: true,
    viewport: { width: 220, height: 110 },
    steps: [addNewer, { wait: 350 }],
  },
  {
    name: 'next-feed-launcher-shimmer-dark',
    query: { ui: 'next', url: fixtureUrls.home, bg: 'dark', x: '40', y: '56', capture: '1' },
    collapsed: true,
    viewport: { width: 220, height: 110 },
    steps: [addNewer, { wait: 350 }],
  },
  { name: 'next-feed-settings', query: { ui: 'next', tab: 'settings', w: '360', h: '560', bg: 'light' }, steps: [{ scroll: ['.xm-body', 300] }] },
  { name: 'next-feed-narrow', query: { ...panel, w: '280', h: '380', bg: 'dark' }, steps: [{ click: '[data-role="page-prev"]' }] },
  { name: 'next-feed-narrow-menu', query: { ...panel, w: '280', h: '380', bg: 'light' }, steps: [openMenu, { wait: 100 }] },
];
