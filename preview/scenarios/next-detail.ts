/** New UI: post detail, user page and the remote archive card. Panel 360x560 unless noted. */
import { FIXTURE_IDS, fixtureUrls } from '../fixtures';
import type { Scenario, Step } from '../scenarios';

const P = FIXTURE_IDS.posts;
const U = FIXTURE_IDS.users;
const panel = { ui: 'next', w: '360', h: '560' } as const;

/** Detail reached through the NASA list (breadcrumb + back button). */
const tweet = (name: string, id: string, extra: Record<string, string> = {}, steps?: Step[]): Scenario => ({
  name: `next-detail-${name}`,
  query: { ...panel, tab: 'feature', url: fixtureUrls.nasa, push: `tweet:${id}`, bg: 'light', ...extra },
  steps,
});
const user = (name: string, id: string, extra: Record<string, string> = {}): Scenario => ({
  name: `next-user-${name}`,
  query: { ...panel, tab: 'feature', url: fixtureUrls.nasa, push: `user:${id}`, bg: 'light', ...extra },
});
const toEnd: Step[] = [{ scroll: ['.xm-body', 5000] }, { wait: 150 }];

export const nextDetailScenarios: Scenario[] = [
  // Status page (F4): thread above, focal post, archive card, replies.
  { name: 'next-detail-status-light', query: { ...panel, url: fixtureUrls.status, bg: 'light', remote: 'ready' } },
  { name: 'next-detail-status-dark-archive', query: { ...panel, url: fixtureUrls.status, bg: 'dark', remote: 'ready' }, steps: [{ scroll: ['.xm-body', 360] }] },
  { name: 'next-detail-status-dark-end', query: { ...panel, url: fixtureUrls.status, bg: 'dark', remote: 'ready' }, steps: toEnd },
  { name: 'next-detail-thread-collapsed', query: { ...panel, url: fixtureUrls.status, bg: 'dark' }, steps: [{ click: '[data-role="toggle-parents"]' }] },
  { name: 'next-detail-status-wide', query: { ...panel, w: '500', h: '640', url: fixtureUrls.status, bg: 'light', remote: 'ready' }, steps: [{ scroll: ['.xm-body', 560] }] },

  // Embeds and blocks (F5).
  tweet('poll', P.poll, { bg: 'dim', remote: 'ready' }),
  tweet('article', P.article),
  tweet('linkcard', P.linkCard, { bg: 'dark' }),
  tweet('note', P.communityNote, { bg: 'dark' }),
  tweet('quote-captured', P.quoteCaptured),
  tweet('quote-tombstone', P.quoteTombstone, { bg: 'dark' }),
  tweet('policies', P.policies),
  tweet('paid-ai', P.paidAi, { bg: 'dark' }),
  tweet('community', P.community),
  tweet('reply-tombstone', P.replyTombstone, { bg: 'dark' }),
  tweet('long-styled', P.longStyled),
  tweet('long-chinese', P.longChinese, { bg: 'dark' }),
  tweet('business-card', P.businessCard),

  // Media layouts.
  tweet('sensitive', P.sensitiveMedia, { bg: 'dark' }),
  tweet('five-photos', P.fivePhotos),
  tweet('three-photos', P.threePhotos, { bg: 'dark' }),
  tweet('four-photos', P.fourPhotos),
  tweet('gif', P.gif),
  tweet('video', P.video, { bg: 'dark' }),

  // Archive card states: stale (..2), mismatch (..3), failed (..4), missing, anonymous (hidden).
  tweet('archive-stale', P.fourPhotos, { remote: 'ready' }, toEnd),
  tweet('archive-mismatch', P.gif, { bg: 'dark', remote: 'ready' }, toEnd),
  tweet('archive-failed', P.article, { remote: 'ready' }, toEnd),
  tweet('archive-missing', P.threePhotos, { bg: 'dark', remote: 'ready' }, toEnd),
  tweet('archive-anon', P.poll, { remote: 'anon' }, toEnd),
  tweet('archive-sync', P.fourPhotos, { remote: 'ready' }, [{ click: '[data-role="sync-one"]' }, { wait: 600 }, ...toEnd]),
  tweet('archive-sync-dark', P.fourPhotos, { bg: 'dark', remote: 'ready' }, [{ click: '[data-role="sync-one"]' }, { wait: 600 }, ...toEnd]),
  tweet('archive-expired', P.gif, { bg: 'dark', remote: 'expired' }, [{ click: '[data-role="sync-one"]' }, { wait: 600 }, ...toEnd]),
  {
    name: 'next-detail-archive-sync-all',
    query: { ...panel, url: fixtureUrls.status, bg: 'light', remote: 'ready' },
    steps: [{ scroll: ['.xm-body', 5000] }, { click: '[data-role="sync-all"]' }, { wait: 600 }, ...toEnd],
  },

  // User pages (F6).
  user('nasa', U.nasa, { remote: 'ready' }),
  user('long', U.long, { bg: 'dark' }),
  user('no-avatar', U.noAvatar),
  user('locked', U.locked, { bg: 'dark' }),
  user('sensitive', U.sensitive),
  user('business', U.business, { bg: 'dark' }),
  user('parody', U.parody),
  user('wide', U.nasa, { w: '480', bg: 'dark' }),
  user('narrow', U.nasa, { w: '280', bg: 'light' }),
];
