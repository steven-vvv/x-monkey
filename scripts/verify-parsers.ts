import { MediaSchema, PostSchema, UserSchema, type Post } from '../src/archive/model';
import { ArchiveCollector, collectTweet } from '../src/archive/normalize';
import { mergeArchiveRecord } from '../src/archive/merge';
import { sliceCodePoints, unescapeXText } from '../src/archive/text';
import { getSupportedEndpoint } from '../src/lib/endpoint-support';
import { parseTimelineResponse, parseTweetDetailResponse, type TimelineParsedResponse } from '../src/lib/parser';
import { getPlainText, getRichTextSegments } from '../src/lib/post-view';
import { buildArchiveBatch, compareArchiveBatch } from '../src/lib/remote-db/adapter';
import { clearDb, dbVersion, getPostCount, runDbBatch, upsertPost, upsertUser } from '../src/lib/db-service';
import { clearCaptureState } from '../src/lib/capture-state-service';
import {
  buildTimelineRecordKey,
  clearTimelineState,
  getTimelinePostIds,
  getTimelinePostIdsByAlias,
  getTimelineVersion,
  ingestTimeline,
  resolveTimelineRecordKey,
} from '../src/lib/timeline-store';
import type { ParsedResponse } from '../src/lib/types';
import { loadDumpFixtures } from './dump-fixtures';

function fail(message: string): never {
  throw new Error(message);
}

function check(condition: unknown, message: string): void {
  if (!condition) fail(`[inline] ${message}`);
}

// --- Raw payload builders (2026-10 shapes) ---

function rawUser(id: string, overrides: Record<string, any> = {}): Record<string, any> {
  return {
    __typename: 'User',
    rest_id: id,
    core: { name: `User ${id}`, screen_name: `user_${id}`, created_at: 'Tue Jan 01 00:00:00 +0000 2030' },
    avatar: { image_url: `https://pbs.twimg.com/profile_images/${id}/a_normal.jpg` },
    banner: { image_url: '' },
    profile_bio: { description: '' },
    relationship_counts: { followers: 1, following: 2 },
    tweet_counts: { tweets: 3, media_tweets: 4 },
    action_counts: { favorites_count: 5 },
    pinned_items: {},
    privacy: { protected: false },
    ...overrides,
  };
}

function rawMedia(id: string, overrides: Record<string, any> = {}): Record<string, any> {
  return {
    id_str: id,
    type: 'photo',
    media_url_https: `https://pbs.twimg.com/media/${id}.jpg`,
    original_info: { width: 1200, height: 800, focus_rects: [] },
    sizes: { large: { w: 1200, h: 800, resize: 'fit' } },
    ext_media_availability: { status: 'Available' },
    indices: [0, 0],
    url: 'https://t.co/media',
    expanded_url: `https://x.com/u/status/1/photo/1`,
    display_url: 'pic.x.com/media',
    ...overrides,
  };
}

function rawTweet(id: string, userId: string, legacy: Record<string, any> = {}, extra: Record<string, any> = {}): Record<string, any> {
  return {
    __typename: 'Tweet',
    rest_id: id,
    core: { user_results: { result: rawUser(userId) } },
    legacy: {
      id_str: id,
      user_id_str: userId,
      conversation_id_str: id,
      created_at: 'Tue Jan 01 00:00:00 +0000 2030',
      full_text: `tweet ${id}`,
      display_text_range: [0, `tweet ${id}`.length],
      entities: {},
      favorite_count: 1,
      retweet_count: 2,
      reply_count: 3,
      quote_count: 4,
      bookmark_count: 5,
      is_quote_status: false,
      lang: 'en',
      ...legacy,
    },
    views: { count: '12', state: 'EnabledWithCount' },
    ...extra,
  };
}

function timeline(...entries: unknown[]): unknown {
  return { data: { home: { home_timeline_urt: { instructions: [{ type: 'TimelineAddEntries', entries }] } } } };
}

function entry(result: unknown, itemContent: Record<string, unknown> = {}): unknown {
  return { content: { itemContent: { tweet_results: { result }, ...itemContent } } };
}

function collect(result: unknown): ArchiveCollector {
  const collector = new ArchiveCollector();
  collectTweet(result, 'inline', collector);
  if (collector.warnings.length) fail(`[inline] unexpected warnings: ${collector.warnings.join(' | ')}`);
  return collector;
}

// --- Inline scenarios ---

