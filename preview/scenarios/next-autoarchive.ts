import { fixtureUrls } from '../fixtures';
import type { Scenario, Step } from '../scenarios';

/**
 * New UI: 持续归档 (SPEC section 11, F19-F22). `autoArchive=1` turns it on before mount; the seeded database is then
 * backfilled into the queue and submitted to the mock (about 1.7s after load: 1.5s debounce + 150ms mock latency).
 * `remote=busy` keeps it in backoff (queue stays full), `expired` ends in needs-login, `forbidden` in forbidden.
 * Panel 360x440 unless noted.
 */
const timeline = { ui: 'next', url: fixtureUrls.nasa, w: '360', h: '440', autoArchive: '1' } as const;
const settings = { ui: 'next', tab: 'settings', w: '360', h: '600' } as const;
const toRemote: Step = { scroll: ['.xm-body', 9999] };
const button = '[data-action="autoarchive"]';
const submitted: Step = { wait: 2600 };
const openPopover: Step[] = [{ click: button }, { wait: 100 }];
const launcherShot = { collapsed: true, viewport: { width: 220, height: 110 } } as const;
const launcherQuery = { ui: 'next', w: '360', h: '440', autoArchive: '1', x: '40', y: '56' } as const;

export const nextAutoArchiveScenarios: Scenario[] = [
  // F19: remote card with the switch on (and the sub switch), sub switch on, and the disabled variant.
  { name: 'next-autoarc-settings', query: { ...settings, bg: 'light', remote: 'ready', autoArchive: '1' }, steps: [{ wait: 400 }, toRemote] },
  { name: 'next-autoarc-settings-skip', query: { ...settings, bg: 'dark', remote: 'ready', autoArchive: '1', skipForYou: '1' }, steps: [{ wait: 400 }, toRemote] },
  { name: 'next-autoarc-settings-disabled', query: { ...settings, bg: 'light', remote: 'off' }, steps: [toRemote] },
  { name: 'next-autoarc-settings-narrow', query: { ...settings, bg: 'light', w: '280', remote: 'ready', autoArchive: '1' }, steps: [{ wait: 400 }, toRemote] },
  // Turning it on from the switch: sub switch appears, header button appears (and the sub switch toggles on click).
  {
    name: 'next-autoarc-settings-toggle',
    query: { ...settings, bg: 'light', remote: 'ready' },
    steps: [{ wait: 400 }, toRemote, { click: '[data-role="auto-archive"] [role="switch"]' }, { click: '[data-role="auto-archive-skip"] [role="switch"]' }, toRemote, { wait: 300 }],
  },

  // F20: running popover after the first submit, and with a few more posts waiting (footer 排队).
  { name: 'next-autoarc-popover-idle', query: { ...timeline, bg: 'light', remote: 'ready' }, steps: [submitted, ...openPopover] },
  {
    name: 'next-autoarc-popover-queued',
    query: { ...timeline, bg: 'light', remote: 'ready' },
    steps: [submitted, { call: ['addHomePage', 'following', 'newer', 12, 0] }, { wait: 200 }, ...openPopover],
  },
  { name: 'next-autoarc-footer-queued', query: { ...timeline, bg: 'dark', remote: 'ready' }, steps: [submitted, { call: ['addHomePage', 'following', 'newer', 12, 0] }, { wait: 200 }] },
  { name: 'next-autoarc-popover-backoff', query: { ...timeline, bg: 'light', remote: 'busy' }, steps: [{ wait: 2200 }, ...openPopover] },
  {
    name: 'next-autoarc-popover-paused',
    query: { ...timeline, bg: 'light', remote: 'ready' },
    steps: [submitted, ...openPopover, { click: '[data-role="autoarc-pause"]' }, { wait: 100 }],
  },

  // F21: needs login (the 401 turns the session anonymous), failures expanded, the banner alone, forbidden.
  { name: 'next-autoarc-popover-login', query: { ...timeline, bg: 'dark', remote: 'expired' }, steps: [{ wait: 3000 }, ...openPopover] },
  { name: 'next-autoarc-banner-login', query: { ...timeline, bg: 'dark', remote: 'expired' }, steps: [{ wait: 3000 }] },
  {
    name: 'next-autoarc-banner-dismissed',
    query: { ...timeline, bg: 'dark', remote: 'expired' },
    steps: [{ wait: 3000 }, { click: '[data-role="autoarc-login-banner"] .xm-iconbtn' }, { wait: 100 }],
  },
  {
    name: 'next-autoarc-popover-failures',
    query: { ...timeline, bg: 'dark', remote: 'ready', h: '520' },
    steps: [submitted, ...openPopover, { click: '[data-role="autoarc-fails"] .xm-autoarc__failrow' }, { wait: 100 }],
  },
  { name: 'next-autoarc-popover-forbidden', query: { ...timeline, bg: 'dark', remote: 'forbidden' }, steps: [{ wait: 2600 }, ...openPopover] },
  { name: 'next-autoarc-popover-unavailable', query: { ...timeline, bg: 'light', remote: 'error', h: '360' }, steps: [{ wait: 400 }, ...openPopover] },
  // Esc closes the popover first (the panel stays), the second Esc collapses it.
  { name: 'next-autoarc-popover-esc', query: { ...timeline, bg: 'light', remote: 'ready' }, steps: [submitted, ...openPopover, { press: 'Escape' }, { wait: 100 }] },
  // "打开设置" switches to the settings tab and closes the popover.
  {
    name: 'next-autoarc-popover-settings',
    query: { ...timeline, bg: 'dark', remote: 'expired' },
    steps: [{ wait: 3000 }, ...openPopover, { click: '[data-role="autoarc-settings"]' }, { wait: 200 }],
  },

  // F22: launcher state dot (running / needs login / forbidden), with the recording dot, narrow header.
  { name: 'next-autoarc-launcher-light', query: { ...launcherQuery, bg: 'light', remote: 'ready' }, ...launcherShot, steps: [submitted] },
  { name: 'next-autoarc-launcher-dark', query: { ...launcherQuery, bg: 'dark', remote: 'ready' }, ...launcherShot, steps: [submitted] },
  { name: 'next-autoarc-launcher-login', query: { ...launcherQuery, bg: 'dark', remote: 'expired' }, ...launcherShot, steps: [{ wait: 3000 }] },
  { name: 'next-autoarc-launcher-forbidden', query: { ...launcherQuery, bg: 'light', remote: 'forbidden' }, ...launcherShot, steps: [{ wait: 2600 }] },
  { name: 'next-autoarc-launcher-capture', query: { ...launcherQuery, bg: 'dark', remote: 'ready', capture: '1' }, ...launcherShot, steps: [submitted] },
  { name: 'next-autoarc-narrow-backoff', query: { ...timeline, bg: 'dark', remote: 'busy', w: '280', h: '330' }, steps: [{ wait: 2500 }] },
  { name: 'next-autoarc-narrow-popover', query: { ...timeline, bg: 'dark', remote: 'busy', w: '280', h: '420' }, steps: [{ wait: 2200 }, ...openPopover] },
];
