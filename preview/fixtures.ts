/**
 * Synthetic archive data for the preview harness. Pure data: this module imports
 * only types, so it is safe to load from Node (scenarios.ts uses the exported ids).
 * `preview/seed.ts` feeds it into the real stores.
 *
 * Remote-sync status of a post is decided by the LAST DIGIT of its id (see
 * remote-mock.ts): 1 in_sync, 2 stale, 3 mismatch, 4 failed, anything else missing.
 */
import type { Entity, Id, Media, Post, RichText, User } from '../src/archive/model';
import type { CapturedXhr } from '../src/lib/xhr-capture-service';

// ---------------------------------------------------------------- helpers

const NOW = Date.parse('2026-10-10T10:00:00Z');
const iso = (offsetMinutes: number): string => new Date(NOW + offsetMinutes * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const isoMs = (offsetMinutes: number): string => new Date(NOW + offsetMinutes * 60_000).toISOString();

const LAST_DIGITS = [1, 1, 2, 3, 1, 4, 2, 0, 1, 3, 5, 2];

/** Post id for fixture number `n`; the last digit drives the mocked remote status. */
function pid(n: number, digit?: number): Id {
  return `2044000000000${String(n).padStart(3, '0')}${digit ?? LAST_DIGITS[n % LAST_DIGITS.length]}`;
}
const uid = (n: number): Id => `9001000000${String(n).padStart(4, '0')}`;
const mid = (n: number): Id => `3055000000${String(n).padStart(4, '0')}`;

type Mark =
  | { type: 'url'; match: string; expanded: string }
  | { type: 'mention'; match: string; userId: Id }
  | { type: 'hashtag'; match: string }
  | { type: 'cashtag'; match: string; ticker?: string }
  | { type: 'timestamp'; match: string };

/** Builds a RichText, turning each `match` substring into a code-point range entity. */
function rich(text: string, marks: Mark[] = [], extra: Partial<RichText> = {}): RichText {
  const entities: Entity[] = marks.map((mark) => {
    const at = text.indexOf(mark.match);
    if (at < 0) throw new Error(`fixture: "${mark.match}" not found in "${text}"`);
    const start = Array.from(text.slice(0, at)).length;
    const range: [number, number] = [start, start + Array.from(mark.match).length];
    switch (mark.type) {
      case 'url': return { type: 'url', range, expanded: mark.expanded };
      case 'mention': return { type: 'mention', range, userId: mark.userId };
      case 'hashtag': return { type: 'hashtag', range };
      case 'cashtag': return mark.ticker ? { type: 'cashtag', range, ticker: mark.ticker } : { type: 'cashtag', range };
      case 'timestamp': return { type: 'timestamp', range };
    }
  });
  return { text, ...(entities.length ? { entities } : {}), ...extra };
}

/** Reply text: the auto-added `@handle ` prefix sits outside the visible range. */
function replyText(prefixHandle: string, prefixUserId: Id, body: string, marks: Mark[] = []): RichText {
  const prefix = `@${prefixHandle} `;
  const text = prefix + body;
  return rich(text, [{ type: 'mention', match: `@${prefixHandle}`, userId: prefixUserId }, ...marks], {
    visible: [Array.from(prefix).length, Array.from(text).length],
  });
}

function counts(likes: number, reposts: number, replies: number, extra: { quotes?: number; bookmarks?: number; views?: number } = {}, at = -30) {
  const values = { replies, reposts, likes, quotes: extra.quotes ?? Math.round(reposts / 6), bookmarks: extra.bookmarks ?? Math.round(likes / 9), views: extra.views ?? likes * 24 };
  const stamp = isoMs(at);
  return {
    counts: values,
    countsObservedAt: { replies: stamp, reposts: stamp, likes: stamp, quotes: stamp, bookmarks: stamp, views: stamp },
  };
}

// ------------------------------------------------------------------ users

const U = {
  nasa: uid(1),
  long: uid(2),
  noAvatar: uid(3),
  xinghe: uid(4),
  locked: uid(5),
  sensitive: uid(6),
  business: uid(7),
  bot: uid(8),
  parody: uid(9),
  ada: uid(10),
} as const;

function buildUsers(): User[] {
  return [
    {
      id: U.nasa, handle: 'NASA', name: 'NASA', createdAt: '2007-12-19T20:20:00Z',
      avatarUrl: '/__media/avatars/nasa_normal.jpg', avatarShape: 'Circle', bannerUrl: '/__media/banners/nasa',
      bio: rich('Exploring the unknown in air and space, innovating for the benefit of humanity. Follow @NASAArtemis for the Moon. #NASA https://t.co/nasabio1', [
        { type: 'mention', match: '@NASAArtemis', userId: uid(40) },
        { type: 'hashtag', match: '#NASA' },
        { type: 'url', match: 'https://t.co/nasabio1', expanded: 'https://www.nasa.gov/about' },
      ]),
      location: 'Pale Blue Dot', website: 'https://nasa.gov',
      verified: { blue: true, type: 'Government' },
      counts: { followers: 88_400_000, following: 170, posts: 76_340, mediaPosts: 21_980, likes: 12_050 },
      countsObservedAt: { followers: isoMs(-20), following: isoMs(-20), posts: isoMs(-20), mediaPosts: isoMs(-20), likes: isoMs(-20) },
    },
    {
      id: U.long, handle: 'longname_researcher',
      name: 'Dr. Bartholomew Maximilian Featherstonehaugh-Cholmondeley III, Professor of Applied Astro-Geophysics and Interstellar Dust Chemistry',
      createdAt: '2014-03-02T08:30:00Z', avatarUrl: '/__media/avatars/long_normal.jpg',
      bio: rich('Researcher. Opinions my own, retweets are not endorsements, and yes the name really is this long.'),
      location: 'Cambridge, UK', website: 'https://example.edu/~bmfc',
      counts: { followers: 4210, following: 981, posts: 12_005, likes: 30_400 },
    },
    {
      id: U.noAvatar, handle: 'nobody_avatar', name: '无头像用户', createdAt: '2026-09-28T12:00:00Z',
      counts: { followers: 3, following: 12, posts: 41 },
    },
    {
      id: U.xinghe, handle: 'xinghe_guancha', name: '星河观察员', createdAt: '2019-06-18T01:15:00Z',
      avatarUrl: '/__media/avatars/xinghe_normal.jpg', bannerUrl: '/__media/banners/xinghe',
      bio: rich('用镜头和文字记录天空。长期关注深空探测与天文摄影 🔭 合作请私信。#天文摄影 https://t.co/xhbio001', [
        { type: 'hashtag', match: '#天文摄影' },
        { type: 'url', match: 'https://t.co/xhbio001', expanded: 'https://xinghe.example.cn/about' },
      ]),
      location: '北京', website: 'https://xinghe.example.cn',
      verified: { blue: true },
      professional: { type: 'Creator', categories: ['Science & Tech'] },
      counts: { followers: 215_300, following: 340, posts: 8_720, mediaPosts: 3_110, likes: 15_020 },
    },
    {
      id: U.locked, handle: 'private_diary_', name: 'Quiet Fox', createdAt: '2020-01-09T22:45:00Z',
      avatarUrl: '/__media/avatars/locked_normal.jpg', protected: true,
      bio: rich('Only approved followers can see my posts.'),
      counts: { followers: 52, following: 60, posts: 1_902 },
    },
    {
      id: U.sensitive, handle: 'edgy_artist', name: 'Edgy Artist', createdAt: '2021-11-20T16:00:00Z',
      avatarUrl: '/__media/avatars/sensitive_normal.jpg', bannerUrl: '/__media/banners/sensitive',
      sensitive: true, interstitial: 'sensitive_media', withheldIn: ['SA', 'AE'],
      bio: rich('Figure drawing and horror illustration. 18+ only.'),
      counts: { followers: 18_900, following: 220, posts: 4_300, mediaPosts: 3_900 },
    },
    {
      id: U.business, handle: 'orbital_labs', name: 'Orbital Labs', createdAt: '2016-04-12T09:00:00Z',
      avatarUrl: '/__media/avatars/orbital_normal.jpg', avatarShape: 'Square', bannerUrl: '/__media/banners/orbital',
      verified: { blue: true, type: 'Business' },
      affiliation: { name: 'Orbital Group', url: 'https://example.com/orbital', badgeUrl: '/__media/badges/orbital', kind: 'BusinessLabel' },
      bio: rich('Small satellites, big ideas. Careers: https://t.co/orbjobs1', [{ type: 'url', match: 'https://t.co/orbjobs1', expanded: 'https://orbital.example.com/careers' }]),
      location: 'Hawthorne, CA', website: 'https://orbital.example.com',
      counts: { followers: 482_000, following: 88, posts: 5_340, mediaPosts: 1_020 },
    },
    {
      id: U.bot, handle: 'launch_bot', name: 'Launch Schedule Bot', createdAt: '2022-02-01T00:00:00Z',
      avatarUrl: '/__media/avatars/bot_normal.jpg', avatarShape: 'Hexagon',
      affiliation: { name: 'Automated by @orbital_labs', kind: 'AutomatedLabel', ownerId: U.business, badgeUrl: '/__media/badges/bot' },
      bio: rich('Posts upcoming launches. Automated account.'),
      counts: { followers: 9_800, following: 1, posts: 22_100 },
    },
    {
      id: U.parody, handle: 'definitely_not_nasa', name: 'Definitely Not NASA', createdAt: '2018-08-08T08:08:00Z',
      avatarUrl: '/__media/avatars/parody_normal.jpg', parody: 'Parody',
      bio: rich('Parody account. Space jokes since 2018.'),
      counts: { followers: 33_500, following: 410, posts: 9_870 },
    },
    {
      id: U.ada, handle: 'ada_codes', name: 'Ada', createdAt: '2017-12-10T14:20:00Z',
      avatarUrl: '/__media/avatars/ada_normal.jpg', bannerUrl: '/__media/banners/ada',
      bio: rich('Systems programmer. Rust, Go, a little TypeScript. Building tiny tools that do one thing. https://t.co/adablog1', [{ type: 'url', match: 'https://t.co/adablog1', expanded: 'https://ada.example.dev' }]),
      location: 'Sydney, AU', website: 'https://ada.example.dev',
      counts: { followers: 7_850, following: 612, posts: 6_450, mediaPosts: 480, likes: 21_330 },
    },
  ];
}

// ------------------------------------------------------------------ media

function photo(n: number, name: string, width: number, height: number, alt?: string, extra: Partial<Media> = {}): Media {
  return { id: mid(n), type: 'photo', url: `/__media/photos/${name}.jpg`, width, height, ...(alt ? { alt } : {}), ...extra };
}

function buildMedia(): Media[] {
  const variants = (name: string) => [
    { url: `/__media/video/${name}_320.mp4`, type: 'video/mp4', bitrate: 256_000 },
    { url: `/__media/video/${name}_720.mp4?tag=12`, type: 'video/mp4', bitrate: 2_176_000 },
    { url: `/__media/video/${name}.m3u8`, type: 'application/x-mpegURL' },
  ];
  return [
    photo(1, 'artemis-pad', 1600, 900, 'The Artemis rocket on the launch pad at dusk'),
    photo(2, 'moon-1', 1200, 1200), photo(3, 'moon-2', 1200, 800, 'Crescent Earth over the lunar horizon'),
    photo(4, 'moon-3', 900, 1200), photo(5, 'moon-4', 1600, 900),
    { id: mid(6), type: 'video', url: '/__media/video/landing-cover.jpg', width: 1280, height: 720, video: { durationMs: 94_300, variants: variants('landing') }, title: 'Landing sequence' },
    photo(7, 'article-cover', 1600, 840),
    photo(8, 'card-image', 1200, 628),
    photo(9, 'crater', 1200, 1500, 'Shadowed crater floor'), photo(10, 'regolith', 1000, 1000),
    photo(11, 'sensitive-1', 1200, 800, undefined, { sensitive: ['adult_content'] }),
    { id: mid(12), type: 'gif', url: '/__media/gif/rover-wave.jpg', width: 480, height: 270, video: { durationMs: 3_200, variants: [{ url: '/__media/gif/rover-wave.mp4', type: 'video/mp4', bitrate: 0 }] } },
    photo(13, 'tri-1', 1200, 900), photo(14, 'tri-2', 900, 1200), photo(15, 'tri-3', 1600, 900),
    photo(16, 'five-1', 1200, 800), photo(17, 'five-2', 800, 1200), photo(18, 'five-3', 1000, 1000), photo(19, 'five-4', 1600, 900), photo(20, 'five-5', 1200, 900),
    photo(21, 'nebula', 2000, 1334, '猎户座大星云的长曝光照片'), photo(22, 'nebula-wide', 2000, 800),
    photo(23, 'thread-1', 1200, 900, 'Terminal screenshot'), photo(24, 'thread-2', 1000, 600),
    photo(25, 'twin-1', 1200, 900), photo(26, 'twin-2', 1200, 900),
    photo(27, 'quoted-1', 1200, 900, undefined, { sourcePostId: pid(1), sourceUserId: U.nasa }),
    photo(28, 'unavail', 1200, 900, undefined, { unavailable: 'Geoblocked' }),
    photo(29, 'ad-1', 1200, 628),
  ];
}

// ------------------------------------------------------------------ posts

const LONG_NAME_POST_BODY = 'The thing about interstellar dust is that it is never quite as dull as the textbooks suggest.';

function buildPosts(): Post[] {
  const P = (n: number, d?: number) => pid(n, d);
  const posts: Post[] = [
    // 1: English text with url, mention, hashtag; one photo
    {
      id: P(1), authorId: U.nasa, createdAt: iso(-60), lang: 'en', source: 'Twitter Web App', mediaIds: [mid(1)],
      text: rich('The #Artemis rocket is on the pad. Thanks to @xinghe_guancha for the dusk shot! Full story: https://t.co/artstory1', [
        { type: 'hashtag', match: '#Artemis' },
        { type: 'mention', match: '@xinghe_guancha', userId: U.xinghe },
        { type: 'url', match: 'https://t.co/artstory1', expanded: 'https://www.nasa.gov/artemis-launch-readiness-update' },
      ]),
      ...counts(48_210, 9_320, 1_204, { views: 2_400_000 }),
    },
    // 2: four photos
    {
      id: P(2), authorId: U.nasa, createdAt: iso(-180), lang: 'en', source: 'Twitter Web App', mediaIds: [mid(2), mid(3), mid(4), mid(5)],
      text: rich('Four views of the lunar south pole, captured over a single orbit. #Moon', [{ type: 'hashtag', match: '#Moon' }]),
      ...counts(31_980, 4_410, 612),
    },
    // 3: video
    {
      id: P(3), authorId: U.nasa, createdAt: iso(-300), lang: 'en', mediaIds: [mid(6)],
      text: rich('Watch the full landing sequence in 90 seconds.'),
      ...counts(22_750, 6_880, 540, { views: 910_000 }),
    },
    // 4: poll with three choices
    {
      id: P(4), authorId: U.nasa, createdAt: iso(-420), lang: 'en',
      text: rich('Which destination should we visit next?'),
      card: {
        type: 'poll3choice_text_only', url: 'card://1844000000000000001',
        poll: { choices: [{ label: 'Europa', count: 18_420 }, { label: 'Titan', count: 24_105 }, { label: 'Enceladus', count: 9_870 }], endsAt: '2026-10-11T06:00:00Z', updatedAt: iso(-5), final: false },
      },
      ...counts(5_210, 1_020, 880),
    },
    // 5: article with cover
    {
      id: P(5), authorId: U.nasa, createdAt: iso(-1_440), lang: 'en',
      text: rich('A deep dive on how mission planners choose a landing site.'),
      article: {
        id: '1844000000000000005', title: 'How to pick a place to land on the Moon', preview: 'Slope, shadows, sunlight and a surprising amount of paperwork: the long road from a map to a landing zone.',
        coverMediaId: mid(7), publishedAt: iso(-1_500), modifiedAt: iso(-1_450),
      },
      ...counts(12_300, 2_100, 190),
    },
    // 6: link card with image
    {
      id: P(6), authorId: U.nasa, createdAt: iso(-1_600), lang: 'en',
      text: rich('New this week on the blog: https://t.co/cardlink1', [{ type: 'url', match: 'https://t.co/cardlink1', expanded: 'https://www.nasa.gov/blogs/week-in-review' }]),
      card: {
        type: 'summary_large_image', url: 'https://t.co/cardlink1', title: 'Week in review: everything that happened at the agency',
        description: 'From engine tests to a surprise comet sighting, here is what you may have missed.', domain: 'nasa.gov',
        image: { url: '/__media/photos/card-image.jpg', width: 1200, height: 628, alt: 'Illustrated rocket' },
      },
      ...counts(4_020, 640, 95),
    },
    // 7: community note + two photos
    {
      id: P(7), authorId: U.nasa, createdAt: iso(-2_000), lang: 'en', mediaIds: [mid(9), mid(10)],
      text: rich('Regolith is made of tiny, jagged glass shards. It sticks to everything.'),
      communityNote: {
        id: '1844000000000009999', title: 'Readers added context',
        text: rich('Lunar regolith is glassy and abrasive, but it is not "sharp enough to cut through spacesuit gloves" in a single touch; wear accumulates over many hours. Source: https://t.co/note0001', [{ type: 'url', match: 'https://t.co/note0001', expanded: 'https://example.org/regolith-study' }]),
        lang: 'en', url: 'https://x.com/i/birdwatch/n/1844000000000009999',
      },
      ...counts(9_540, 1_330, 301),
    },
    // 8: sensitive media with content warning
    {
      id: P(8), authorId: U.sensitive, createdAt: iso(-2_400), lang: 'en', mediaIds: [mid(11)], sensitive: true,
      contentWarning: { title: 'Content warning: Sensitive content', text: 'The author labeled this post as containing sensitive content.' },
      text: rich('New anatomy study, figure drawing in charcoal. Not for everyone.'),
      ...counts(1_840, 120, 44),
    },
    // 9: animated GIF
    {
      id: P(9), authorId: U.nasa, createdAt: iso(-2_880), lang: 'en', mediaIds: [mid(12)],
      text: rich('Rover says hello.'),
      ...counts(60_100, 8_900, 1_900),
    },
    // 10: three photos
    {
      id: P(10), authorId: U.nasa, createdAt: iso(-3_300), lang: 'en', mediaIds: [mid(13), mid(14), mid(15)],
      text: rich('Mission control, three shifts.'),
      ...counts(3_300, 300, 40),
    },
    // 11: five photos
    {
      id: P(11), authorId: U.nasa, createdAt: iso(-3_700), lang: 'en', mediaIds: [mid(16), mid(17), mid(18), mid(19), mid(20)],
      text: rich('Photo dump from the open house.'),
      ...counts(2_200, 150, 33),
    },
    // 12: edited, place, reply policy
    {
      id: P(12), authorId: U.nasa, createdAt: iso(-4_100), lang: 'en',
      text: rich('Launch window opens at 14:20 local time (corrected).'),
      editIds: [pid(12, 9), P(12)],
      place: { id: 'a0b1c2', name: 'Kennedy Space Center', fullName: 'Kennedy Space Center, FL', country: 'United States', countryCode: 'US', type: 'poi' },
      replyPolicy: 'MyNetwork',
      ...counts(7_040, 980, 410),
    },
    // 13: Chinese, paid promotion, AI-generated image
    {
      id: P(13), authorId: U.xinghe, createdAt: iso(-90), lang: 'zh', mediaIds: [mid(21)],
      text: rich('昨晚在郊外拍到的猎户座大星云，曝光 3 小时。器材由 @orbital_labs 赞助。#天文摄影 #猎户座', [
        { type: 'mention', match: '@orbital_labs', userId: U.business },
        { type: 'hashtag', match: '#天文摄影' }, { type: 'hashtag', match: '#猎户座' },
      ]),
      paidPromotion: true, aiGenerated: { media: true, source: 'C2paClient' },
      ...counts(8_450, 1_020, 210),
    },
    // 14: community, reply policy Verified, text-only content warning
    {
      id: P(14), authorId: U.long, createdAt: iso(-45), lang: 'en',
      text: rich(`${LONG_NAME_POST_BODY} Here is a $BTC joke for the traders in the audience.`, [{ type: 'cashtag', match: '$BTC' }]),
      community: { id: '1700000000000000014', name: 'Space Enthusiasts' },
      replyPolicy: 'Verified',
      contentWarning: { title: 'Content warning: Spoilers' },
      ...counts(240, 31, 18),
    },
    // 15: quote of a captured post
    {
      id: P(15), authorId: U.ada, createdAt: iso(-30), lang: 'en',
      text: rich('This is the cleanest launch-pad photo I have seen all year.'),
      quote: { postId: P(1), url: 'https://x.com/NASA/status/' + P(1) },
      ...counts(512, 40, 22),
    },
    // 16: quote of an uncaptured post (tombstone)
    {
      id: P(16), authorId: U.xinghe, createdAt: iso(-25), lang: 'zh',
      text: rich('这条原帖已经看不到了，但我的评论还在：数据才是硬道理。'),
      quote: { postId: '1844000000000777777', url: 'https://x.com/someone/status/1844000000000777777', tombstone: '这个帖子已被其作者删除。' },
      ...counts(130, 8, 12),
    },
    // 17-18: pure reposts
    { id: P(17), authorId: U.ada, createdAt: iso(-20), repostOf: P(2) },
    { id: P(18), authorId: U.xinghe, createdAt: iso(-15), repostOf: P(3) },
    // 19: short post by the avatar-less user with cashtag
    {
      id: P(19), authorId: U.noAvatar, createdAt: iso(-12), lang: 'en',
      text: rich('first post, hello. $NASDAQ:RKLB to the moon?', [{ type: 'cashtag', match: '$NASDAQ:RKLB' }]),
      ...counts(0, 0, 0, { views: 14 }),
    },
    // 20: bot post with a timestamp entity
    {
      id: P(20), authorId: U.bot, createdAt: iso(-10), lang: 'en', source: 'launch-bot v2',
      text: rich('T-minus 01:25:00 to liftoff of the next mission. Stream starts at 09:55.', [{ type: 'timestamp', match: '01:25:00' }]),
      ...counts(88, 20, 3),
    },
    // 21: business account with a summary card
    {
      id: P(21), authorId: U.business, createdAt: iso(-8), lang: 'en',
      text: rich('We are hiring flight software engineers. https://t.co/orbjobs2', [{ type: 'url', match: 'https://t.co/orbjobs2', expanded: 'https://orbital.example.com/careers/flight-software' }]),
      card: { type: 'summary', url: 'https://t.co/orbjobs2', title: 'Flight Software Engineer · Orbital Labs', description: 'Join the team that writes the code that flies.', domain: 'orbital.example.com', image: { url: '/__media/photos/ad-1.jpg', width: 144, height: 144 } },
      ...counts(910, 160, 40),
    },
    // 22: long multi-paragraph Chinese post
    {
      id: P(22), authorId: U.xinghe, createdAt: iso(-200), lang: 'zh',
      text: rich('今天想聊聊深空摄影的几个常见误区。\n\n第一，赤道仪并不是越贵越好。很多人一上来就买最重的，结果每次出门都要两个人抬，最后反而拍得更少。\n\n第二，叠加张数不等于画质。三十张干净的素材通常好过三百张有云的素材。\n\n第三，不要迷信后期。滤镜能救一部分，救不了对焦不准。\n\n完整教程见 https://t.co/xhtutor1 ，欢迎指正。', [
        { type: 'url', match: 'https://t.co/xhtutor1', expanded: 'https://xinghe.example.cn/tutorials/deep-sky' },
      ]),
      ...counts(2_300, 310, 74),
    },
    // 23: long English post with Bold styles (note-tweet)
    {
      id: P(23), authorId: U.ada, createdAt: iso(-400), lang: 'en',
      text: rich('Thread-length thoughts on why I moved the archive format to plain JSON.\n\nFirst: every record is a fact. A post is a post, a user is a user, and media is media; they refer to each other by id and nothing else. That sounds obvious until you see how many tools embed the author inside the post and then fight their own cache.\n\nSecond: absent means unknown. Never write null, never write an empty array. Merging is then a one-liner: present values win, absent values keep what we know.\n\nThird: counters are different. They change on every capture, so they carry their own observation time, and "stale" just means the counters moved while the content did not.', [], {
        styles: [{ range: [0, 54], styles: ['Bold'] }],
      }),
      ...counts(1_190, 230, 58),
    },
    // 24: reply to an uncaptured parent (tombstone parent)
    {
      id: P(24), authorId: U.parody, createdAt: iso(-6), lang: 'en',
      replyTo: { postId: '1844000000000888888', handle: 'someone', tombstone: 'This post is unavailable.' },
      text: replyText('someone', uid(90), 'Actually it is a lot less cheese than people think.'),
      ...counts(12, 1, 0),
    },
    // 25-31: thread: root(25) <- 26 <- focal(27) <- replies
    {
      id: P(25), authorId: U.xinghe, createdAt: iso(-240), lang: 'zh', mediaIds: [mid(25), mid(26)],
      text: rich('提问：用 80mm 折射镜拍银河，大家一般用多大的光圈和多长的单张曝光？'),
      ...counts(640, 40, 7),
    },
    {
      id: P(26), authorId: U.nasa, createdAt: iso(-230), lang: 'en', conversationId: P(25),
      replyTo: { postId: P(25), userId: U.xinghe, handle: 'xinghe_guancha' },
      text: replyText('xinghe_guancha', U.xinghe, 'For wide fields we usually stay near f/2.8 and keep single frames under 20 seconds to avoid trailing.'),
      ...counts(1_900, 210, 34),
    },
    {
      id: P(27, 1), authorId: U.ada, createdAt: iso(-200), lang: 'en', conversationId: P(25), mediaIds: [mid(23)],
      replyTo: { postId: P(26), userId: U.nasa, handle: 'NASA' },
      source: 'Twitter for iPhone',
      text: replyText('NASA', U.nasa, 'Worth adding: the 500 rule is a rough guide only. Here is the script I use to compute the limit per sensor, output below. https://t.co/script001 #astrophotography', [
        { type: 'url', match: 'https://t.co/script001', expanded: 'https://gist.example.com/ada/exposure-calc' },
        { type: 'hashtag', match: '#astrophotography' },
      ]),
      ...counts(4_820, 1_240, 5, { views: 160_000 }),
    },
    {
      id: P(28), authorId: U.locked, createdAt: iso(-180), lang: 'en', conversationId: P(25),
      replyTo: { postId: P(27, 1), userId: U.ada, handle: 'ada_codes' },
      text: replyText('ada_codes', U.ada, 'Saved this. Does it handle crop sensors?'),
      ...counts(14, 0, 1),
    },
    {
      id: P(29), authorId: U.noAvatar, createdAt: iso(-150), lang: 'zh', conversationId: P(25),
      replyTo: { postId: P(27, 1), userId: U.ada, handle: 'ada_codes' },
      text: replyText('ada_codes', U.ada, '谢谢，收藏了！'),
      ...counts(2, 0, 0, { views: 90 }),
    },
    {
      id: P(30), authorId: U.bot, createdAt: iso(-120), lang: 'en', conversationId: P(25),
      replyTo: { postId: P(28), userId: U.locked, handle: 'private_diary_' },
      text: replyText('private_diary_', U.locked, 'Reminder: next dark-sky window opens in 6 days.'),
      ...counts(5, 0, 0),
    },
    {
      id: P(31), authorId: U.parody, createdAt: iso(-100), lang: 'en', conversationId: P(25),
      replyTo: { postId: P(27, 1), userId: U.ada, handle: 'ada_codes' },
      text: replyText('ada_codes', U.ada, 'The 500 rule is a lie, the 600 rule is a lie, only the cake is real. But also: please post the script as a repo, a gist feels temporary and I would like to send you a pull request that adds support for rolling-shutter sensors and a nicer table output with colours.'),
      ...counts(330, 12, 2),
    },
    // 32: bookmark-only extras, repost of a long-name post, edited text
    {
      id: P(32), authorId: U.long, createdAt: iso(-3_000), lang: 'en', mediaIds: [mid(22), mid(28)],
      text: rich('Two panoramas from the observatory, one of which is unavailable in your region.'),
      ...counts(95, 11, 4),
    },
    {
      id: P(33), authorId: U.business, createdAt: iso(-3_500), lang: 'en', mediaIds: [mid(29)],
      text: rich('Our new reaction wheel passes qualification. Details soon.'),
      paidPromotion: true,
      ...counts(1_450, 180, 52),
    },
    { id: P(34), authorId: U.ada, createdAt: iso(-3_900), repostOf: P(23) },
    // 35: search results extras
    {
      id: P(35), authorId: U.xinghe, createdAt: iso(-700), lang: 'zh', mediaIds: [mid(21)],
      text: rich('阿尔忒弥斯发射场的夜景，等了三个晚上。#Artemis', [{ type: 'hashtag', match: '#Artemis' }]),
      ...counts(2_700, 330, 41),
    },
  ];
  return posts;
}

// ------------------------------------------------------------------- ids

export const FIXTURE_IDS = {
  users: U,
  /** The status-page scenario: root 25 <- 26 <- focal 27 <- replies 28 (-> 30), 29, 31. */
  focalPostId: pid(27, 1),
  threadRootId: pid(25),
  /** Posts illustrating individual features. */
  posts: {
    textEntitiesPhoto: pid(1), fourPhotos: pid(2), video: pid(3), poll: pid(4), article: pid(5), linkCard: pid(6),
    communityNote: pid(7), sensitiveMedia: pid(8), gif: pid(9), threePhotos: pid(10), fivePhotos: pid(11), policies: pid(12),
    paidAi: pid(13), community: pid(14), quoteCaptured: pid(15), quoteTombstone: pid(16), repostPhotos: pid(17), repostVideo: pid(18),
    noAvatarShort: pid(19), bot: pid(20), businessCard: pid(21), longChinese: pid(22), longStyled: pid(23), replyTombstone: pid(24),
  },
  /** Handle of the profile timeline in `https://x.com/nasa`. */
  nasaHandle: 'NASA',
  searchQuery: 'artemis',
  /** One capture of each interesting kind. */
  captures: { ok: 'xhr-001', rateLimited: 'xhr-004', serverError: 'xhr-009', notModified: 'xhr-012', post: 'xhr-006', longBody: 'xhr-015' },
} as const;

export const fixtureUsers = buildUsers;
export const fixtureMedia = () => [...buildMedia(), ...FEED_FIXTURE_NUMBERS.flatMap((n) => makeFeedPost(n).media)];
export const fixturePosts = () => [...buildPosts(), ...FEED_FIXTURE_NUMBERS.map((n) => makeFeedPost(n).post)];

// ------------------------------------------------------- home feed pages

const FEED_AUTHORS = [U.nasa, U.xinghe, U.ada, U.business, U.long, U.noAvatar, U.bot, U.parody] as const;
const FEED_TEXTS = [
  '新页面帖子：今天的观测窗口比预期更长，云层在午夜前散开。',
  'A short note on the new scheduling tool: it plans around weather, not just orbits.',
  '刚收到的消息，整理在下面。#首页信息流',
  'Reading list for the weekend: three papers on dust grain alignment.',
  '这一条是后来才被推荐出来的。',
  'Small thing, big difference: calibrate before you stack.',
] as const;

/**
 * A synthetic home-feed post for number `n` (ids must not collide: fixtures use 101-199, the runtime hook 200+).
 * Every third post carries one photo from /__media/. The last id digit follows the remote-status convention.
 * `ageMinutes` is how long before the fixture clock the post was created.
 */
export function makeFeedPost(n: number, label?: string, ageMinutes = 30 + (n % 40)): { post: Post; media: Media[] } {
  const body = label ?? FEED_TEXTS[n % FEED_TEXTS.length];
  const media = n % 3 === 0 ? [photo(500 + n, `feed-${n}`, 1200, 800)] : [];
  const post: Post = {
    id: pid(n), authorId: FEED_AUTHORS[n % FEED_AUTHORS.length], createdAt: iso(-ageMinutes), lang: /[\u4e00-\u9fff]/.test(body) ? 'zh' : 'en',
    ...(media.length ? { mediaIds: media.map((m) => m.id) } : {}),
    text: rich(body),
    ...counts(100 + n * 7, 10 + n, n % 9),
  };
  return { post, media };
}

const FEED_FIXTURE_NUMBERS = [101, 102, 103, 104, 105, 106, 107, 108, 111, 112, 113, 114] as const;

export interface HomePageFixture {
  list: 'forYou' | 'following';
  /** Cursor the response was requested with (absent for initial / newer pages). */
  cursor?: string;
  bottomCursor: string;
  /** Minutes relative to the fixture clock (10:00Z on 2026-10-10). */
  capturedAtOffsetMinutes: number;
  postIds: string[];
}

/** Home lists as captured responses: ingested in order through the real `ingestTimeline`. */
export function fixtureHomePages(): HomePageFixture[] {
  const P = FIXTURE_IDS.posts;
  return [
    // For You: initial, older (continues 1), newer (with repeats from 1 and 2), older (continues 2, one repeat from 1).
    { list: 'forYou', bottomCursor: 'fy-b1', capturedAtOffsetMinutes: -42,
      postIds: [P.quoteCaptured, P.textEntitiesPhoto, P.paidAi, P.repostPhotos, P.quoteTombstone, P.bot, P.businessCard] },
    { list: 'forYou', cursor: 'fy-b1', bottomCursor: 'fy-b2', capturedAtOffsetMinutes: -39,
      postIds: [P.noAvatarShort, P.longStyled, P.sensitiveMedia, P.repostVideo, P.longChinese, P.community, P.replyTombstone] },
    { list: 'forYou', bottomCursor: 'fy-b3', capturedAtOffsetMinutes: -14,
      postIds: [pid(101), P.textEntitiesPhoto, pid(102), pid(103), P.longChinese, pid(104), pid(105)] },
    { list: 'forYou', cursor: 'fy-b2', bottomCursor: 'fy-b4', capturedAtOffsetMinutes: -9,
      postIds: [pid(106), P.businessCard, pid(107), pid(108)] },
    // Following: initial, older, newer (one repeat).
    { list: 'following', bottomCursor: 'fo-b1', capturedAtOffsetMinutes: -60,
      postIds: [pid(15), pid(17), pid(18), pid(19)] },
    { list: 'following', cursor: 'fo-b1', bottomCursor: 'fo-b2', capturedAtOffsetMinutes: -55,
      postIds: [pid(22), pid(23), pid(13), pid(14)] },
    { list: 'following', bottomCursor: 'fo-b3', capturedAtOffsetMinutes: -20,
      postIds: [pid(111), pid(112), pid(15), pid(113), pid(114)] },
  ];
}

export const FIXTURE_CLOCK = NOW;

/** Timeline contents by list (home lists are `fixtureHomePages`); seed.ts ingests them with the interceptor's key rules. */
export function fixtureTimelines() {
  const P = FIXTURE_IDS.posts;
  const ids = {
    nasaPosts: [P.textEntitiesPhoto, P.fourPhotos, P.video, P.poll, P.article, P.linkCard, P.communityNote, P.gif, P.threePhotos, P.fivePhotos, P.policies],
    bookmarks: [pid(23), pid(5), pid(7), pid(21), pid(32), pid(33), pid(34), pid(22), pid(11)],
    searchLatest: [pid(35), pid(13), pid(1), pid(2), pid(16), pid(15)],
  };
  return ids;
}

// ------------------------------------------------------------- XHR captures

function graphqlUrl(graphqlId: string, operation: string, variables: object, features = true): string {
  const params = new URLSearchParams({ variables: JSON.stringify(variables) });
  if (features) {
    params.set('features', JSON.stringify({
      rweb_video_screen_enabled: false, responsive_web_graphql_timeline_navigation_enabled: true,
      longform_notetweets_consumption_enabled: true, responsive_web_edit_tweet_api_enabled: true,
      freedom_of_speech_not_reach_fetch_enabled: true, view_counts_everywhere_api_enabled: true,
    }));
    params.set('fieldToggles', JSON.stringify({ withArticlePlainText: false }));
  }
  return `https://x.com/i/api/graphql/${graphqlId}/${operation}?${params.toString()}`;
}

const RESPONSE_HEADERS = 'content-type: application/json; charset=utf-8\r\ncache-control: no-cache, no-store, max-age=0\r\nx-rate-limit-limit: 150\r\nx-rate-limit-remaining: 147\r\nx-response-time: 118\r\n';

function longJson(): string {
  const entries = Array.from({ length: 36 }, (_, i) => ({
    entryId: `tweet-${1844000000000000000 + i}`,
    sortIndex: String(1844000000000000000 - i),
    content: { itemType: 'TimelineTimelineItem', tweetDisplayType: 'Tweet', rest_id: String(1844000000000000000 + i), legacy: { full_text: `Entry number ${i} with a reasonably long text body used to inflate the payload`, favorite_count: i * 13 } },
  }));
  return JSON.stringify({ data: { home: { home_timeline_urt: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } }, null, 1);
}

export function fixtureCaptures(): CapturedXhr[] {
  const spec: Array<{
    op: string; gid: string; method?: 'GET' | 'POST'; status?: number; vars: object; page?: string; body?: string; body2?: object;
  }> = [
    { op: 'HomeTimeline', gid: 'zGQrNmwPVk2tZIx6Hk0M-g', vars: { count: 20, includePromotedContent: true, requestContext: 'launch' }, page: 'https://x.com/home' },
    { op: 'UserByScreenName', gid: 'IGgvgiOx4QZndDHuD3x9TQ', vars: { screen_name: 'NASA', withSafetyModeUserFields: true }, page: 'https://x.com/NASA' },
    { op: 'UserOriginalsTimeline', gid: 'yH3WPZ7a6Kz9XQ1sT3WnLw', vars: { userId: U.nasa, count: 20, includePromotedContent: false, withVoice: true }, page: 'https://x.com/NASA' },
    { op: 'CreateTweet', gid: 'bDE2rBtZb3uyrczSZ_pI9g', method: 'POST', status: 429, vars: {}, body2: { variables: { tweet_text: 'draft', dark_request: false }, queryId: 'bDE2rBtZb3uyrczSZ_pI9g' }, page: 'https://x.com/compose/post' },
    { op: 'TweetDetail', gid: 'Kn1cpT3dX0wQKjpUaf3V3Q', vars: { focalTweetId: pid(27, 1), with_rux_injections: false, rankingMode: 'Relevance', includePromotedContent: true }, page: `https://x.com/ada_codes/status/${pid(27, 1)}` },
    { op: 'FavoriteTweet', gid: 'lI07N61twFgted2EgXILM7A', method: 'POST', vars: {}, body2: { variables: { tweet_id: pid(1) }, queryId: 'lI07N61twFgted2EgXILM7A' }, page: 'https://x.com/home' },
    { op: 'SearchTimeline', gid: 'flaR-PUMshxFWZWPNpq4zA', vars: { rawQuery: 'artemis', count: 20, querySource: 'typed_query', product: 'Latest' }, page: 'https://x.com/search?q=artemis&f=live' },
    { op: 'Bookmarks', gid: 'RV1g3b8n_SGOHwkqKYSCFw', vars: { count: 20, includePromotedContent: true }, page: 'https://x.com/i/bookmarks' },
    { op: 'NotificationsTimeline', gid: 'Ev6UMJRROInLNuyEaYEkNQ', status: 500, vars: { timeline_type: 'All', count: 20 }, page: 'https://x.com/notifications' },
    { op: 'Likes', gid: 'eSSNbhECHHWWALkkQq-YTA', vars: { userId: U.ada, count: 20, includePromotedContent: false }, page: 'https://x.com/ada_codes/likes' },
    { op: 'HomeLatestTimeline', gid: 'SFxmNKWfN9ySJcXG_tjX8g', vars: { count: 20, enableRanking: false }, page: 'https://x.com/home' },
    { op: 'UserByRestId', gid: 'tD8zKvQzwY3kdx5yz6YmOw', status: 304, vars: { userId: U.ada }, page: 'https://x.com/ada_codes' },
    { op: 'UserTweetsAndReplies', gid: 'Hf6mGq9ZK3YJmXgXe6TPeg', vars: { userId: U.xinghe, count: 20, includePromotedContent: true }, page: 'https://x.com/xinghe_guancha/with_replies' },
    { op: 'DeleteTweet', gid: 'VaenaVgh5q5ih7kvyVjgtg', method: 'POST', vars: {}, body2: { variables: { tweet_id: pid(24), dark_request: false }, queryId: 'VaenaVgh5q5ih7kvyVjgtg' }, page: 'https://x.com/home' },
    { op: 'HomeTimeline', gid: 'zGQrNmwPVk2tZIx6Hk0M-g', vars: { count: 20, cursor: 'DAABCgABGRtqNZr__-IKAAIZG1i2XlcA9QgAAwAAAAIAAA', includePromotedContent: true }, page: 'https://x.com/home', body: longJson() },
    { op: 'UserArticlesTweets', gid: 'cuG6sP3yvgQwP1w9q4ZnCA', vars: { userId: U.nasa, count: 20 }, page: 'https://x.com/NASA/articles' },
    { op: 'UserHighlightsTweets', gid: 'xY6PaPqUMQc7tF7VPgIpbA', status: 429, vars: { userId: U.nasa, count: 20 }, page: 'https://x.com/NASA/highlights' },
    { op: 'UserMedia', gid: '1R9wRbHLHDo5YWhl8E7SCA', vars: { userId: U.xinghe, count: 20, includePromotedContent: false }, page: 'https://x.com/xinghe_guancha/media' },
    { op: 'TweetResultByRestId', gid: 'Xl5pC_lBk_gcO2ItU39DQw', vars: { tweetId: pid(5), withCommunity: false }, page: 'https://x.com/NASA/status/' + pid(5) },
    { op: 'CreateBookmark', gid: 'aoDbu3RHznuiSkQ9aNM67Q', method: 'POST', vars: {}, body2: { variables: { tweet_id: pid(23) }, queryId: 'aoDbu3RHznuiSkQ9aNM67Q' }, page: 'https://x.com/ada_codes/status/' + pid(23) },
    { op: 'SearchTimeline', gid: 'flaR-PUMshxFWZWPNpq4zA', vars: { rawQuery: '阿尔忒弥斯', count: 20, querySource: 'typed_query', product: 'Top' }, page: 'https://x.com/search?q=%E9%98%BF%E5%B0%94%E5%BF%92%E5%BC%A5%E6%96%AF' },
    { op: 'UserByScreenName', gid: 'IGgvgiOx4QZndDHuD3x9TQ', vars: { screen_name: 'xinghe_guancha', withSafetyModeUserFields: true }, page: 'https://x.com/xinghe_guancha' },
    { op: 'TweetDetail', gid: 'Kn1cpT3dX0wQKjpUaf3V3Q', status: 500, vars: { focalTweetId: pid(25), with_rux_injections: false }, page: 'https://x.com/xinghe_guancha/status/' + pid(25) },
    { op: 'Bookmarks', gid: 'RV1g3b8n_SGOHwkqKYSCFw', vars: { count: 20, cursor: 'HBaAgLCYm5n9nzYAAA==' }, page: 'https://x.com/i/bookmarks' },
    { op: 'HomeTimeline', gid: 'zGQrNmwPVk2tZIx6Hk0M-g', vars: { count: 20, includePromotedContent: true }, page: 'https://x.com/home' },
  ];

  return spec.map((item, i) => {
    const method = item.method ?? 'GET';
    const status = item.status ?? 200;
    const startedAt = NOW - (spec.length - i) * 47_000;
    const url = method === 'GET' ? graphqlUrl(item.gid, item.op, item.vars) : `https://x.com/i/api/graphql/${item.gid}/${item.op}`;
    const requestBody = method === 'POST' ? JSON.stringify(item.body2 ?? { variables: item.vars }) : null;
    let responseBody: string;
    if (item.body) responseBody = item.body;
    else if (status === 304) responseBody = '';
    else if (status === 429) responseBody = JSON.stringify({ errors: [{ code: 88, message: 'Rate limit exceeded.' }] });
    else if (status === 500) responseBody = JSON.stringify({ errors: [{ code: 131, message: 'Dependency: Internal Error.' }] });
    else if (method === 'POST') responseBody = JSON.stringify({ data: { [item.op === 'DeleteTweet' ? 'delete_tweet' : 'result']: { tweet_results: {} } } });
    else responseBody = JSON.stringify({ data: { operation: item.op, variables: item.vars, entries: Math.round(3 + i * 1.7) } }, null, 2);
    return {
      id: `xhr-${String(i + 1).padStart(3, '0')}`,
      timestamp: startedAt + 180 + (i % 5) * 90,
      startedAt,
      pageUrl: item.page ?? 'https://x.com/home',
      method,
      url,
      graphqlId: item.gid,
      operationName: item.op,
      requestHeaders: [
        ['accept', '*/*'], ['authorization', 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAA...redacted'],
        ['content-type', 'application/json'], ['x-csrf-token', 'f0a1b2c3d4e5f60718293a4b5c6d7e8f'],
        ['x-twitter-active-user', 'yes'], ['x-twitter-client-language', 'en'],
      ],
      requestBody,
      status,
      statusText: status === 200 ? 'OK' : status === 304 ? 'Not Modified' : status === 429 ? 'Too Many Requests' : 'Internal Server Error',
      responseHeaders: RESPONSE_HEADERS + (status === 429 ? 'x-rate-limit-remaining: 0\r\nretry-after: 900\r\n' : ''),
      responseBody,
      responseSize: new TextEncoder().encode(responseBody).length,
    };
  });
}

export const fixtureUrls = {
  nasa: 'https://x.com/nasa',
  home: 'https://x.com/home',
  bookmarks: 'https://x.com/i/bookmarks',
  search: 'https://x.com/search?q=artemis&f=live',
  status: `https://x.com/ada_codes/status/${FIXTURE_IDS.focalPostId}`,
} as const;
