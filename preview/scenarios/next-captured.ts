/** New UI: "已捕获" tab (filterable list, two-step clear, detail routes). Panel 360x440 unless noted. */
import { FIXTURE_IDS } from '../fixtures';
import type { Scenario } from '../scenarios';

const panel = { ui: 'next', tab: 'database', w: '360', h: '440' } as const;
const filter = '[data-role="filter"]';

export const nextCapturedScenarios: Scenario[] = [
  // List (F8) on a light and a dark page.
  { name: 'next-captured-light', query: { ...panel, bg: 'light' } },
  { name: 'next-captured-dark', query: { ...panel, bg: 'dark' } },
  { name: 'next-captured-remote', query: { ...panel, bg: 'light', remote: 'ready' } },
  // Filtering: text hit, @handle hit, no match, empty database.
  { name: 'next-captured-filter', query: { ...panel, bg: 'light' }, steps: [{ fill: [filter, 'artemis'] }] },
  { name: 'next-captured-filter-handle', query: { ...panel, bg: 'dark' }, steps: [{ fill: [filter, '@nasa'] }] },
  { name: 'next-captured-nomatch', query: { ...panel, bg: 'dark' }, steps: [{ fill: [filter, 'zzzz-no-such-post'] }] },
  { name: 'next-captured-empty', query: { ...panel, bg: 'light', empty: '1' } },
  // Two-step clear (F8 footer).
  { name: 'next-captured-clear-confirm', query: { ...panel, bg: 'light' }, steps: [{ click: '[data-role="clear"]' }] },
  { name: 'next-captured-clear-confirm-dark', query: { ...panel, bg: 'dark' }, steps: [{ click: '[data-role="clear"]' }] },
  {
    name: 'next-captured-clear-done',
    query: { ...panel, bg: 'dark' },
    steps: [{ click: '[data-role="clear"]' }, { click: '[data-role="clear-confirm"]' }, { wait: 100 }],
  },
  // The confirmation reverts by itself after 5 s.
  { name: 'next-captured-clear-timeout', query: { ...panel, bg: 'light' }, steps: [{ click: '[data-role="clear"]' }, { wait: 5400 }] },
  // Detail routes (shared with the "当前页" components): tweet, then user on top of it.
  { name: 'next-captured-tweet', query: { ...panel, bg: 'light', push: `tweet:${FIXTURE_IDS.posts.textEntitiesPhoto}` } },
  { name: 'next-captured-user', query: { ...panel, bg: 'dark', push: `tweet:${FIXTURE_IDS.posts.textEntitiesPhoto},user:${FIXTURE_IDS.users.nasa}` } },
  // Filter text survives opening a post and coming back.
  {
    name: 'next-captured-filter-kept',
    query: { ...panel, bg: 'light' },
    steps: [{ fill: [filter, 'artemis'] }, { click: '.xm-body > .xm-row:nth-child(1)' }, { click: '[data-nav="back"]' }],
  },
  { name: 'next-captured-narrow', query: { ...panel, bg: 'dark', w: '280', h: '380' }, steps: [{ fill: [filter, 'a'] }] },
];