function assertTextScenarios(): void {
  const unescaped = unescapeXText('a &amp; b &lt;c&gt; 😀 d');
  check(unescaped.text === 'a & b <c> 😀 d', 'unescape text');
  check(unescaped.mapOffset(20) === 10 && unescaped.mapOffset(22) === 12, 'unescape maps offsets after escapes and emoji');

  // X indexes the escaped text by code point; the URL sits after an emoji and an escape.
  const fullText = '😀 &amp; https://t.co/abc';
  const posts = collect(rawTweet('10', '1', {
    full_text: fullText,
    display_text_range: [0, 24],
    entities: { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://example.com/', display_url: 'example.com', indices: [8, 24] }] },
  })).posts;
  const text = posts.get('10')!.text!;
  check(text.text === '😀 & https://t.co/abc', 'legacy text is unescaped');
  check(text.visible === undefined, 'full visible range is omitted');
  const url = text.entities![0];
  check(url.type === 'url' && sliceCodePoints(text.text, url.range[0], url.range[1]) === 'https://t.co/abc', 'url range is remapped to the unescaped text');
  check(getPlainText(text) === '😀 & example.com', 'segments slice by code points');

  // Long post replying to @a: the mention prefix lives only in legacy text.
  const note = collect(rawTweet('11', '1', {
    full_text: '@a short…',
    display_text_range: [3, 9],
    in_reply_to_status_id_str: '9',
    entities: { user_mentions: [{ id_str: '2', screen_name: 'a', name: 'A', indices: [0, 2] }] },
  }, {
    note_tweet: { note_tweet_results: { result: {
      text: 'long text 😀 #tag',
      entity_set: { hashtags: [{ text: 'tag', indices: [12, 16] }] },
      richtext: { richtext_tags: [{ from_index: 0, to_index: 4, richtext_types: ['Bold'] }] },
    } } },
  })).posts.get('11')!.text!;
  check(note.text === '@a long text 😀 #tag', 'note text keeps the reply prefix');
  check(JSON.stringify(note.visible) === '[3,19]', 'note visible range starts after the prefix');
  check(note.entities!.map((entity) => `${entity.type}@${entity.range}`).join(' ') === 'mention@0,2 hashtag@15,19', 'note entities are shifted');
  check(JSON.stringify(note.styles) === '[{"range":[3,7],"styles":["Bold"]}]', 'note styles are shifted');
  const segments = getRichTextSegments(note);
  check(segments[0].text === 'long' && segments[0].bold && segments[segments.length - 1].text === '#tag', 'note segments render the visible text');
}

function assertRelationScenarios(): void {
  const original = rawTweet('20', '2', {}, { quoted_status_result: { result: rawTweet('21', '3', {}, {
    nested_quoted_tweet_results: { result: rawTweet('22', '4') },
  }) } });
  const repost = collect(rawTweet('23', '1', {
    full_text: 'RT @user_2: tweet 20',
    retweeted_status_result: { result: original },
    extended_entities: { media: [rawMedia('500')] },
  }));
  check(JSON.stringify(repost.posts.get('23')) === '{"id":"23","authorId":"1","createdAt":"2030-01-01T00:00:00Z","repostOf":"20"}', 'pure repost keeps only the pointer');
  check(!repost.media.has('500'), 'repost wrapper media are not duplicated');
  check(repost.posts.get('20')?.quote?.postId === '21' && repost.posts.get('21')?.quote?.postId === '22', 'nested quotes are collected');
  check(repost.posts.has('22') && repost.users.has('4'), 'nested quoted post and author are stored');

  const source = collect(rawTweet('30', '1', {
    extended_entities: { media: [rawMedia('501', {
      source_status_id_str: '29',
      source_user_id_str: '5',
      source_user_results: { result: rawUser('5') },
    })] },
  }));
  const media = source.media.get('501')!;
  check(media.sourcePostId === '29' && media.sourceUserId === '5' && source.users.has('5'), 'media source user from source_user_results');
  check(source.posts.get('30')!.mediaIds!.join() === '501', 'post references media by id');
}

function assertUserScenarios(): void {
  const current = collect(rawTweet('40', '1', {}, { core: { user_results: { result: rawUser('1', {
    banner: { image_url: 'https://pbs.twimg.com/profile_banners/1/2' },
    profile_bio: {
      description: 'Bio https://t.co/x',
      entities: { description: { urls: [{ url: 'https://t.co/x', expanded_url: 'https://x.example/', display_url: 'x.example', indices: [4, 18] }] }, url: { urls: [{ url: 'https://t.co/y', expanded_url: 'https://site.example/', display_url: 'site.example', indices: [0, 23] }] } },
    },
    pinned_items: { tweet_ids_str: ['40'] },
    possibly_sensitive: true,
    profile_metadata: { profile_interstitial_type: 'sensitive_media' },
  }) } } })).users.get('1')!;
  const legacy = collect(rawTweet('41', '1', {}, { core: { user_results: { result: {
    __typename: 'User',
    rest_id: '1',
    core: { name: 'User 1', screen_name: 'user_1', created_at: 'Tue Jan 01 00:00:00 +0000 2030' },
    avatar: { image_url: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg' },
    privacy: { protected: false },
    legacy: {
      description: 'Bio https://t.co/x',
      entities: { description: { urls: [{ url: 'https://t.co/x', expanded_url: 'https://x.example/', display_url: 'x.example', indices: [4, 18] }] }, url: { urls: [{ url: 'https://t.co/y', expanded_url: 'https://site.example/', display_url: 'site.example', indices: [0, 23] }] } },
      followers_count: 1, friends_count: 2, statuses_count: 3, media_count: 4, favourites_count: 5,
      profile_banner_url: 'https://pbs.twimg.com/profile_banners/1/2',
      pinned_tweet_ids_str: ['40'],
      possibly_sensitive: true,
      profile_interstitial_type: 'sensitive_media',
    },
  } } } })).users.get('1')!;
  check(JSON.stringify(current) === JSON.stringify(legacy), 'current and legacy user payloads normalize identically');
  check(current.website === 'https://site.example/' && current.bio?.entities?.[0].type === 'url', 'user website and bio links');
  check(current.counts?.posts === 3 && current.bannerUrl && current.pinnedPostIds?.[0] === '40', 'user counts, banner, pinned');
  check(current.interstitial === 'sensitive_media', 'profile warning type');
  const plain = collect(rawTweet('42', '1', {}, { core: { user_results: { result: rawUser('1', { profile_metadata: { profile_interstitial_type: '' } }) } } })).users.get('1')!;
  check(plain.bannerUrl === undefined && plain.interstitial === undefined, 'empty banner and empty warning type are absent');
}

function assertCardScenarios(): void {
  const image = (url: string, size: number) => ({ type: 'IMAGE', image_value: { url, width: size, height: size } });
  const card = collect(rawTweet('50', '1', {}, { card: { rest_id: 'https://t.co/c', legacy: {
    name: 'summary_large_image',
    url: 'https://t.co/c',
    binding_values: [
      { key: 'title', value: { type: 'STRING', string_value: 'Title' } },
      { key: 'domain', value: { type: 'STRING', string_value: 'example.com' } },
      { key: 'vanity_url', value: { type: 'STRING', string_value: 'example.com' } },
      { key: 'photo_image_full_size_small', value: image('https://pbs.twimg.com/card_img/1/a?format=jpg&name=small', 100) },
      { key: 'photo_image_full_size_original', value: image('https://pbs.twimg.com/card_img/1/a?format=jpg&name=orig', 1000) },
      { key: 'thumbnail_image_original', value: image('https://pbs.twimg.com/card_img/1/a?format=jpg&name=orig', 1000) },
      { key: 'thumbnail_image_color', value: { type: 'IMAGE_COLOR', image_color_value: {} } },
      { key: 'site', value: { type: 'USER', user_value: { id_str: '7' } } },
      { key: 'app_name', value: { type: 'STRING', string_value: 'App' } },
    ],
  } } })).posts.get('50')!.card!;
  check(card.image?.url.endsWith('name=orig') && card.image.width === 1000, 'card keeps the original rendition');
  check(card.domain === 'example.com' && card.siteUserId === '7' && card.title === 'Title', 'card fields');
  check(JSON.stringify(card.extra) === '{"app_name":"App"}', 'unknown bindings stay in extra, duplicates do not');

  const text = (key: string, value: string) => ({ key, value: { type: 'STRING', string_value: value } });
  const pollBindings = [
    text('choice1_label', 'A'), text('choice1_count', '3'), text('choice2_label', 'B'), text('choice2_count', '1'),
    text('choice3_label', 'C'), text('choice3_count', '0'), text('choice4_label', 'D'), text('choice4_count', '0'),
    text('end_datetime_utc', '2030-01-02T00:00:00Z'), text('last_updated_datetime_utc', '2030-01-01T12:00:00Z'),
    { key: 'counts_are_final', value: { type: 'BOOLEAN', boolean_value: false } },
    // The vote endpoint, the duration, the placeholder URL and the viewer's own vote are not content.
    text('api', 'capi://passthrough/1'), text('duration_minutes', '1440'), text('selected_choice', '2'),
    { key: 'card_url', value: { type: 'STRING', string_value: 'https://twitter.com', scribe_key: 'card_url' } },
  ];
  const poll = collect(rawTweet('51', '1', {}, { card: { rest_id: 'card://9', legacy: {
    name: 'poll4choice_text_only', url: 'card://9', binding_values: pollBindings,
  } } })).posts.get('51')!.card!;
  check(JSON.stringify(poll) === '{"type":"poll4choice_text_only","url":"card://9","poll":{"choices":[{"label":"A","count":3},{"label":"B","count":1},{"label":"C","count":0},{"label":"D","count":0}],"endsAt":"2030-01-02T00:00:00Z","final":false,"updatedAt":"2030-01-01T12:00:00Z"}}', 'four-choice poll card');

  // Card types without samples (two-choice polls, for example) are not parsed; their raw values are kept.
  const unsupported = collect(rawTweet('53', '1', {}, { card: { rest_id: 'card://8', legacy: {
    name: 'poll2choice_text_only', url: 'card://8', binding_values: pollBindings.slice(0, 4).concat(pollBindings.slice(10)),
  } } })).posts.get('53')!.card!;
  check(JSON.stringify(unsupported) === '{"type":"poll2choice_text_only","url":"card://8","extra":{"choice1_label":"A","choice1_count":"3","choice2_label":"B","choice2_count":"1","counts_are_final":false,"api":"capi://passthrough/1","duration_minutes":"1440"}}', 'unsupported card keeps raw values only');
  check(collect(rawTweet('52', '1', {}, { card: { rest_id: 'https://t.co/u' } })).posts.get('52')!.card === undefined, 'unexpanded card is dropped');
}

function assertVisibilityScenarios(): void {
  // A reply restriction names the conversation owner by handle only, so there is no user record to collect.
  const restricted = collect({
    __typename: 'TweetWithVisibilityResults',
    limitedActionResults: { limited_actions: [{ action: 'Reply', prompt: { __typename: 'CtaLimitedActionPrompt', cta_type: 'SeeConversation' } }] },
    tweet: rawTweet('59', '1', { conversation_control: { policy: 'Community', conversation_owner_results: { result: { __typename: 'User', core: { screen_name: 'user_1' } } } } }),
  });
  check(restricted.posts.get('59')?.replyPolicy === 'Community' && restricted.users.size === 1, 'reply restriction on a wrapped post');
}

function assertTaggedTextScenarios(): void {
  // X writes an asset identifier into the text and tags it; readers see `$BTC`.
  const smartTag = { indices: [3, 17], text: 'bitcoin:native', tag: { info: { info: { name: 'Bitcoin', ticker: 'BTC' } } } };
  const tagged = collect(rawTweet('54', '1', {
    full_text: 'up bitcoin:native #BTC',
    display_text_range: [0, 22],
    entities: { hashtags: [{ text: 'BTC', indices: [18, 22] }], smarttags: [smartTag] },
  }, { cashtag_attachments: [{ rest_id: 'bitcoin:native' }] })).posts.get('54')!.text!;
  check(JSON.stringify(tagged.entities) === '[{"type":"cashtag","range":[3,17],"name":"Bitcoin","ticker":"BTC"},{"type":"hashtag","range":[18,22]}]', 'smart tag becomes a cashtag with its ticker');
  check(getPlainText(tagged) === 'up $BTC #BTC', 'tagged asset is shown as its ticker');

  // In a long reply the tag sits in the note text, after the mention prefix.
  const note = collect(rawTweet('55', '1', {
    full_text: '@a up…',
    display_text_range: [3, 6],
    in_reply_to_status_id_str: '9',
    entities: { user_mentions: [{ id_str: '2', screen_name: 'a', name: 'A', indices: [0, 2] }] },
  }, {
    note_tweet: { note_tweet_results: { result: { text: 'up bitcoin:native', entity_set: { smarttags: [smartTag], symbols: [] } } } },
    cashtag_attachments: [{ rest_id: 'bitcoin:native' }],
  })).posts.get('55')!.text!;
  check(note.entities!.map((entity) => `${entity.type}@${entity.range}`).join(' ') === 'mention@0,2 cashtag@6,20', 'note smart tag is shifted past the reply prefix');
  check(getPlainText(note) === 'up $BTC', 'note smart tag is shown as its ticker');

  const symbol = collect(rawTweet('56', '1', {
    full_text: '$BTC up',
    display_text_range: [0, 7],
    entities: { symbols: [{ indices: [0, 4], text: 'BTC', tag: { info: { info: { name: 'Bitcoin', ticker: 'BTC' } } } }] },
  })).posts.get('56')!.text!;
  check(JSON.stringify(symbol.entities) === '[{"type":"cashtag","range":[0,4],"name":"Bitcoin"}]', 'a symbol the text spells out keeps only its name');

  const untagged = new ArchiveCollector();
  collectTweet(rawTweet('57', '1', {}, { cashtag_attachments: [{ rest_id: 'bitcoin:native' }] }), 'inline', untagged);
  check(untagged.warnings.length === 1 && untagged.posts.has('57'), 'an attachment the text does not tag is reported');

  // Community note links: the text shows a shortened form, the reference has the destination.
  const noted = collect(rawTweet('58', '1', {}, { birdwatch_pivot: {
    destinationUrl: 'https://twitter.com/i/birdwatch/n/9',
    title: 'Readers added context',
    note: { rest_id: '9', language: 'en' },
    subtitle: { text: 'See example.com/a…', entities: [{ fromIndex: 4, toIndex: 18, ref: { type: 'TimelineUrl', url: 'https://t.co/n', expandedUrl: 'https://example.com/article', urlType: 'ExternalUrl' } }] },
  } })).posts.get('58')!.communityNote!;
  check(JSON.stringify(noted) === '{"id":"9","title":"Readers added context","text":{"text":"See example.com/a…","entities":[{"type":"url","range":[4,18],"expanded":"https://example.com/article"}]},"lang":"en","url":"https://twitter.com/i/birdwatch/n/9"}', 'community note with expanded links');
}

function assertTraversalScenarios(): void {
  const parsed = parseTimelineResponse({ data: { home: { home_timeline_urt: { instructions: [
    { type: 'TimelineAddEntries', entries: [entry(rawTweet('60', '1')), entry(rawTweet('61', '1'), { promotedMetadata: {} })] },
    { type: 'TimelineAddToModule', moduleItems: [{ item: { itemContent: { tweet_results: { result: rawTweet('62', '1') } } } }] },
    { type: 'TimelinePinEntry', entry: entry(rawTweet('63', '1')) },
  ] } } } });
  check(parsed.postIds.join() === '60,62,63', 'entries, module items and pinned entries in order');
  check(!parsed.posts.has('61'), 'promoted entries are skipped');
  check(parseTimelineResponse({}).meta.warnings.length > 0, 'unknown response shape warns');

  const bookmarks = parseTimelineResponse({ data: { bookmark_timeline_v2: { timeline: { instructions: [{ entries: [entry(rawTweet('64', '1'))] }] } } } });
  check(bookmarks.meta.instructionPath === 'data.bookmark_timeline_v2.timeline.instructions' && bookmarks.postIds.join() === '64', 'bookmarks path');

  // Search: plain entries, a relevance prompt without a post, and the media tab's grid module.
  const search = parseTimelineResponse({ data: { search_by_raw_query: { search_timeline: { timeline: { instructions: [{ type: 'TimelineAddEntries', entries: [
    entry(rawTweet('65', '1')),
    { content: { itemContent: { itemType: 'TimelinePrompt', content: { contentType: 'TimelineRelevancePrompt' } } } },
    { content: { displayType: 'VerticalGrid', items: [{ item: { itemContent: { tweet_results: { result: rawTweet('66', '1') } } } }] } },
  ] }] } } } } });
  check(search.postIds.join() === '65,66' && search.meta.warnings.length === 0, 'search results path');
}

function assertMergeScenarios(): void {
  const stored: Record<string, unknown> = {
    id: '1', text: { text: 'a', entities: [{ type: 'hashtag', range: [0, 1] }] }, article: { id: '9', title: 'T', blocks: [{ type: 'unstyled', text: 'body' }] },
    counts: { likes: 1, views: 10 },
  };
  const changed = mergeArchiveRecord(stored, { id: '1', text: { text: 'a' }, article: { id: '9', title: 'T' }, counts: { likes: 2 } });
  check(changed, 'merge reports changes');
  check((stored.article as any).blocks?.length === 1 && (stored.text as any).entities?.length === 1, 'absent fields keep stored values');
  check(JSON.stringify(stored.counts) === '{"likes":2,"views":10}', 'present values win per field');
  check(!mergeArchiveRecord(stored, { id: '1', counts: { likes: 2 } }), 'unchanged merge reports no change');
}

function assertRemoteScenarios(): void {
  const collector = collect(rawTweet('70', '1', {
    retweeted_status_result: { result: rawTweet('71', '2', { extended_entities: { media: [rawMedia('700')] } }, {
      quoted_status_result: { result: rawTweet('72', '3') },
    }) },
  }));
  const source = {
    getPost: (id: string) => collector.posts.get(id),
    getUser: (id: string) => collector.users.get(id),
    getMedia: (id: string) => collector.media.get(id),
  };
  const { batch, missingPostIds } = buildArchiveBatch(['70', '99'], source);
  check(batch.posts.map((post) => post.id).sort().join() === '70,71,72', 'repost batch includes the original and its quote');
  check(batch.users.length === 3 && batch.media.map((item) => item.id).join() === '700', 'batch includes authors and media');
  check(missingPostIds.join() === '99', 'unknown posts are reported');

  const found = <T extends { id: string }>(items: T[]) => items.map((item) => ({ id: item.id, status: 'found' as const, data: structuredClone(item) }));
  const response = { users: found(batch.users), posts: found(batch.posts), media: found(batch.media) };
  check(compareArchiveBatch(batch, response).status === 'in_sync', 'identical records are in sync');

  const remotePost = response.posts.find((item) => item.id === '71')!.data as Post;
  remotePost.counts = { ...remotePost.counts, likes: 0 };
  check(compareArchiveBatch(batch, response).status === 'stale', 'counter-only differences are stale');
  remotePost.text = { text: 'changed' };
  check(compareArchiveBatch(batch, response).status === 'mismatch', 'content differences mismatch');
  remotePost.text = structuredClone(batch.posts.find((post) => post.id === '71')!.text);
  (remotePost as any).article = { id: '5', title: 'only remote' };
  check(compareArchiveBatch(batch, response).status === 'stale', 'extra remote fields do not mismatch');
  response.media = [];
  check(compareArchiveBatch(batch, response).status === 'failed', 'missing results fail');

  // An open poll: a later capture differs in its tally only.
  const poll = (votes: number, updatedAt: string, label = 'A') => PostSchema.parse({
    id: '73', authorId: '1', createdAt: '2030-01-01T00:00:00Z',
    card: { type: 'poll4choice_text_only', url: 'card://9', poll: { choices: [{ label, count: votes }, { label: 'B', count: 1 }], endsAt: '2030-01-02T00:00:00Z', final: false, updatedAt } },
  });
  const comparePoll = (local: Post, remote: Post) => compareArchiveBatch(
    { users: [], posts: [local], media: [] },
    { users: [], posts: [{ id: '73', status: 'found', data: remote }], media: [] },
  ).status;
  const stored = poll(3, '2030-01-01T10:00:00Z');
  check(comparePoll(stored, structuredClone(stored)) === 'in_sync', 'identical polls are in sync');
  check(comparePoll(poll(5, '2030-01-01T12:00:00Z'), stored) === 'stale', 'a newer poll tally is stale, not a mismatch');
  check(comparePoll(poll(3, '2030-01-01T10:00:00Z', 'Renamed'), stored) === 'mismatch', 'a different poll choice mismatches');
  const closed = poll(5, '2030-01-02T00:00:01Z');
  closed.card!.poll!.final = true;
  check(comparePoll(closed, stored) === 'mismatch', 'a poll that ended since mismatches');
}

function assertStoreScenarios(): void {
  clearDb();
  const start = dbVersion.value;
  runDbBatch(() => {
    upsertUser(UserSchema.parse({ id: '1', handle: 'a', name: 'A' }));
    upsertPost(PostSchema.parse({ id: '2', authorId: '1', createdAt: '2030-01-01T00:00:00Z' }));
  });
  check(dbVersion.value - start === 1, 'db batch bumps the version once');

  clearTimelineState();
  const key = buildTimelineRecordKey('UserMediaTimeline', '42');
  ingestTimeline({ key, namespace: 'UserMediaTimeline', postIds: ['t1', 't2', 't1'], aliases: ['42', 'Owner'] });
  check(getTimelinePostIds(key).join() === 't1,t2' && getTimelineVersion(key) === 1, 'timeline dedupes and versions');
  check(getTimelinePostIdsByAlias('UserMediaTimeline', 'owner').join() === 't1,t2', 'aliases are case-insensitive');
  check(resolveTimelineRecordKey('UserMediaTimeline#popular', 'owner') === null, 'sort variants are separate timelines');
  ingestTimeline({ key: 'Home', namespace: 'Home', postIds: ['h1', 'h2'], insertMode: 'prepend' });
  ingestTimeline({ key: 'Home', namespace: 'Home', postIds: ['h3', 'h2'], insertMode: 'prepend' });
  check(getTimelinePostIds('Home').join() === 'h3,h1,h2', 'prepend mode');

  clearCaptureState();
  check(getPostCount() === 0 && getTimelinePostIds('Home').length === 0, 'clearCaptureState empties db and timelines');
}

// --- Fixtures ---

function assertParsedRecords(parsed: ParsedResponse, label: string): void {
  if (parsed.meta.warnings.length) fail(`[${label}] warnings: ${parsed.meta.warnings.slice(0, 3).join(' | ')}`);
  for (const user of parsed.users.values()) UserSchema.parse(user);
  for (const media of parsed.media.values()) MediaSchema.parse(media);
  for (const post of parsed.posts.values()) {
    PostSchema.parse(post);
    if (!parsed.users.has(post.authorId)) fail(`[${label}] post ${post.id} author ${post.authorId} missing`);
    if (post.repostOf && !parsed.posts.has(post.repostOf)) fail(`[${label}] repost ${post.id} target missing`);
    for (const mediaId of post.mediaIds ?? []) {
      if (!parsed.media.has(mediaId)) fail(`[${label}] post ${post.id} media ${mediaId} missing`);
    }
  }
}

function main(): void {
  assertTextScenarios();
  assertRelationScenarios();
  assertUserScenarios();
  assertCardScenarios();
  assertVisibilityScenarios();
  assertTaggedTextScenarios();
  assertTraversalScenarios();
  assertMergeScenarios();
  assertRemoteScenarios();
  assertStoreScenarios();
  console.log('inline scenarios: ok');

  const fixtures = loadDumpFixtures();
  const stats = new Map<string, { files: number; ordered: number; posts: number; users: number; media: number }>();
  const unsupported = new Set<string>();

  for (const fixture of fixtures) {
    const endpoint = getSupportedEndpoint(fixture.operationName);
    if (!endpoint) {
      unsupported.add(fixture.operationName);
      continue;
    }
    const parsed = endpoint.kind === 'tweet-detail'
      ? parseTweetDetailResponse(fixture.response)
      : parseTimelineResponse(fixture.response);
    assertParsedRecords(parsed, fixture.source);

    const ordered = (parsed as TimelineParsedResponse).postIds ?? [];
    for (const id of ordered) {
      if (!parsed.posts.has(id)) fail(`[${fixture.source}] ordered post ${id} missing`);
    }
    if (endpoint.kind === 'timeline' && ordered.length === 0) fail(`[${fixture.source}] timeline produced no posts`);

    const entry = stats.get(fixture.operationName) ?? { files: 0, ordered: 0, posts: 0, users: 0, media: 0 };
    entry.files += 1;
    entry.ordered += ordered.length;
    entry.posts += parsed.posts.size;
    entry.users += parsed.users.size;
    entry.media += parsed.media.size;
    stats.set(fixture.operationName, entry);
  }

  if (fixtures.length === 0) {
    console.log('fixtures: none under dumps/ (gitignored); only inline scenarios ran');
    return;
  }
  for (const [operationName, entry] of [...stats.entries()].sort()) {
    console.log(`${operationName}: files=${entry.files}, ordered=${entry.ordered}, posts=${entry.posts}, users=${entry.users}, media=${entry.media}`);
  }
  if (unsupported.size) console.log(`unsupported operations skipped: ${[...unsupported].sort().join(', ')}`);
}

main();
