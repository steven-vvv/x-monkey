/** New UI: "工具" tab (tools list, XHR capture list, request detail). Panel 360x440 unless noted. */
import { FIXTURE_IDS } from '../fixtures';
import type { Scenario } from '../scenarios';

const panel = { ui: 'next', tab: 'tools', w: '360', h: '440' } as const;
const list = { ...panel, capture: '1', push: 'xhr-capture' } as const;
const detail = (id: string) => ({ ...panel, capture: '1', push: `xhr-capture,xhr-detail:${id}` });
const C = FIXTURE_IDS.captures;
const req = (n: number) => `.xm-body > .xm-req:nth-child(${n})`;
const fold = (title: string) => `[data-fold="${title}"] .xm-fold__head`;

export const nextToolsScenarios: Scenario[] = [
  // Tools root: recording (capture=1 starts recording), not recording, nothing captured.
  { name: 'next-tools-root-recording', query: { ...panel, capture: '1', bg: 'dark', h: '300' } },
  {
    name: 'next-tools-root-idle',
    query: { ...panel, capture: '1', bg: 'light', h: '300' },
    steps: [{ click: '[data-role="open-xhr"]' }, { click: '[data-role="record"]' }, { click: '[data-nav="back"]' }],
  },
  { name: 'next-tools-root-empty', query: { ...panel, bg: 'dark', h: '300' } },

  // XHR list (F9): recording dark / light, after stop, empty states, narrow.
  { name: 'next-tools-list-recording', query: { ...list, bg: 'dark' } },
  { name: 'next-tools-list-recording-light', query: { ...list, bg: 'light' } },
  { name: 'next-tools-list-stopped', query: { ...list, bg: 'light' }, steps: [{ click: '[data-role="record"]' }] },
  { name: 'next-tools-list-empty', query: { ...panel, push: 'xhr-capture', bg: 'light' } },
  { name: 'next-tools-list-empty-recording', query: { ...list, bg: 'dark' }, steps: [{ click: '[data-role="clear"]' }] },
  { name: 'next-tools-list-narrow', query: { ...list, bg: 'dark', w: '280', h: '380' } },

  // Selection mode (same footer as the timeline) with two rows selected.
  {
    name: 'next-tools-select',
    query: { ...list, bg: 'dark' },
    steps: [{ click: '[data-role="select-mode"]' }, { click: req(1) }, { click: req(3) }],
  },
  {
    name: 'next-tools-select-all-light',
    query: { ...list, bg: 'light' },
    steps: [{ click: '[data-role="select-mode"]' }, { click: req(2) }, { click: '.xm-footer .xm-btn--ghost' }],
  },
  // Download of a selection: the GM stub never reports an error, so this only checks the click is harmless.
  {
    name: 'next-tools-select-download',
    query: { ...list, bg: 'light' },
    steps: [{ click: '[data-role="select-mode"]' }, { click: req(1) }, { click: '[data-role="download"]' }, { wait: 100 }],
  },

  // Request detail (F10): ok (light), rate limited (dark), server error, not modified, long body, post.
  { name: 'next-tools-detail-ok', query: { ...detail(C.ok), bg: 'light', h: '560' } },
  { name: 'next-tools-detail-429', query: { ...detail(C.rateLimited), bg: 'dark' } },
  { name: 'next-tools-detail-500', query: { ...detail(C.serverError), bg: 'light' } },
  { name: 'next-tools-detail-304', query: { ...detail(C.notModified), bg: 'dark' } },
  {
    name: 'next-tools-detail-longbody',
    query: { ...detail(C.longBody), bg: 'light' },
    steps: [{ scroll: ['.xm-body', 10000] }],
  },
  {
    name: 'next-tools-detail-longbody-dark',
    query: { ...detail(C.longBody), bg: 'dark' },
    steps: [{ scroll: ['.xm-body', 10000] }],
  },
  { name: 'next-tools-detail-post', query: { ...detail(C.post), bg: 'light', h: '560' }, steps: [{ scroll: ['.xm-body', 140] }] },
  // Folds: Features opened, Variables closed, request headers opened.
  {
    name: 'next-tools-detail-folds',
    query: { ...detail(C.ok), bg: 'light', h: '560' },
    steps: [{ click: fold('Variables') }, { click: fold('Features') }, { click: fold('请求头') }],
  },
  {
    name: 'next-tools-detail-folds-dark',
    query: { ...detail(C.post), bg: 'dark', h: '560' },
    steps: [{ click: fold('请求体') }, { click: fold('响应头') }, { scroll: ['.xm-body', 260] }],
  },
  // Copy button feedback (check icon for 1.5 s).
  {
    name: 'next-tools-detail-copied',
    query: { ...detail(C.ok), bg: 'dark' },
    steps: [{ click: '[data-fold="Variables"] [data-role="copy"]' }, { wait: 100 }],
  },
  { name: 'next-tools-detail-narrow', query: { ...detail(C.ok), bg: 'dark', w: '280', h: '440' } },
  { name: 'next-tools-detail-missing', query: { ...panel, push: 'xhr-capture,xhr-detail:nope', bg: 'light', h: '300' } },
];
