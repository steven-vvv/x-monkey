/** Classic-UI scenarios and harness smoke tests (kept as a comparison baseline). */
import { fixtureUrls } from '../fixtures';
import type { Scenario } from '../scenarios';

export const classicScenarios: Scenario[] = [
  // --- classic UI (baseline for comparison) ---
  { name: 'classic-feature-timeline', query: { ui: 'classic', url: fixtureUrls.nasa, bg: 'dark', w: '420', h: '620' } },
  { name: 'classic-settings', query: { ui: 'classic', tab: 'settings', bg: 'dark', w: '420', h: '720' } },
  { name: 'classic-status', query: { ui: 'classic', url: fixtureUrls.status, remote: 'ready', bg: 'light', w: '460', h: '720' } },

  // Harness smoke tests for the other params: captures, database tab, remote scenarios.
  { name: 'classic-tools-capture', query: { ui: 'classic', tab: 'tools', push: 'xhr-capture', capture: '1', bg: 'dim', w: '460', h: '620' } },
  { name: 'classic-database-remote', query: { ui: 'classic', tab: 'database', remote: 'ready', bg: 'dark', w: '460', h: '620' } },
  { name: 'classic-database-remote-anon', query: { ui: 'classic', tab: 'settings', remote: 'anon', bg: 'dark', w: '460', h: '760' } },

  // Switcher round trip: classic settings -> "Switch to new UI" -> new UI shell.
  {
    name: 'switch-classic-to-next',
    query: { ui: 'classic', tab: 'settings', bg: 'dark', w: '360', h: '300' },
    steps: [{ click: 'text=Switch to new UI' }, { click: '.xm-launcher' }],
  },
];
