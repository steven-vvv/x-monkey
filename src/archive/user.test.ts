import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserSchema } from './model.ts';
import { ArchiveCollector, collectUser, type UserContext } from './normalize.ts';

type Raw = Record<string, any>;

function collect(raw: Raw, context?: UserContext) {
  const collector = new ArchiveCollector();
  const id = collectUser(raw, 'test', collector, context);
  assert.ok(id, `user not collected: ${JSON.stringify(collector.warnings)}`);
  assert.deepEqual(collector.warnings, []);
  return collector.users.get(id)!;
}

const BANNER = 'https://pbs.twimg.com/profile_banners/1/2';

/** A fully filled 2026-10 user node. */
function fullNode(overrides: Raw = {}): Raw {
  return {
    __typename: 'User',
    rest_id: '1',
    core: { name: 'Ann', screen_name: 'ann', created_at: 'Tue Jan 01 00:00:00 +0000 2030' },
    avatar: { image_url: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg' },
    banner: { image_url: BANNER },
    profile_bio: {
      description: 'Bio https://t.co/x',
      entities: {
        description: { urls: [{ url: 'https://t.co/x', expanded_url: 'https://x.example/', indices: [4, 18] }] },
        url: { urls: [{ url: 'https://t.co/y', expanded_url: 'https://site.example/', indices: [0, 23] }] },
      },
      withheld_in_countries: ['SA'],
    },
    location: { location: 'Sydney' },
    pinned_items: { tweet_ids_str: ['40'] },
    privacy: { protected: false },
    possibly_sensitive: true,
    profile_metadata: { profile_interstitial_type: 'sensitive_media' },
    profile_image_shape: 'Circle',
    is_blue_verified: true,
    verification: { verified_type: 'Business' },
    parody_commentary_fan_label: 'Fan',
    affiliates_highlighted_label: { label: { description: 'Acme', userLabelType: 'BusinessLabel' } },
    professional: { professional_type: 'Creator', category: [{ name: 'Artist' }] },
    relationship_counts: { followers: 1, following: 2 },
    tweet_counts: { tweets: 3, media_tweets: 4 },
    action_counts: { favorites_count: 5 },
    ...overrides,
  };
}

/** The same account after clearing every clearable field, as a full profile reports it. */
function clearedNode(): Raw {
  return fullNode({
    banner: { image_url: '' },
    profile_bio: { description: '', entities: { description: { urls: [] } } },
    location: { location: '' },
    pinned_items: {},
    possibly_sensitive: undefined,
    profile_metadata: { profile_interstitial_type: '' },
    profile_image_shape: undefined,
    verification: undefined,
    parody_commentary_fan_label: 'None',
    affiliates_highlighted_label: {},
    professional: undefined,
  });
}

test('full profile with everything present emits every field with its value', () => {
  const user = collect(fullNode(), 'profile');
  assert.deepEqual(user, {
    id: '1',
    handle: 'ann',
    name: 'Ann',
    createdAt: '2030-01-01T00:00:00Z',
    avatarUrl: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg',
    avatarShape: 'Circle',
    bannerUrl: BANNER,
    bio: { text: 'Bio https://t.co/x', entities: [{ type: 'url', range: [4, 18], expanded: 'https://x.example/' }] },
    location: 'Sydney',
    website: 'https://site.example/',
    pinnedPostIds: ['40'],
    protected: false,
    sensitive: true,
    interstitial: 'sensitive_media',
    withheldIn: ['SA'],
    verified: { blue: true, type: 'Business' },
    affiliation: { name: 'Acme', kind: 'BusinessLabel' },
    parody: 'Fan',
    professional: { type: 'Creator', categories: ['Artist'] },
    counts: { followers: 1, following: 2, posts: 3, mediaPosts: 4, likes: 5 },
  });
  assert.ok(UserSchema.safeParse(user).success);
});

test('full profile with cleared fields sends typed empties where X has the container and null where it does not', () => {
  const user = collect(clearedNode(), 'profile');
  assert.equal(user.bannerUrl, '');
  assert.deepEqual(user.bio, { text: '' });
  assert.equal(user.location, '');
  assert.equal(user.website, null);
  assert.deepEqual(user.pinnedPostIds, []);
  assert.equal(user.professional, null);
  assert.equal(user.affiliation, null);
  assert.equal(user.interstitial, '');
  assert.equal(user.parody, '');
  assert.equal(user.sensitive, null);
  assert.equal(user.avatarShape, null);
  assert.equal(user.withheldIn, null);
  assert.deepEqual(user.verified, { blue: true, type: null });
  assert.ok(UserSchema.safeParse(user).success);
});

test('full profile without banner, bio, location and professional containers reports null', () => {
  const node = fullNode({ banner: undefined, profile_bio: undefined, location: undefined, pinned_items: undefined, professional: undefined });
  const user = collect(node, 'profile');
  assert.equal(user.bannerUrl, null);
  assert.equal(user.bio, null);
  assert.equal(user.location, null);
  assert.equal(user.website, null);
  assert.equal(user.pinnedPostIds, null);
  assert.equal(user.professional, null);
  // Facts every account has are never nulled.
  assert.equal(user.createdAt, '2030-01-01T00:00:00Z');
  assert.ok(UserSchema.safeParse(user).success);
});

test('full profile: an empty website list and an empty category list are typed empties', () => {
  const user = collect(fullNode({
    profile_bio: { description: 'x', entities: { url: { urls: [] } } },
    professional: { professional_type: 'Business', category: [] },
  }), 'profile');
  assert.equal(user.website, '');
  assert.deepEqual(user.professional, { type: 'Business', categories: [] });
});

test('full profile through legacy: a legacy container counts as present', () => {
  const user = collect({
    __typename: 'User',
    rest_id: '1',
    core: { name: 'Ann', screen_name: 'ann' },
    legacy: { description: '', location: '', pinned_tweet_ids_str: [], entities: { description: { urls: [] } } },
  }, 'profile');
  assert.deepEqual(user.bio, { text: '' });
  assert.equal(user.location, '');
  assert.deepEqual(user.pinnedPostIds, []);
  assert.equal(user.bannerUrl, null);
  assert.equal(user.website, null);
});

test('embedded user without containers emits no null and no cleared field', () => {
  const user = collect({
    __typename: 'User',
    rest_id: '1',
    core: { name: 'Ann', screen_name: 'ann' },
    avatar: { image_url: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg' },
    privacy: { protected: false },
  });
  assert.deepEqual(user, {
    id: '1',
    handle: 'ann',
    name: 'Ann',
    avatarUrl: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg',
    protected: false,
  });
  assert.ok(!JSON.stringify(user).includes('null'));
});

test('embedded user with present-but-empty containers emits typed empties', () => {
  const user = collect(clearedNode());
  assert.equal(user.bannerUrl, '');
  assert.deepEqual(user.bio, { text: '' });
  assert.equal(user.location, '');
  assert.equal(user.interstitial, '');
  assert.equal(user.parody, '');
  // Missing containers and ambiguous stubs stay absent.
  for (const key of ['website', 'pinnedPostIds', 'professional', 'affiliation', 'sensitive', 'avatarShape', 'withheldIn']) {
    assert.ok(!(key in user), `${key} must be absent`);
  }
  assert.deepEqual(user.verified, { blue: true });
  assert.ok(!JSON.stringify(user).includes('null'));
});

test('embedded legacy containers count: empty legacy fields and an explicit empty pinned list', () => {
  const user = collect({
    __typename: 'User',
    rest_id: '1',
    legacy: { screen_name: 'ann', name: 'Ann', description: '', location: '', pinned_tweet_ids_str: [], withheld_in_countries: [] },
  });
  assert.deepEqual(user.bio, { text: '' });
  assert.equal(user.location, '');
  assert.deepEqual(user.pinnedPostIds, []);
  assert.deepEqual(user.withheldIn, []);
  assert.ok(!('bannerUrl' in user));
});

test('a non-empty dedicated value wins over an empty legacy one and vice versa', () => {
  const dedicated = collect(fullNode({ legacy: { location: '', profile_banner_url: '' } }));
  assert.equal(dedicated.location, 'Sydney');
  assert.equal(dedicated.bannerUrl, BANNER);
  const fallback = collect(fullNode({ location: { location: '' }, legacy: { location: 'Perth' } }));
  assert.equal(fallback.location, 'Perth');
});

test('id, handle and name stay required', () => {
  for (const context of ['profile', 'embedded'] as const) {
    for (const node of [fullNode({ rest_id: undefined }), fullNode({ core: { name: 'Ann' } }), fullNode({ core: { screen_name: 'ann' } })]) {
      const collector = new ArchiveCollector();
      assert.equal(collectUser(node, 'test', collector, context), undefined);
      assert.equal(collector.users.size, 0);
      assert.equal(collector.warnings.length, 1);
    }
  }
});

test('the model accepts null and typed empties and still rejects garbage', () => {
  const base = { id: '1', handle: 'ann', name: 'Ann' };
  const valid = {
    ...base,
    bannerUrl: null,
    bio: { text: '' },
    location: '',
    website: null,
    pinnedPostIds: [],
    withheldIn: [],
    interstitial: null,
    sensitive: null,
    avatarShape: null,
    parody: '',
    verified: { blue: false, type: null },
    affiliation: null,
    professional: { type: null, categories: [] },
  };
  assert.ok(UserSchema.safeParse(valid).success);
  assert.ok(UserSchema.safeParse({ ...base, professional: null, verified: null }).success);

  const invalid: unknown[] = [
    { ...base, id: null },
    { ...base, handle: null },
    { ...base, name: null },
    { ...base, id: 'abc' },
    { ...base, counts: null },
    { ...base, createdAt: null },
    { ...base, protected: null },
    { ...base, bannerUrl: 5 },
    { ...base, bio: '' },
    { ...base, bio: {} },
    { ...base, bio: { text: null } },
    { ...base, pinnedPostIds: ['abc'] },
    { ...base, pinnedPostIds: 'none' },
    { ...base, withheldIn: [1] },
    { ...base, sensitive: 'yes' },
    { ...base, verified: { blue: null } },
    { ...base, professional: { categories: [1] } },
    { ...base, professional: { type: 'x', extra: 1 } },
    { ...base, affiliation: {} },
    { ...base, unknownField: null },
  ];
  for (const record of invalid) assert.equal(UserSchema.safeParse(record).success, false, JSON.stringify(record));
});
