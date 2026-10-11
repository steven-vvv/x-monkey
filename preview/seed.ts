/** Feeds the fixtures into the real stores, the way the XHR interceptor does. */
import { MediaSchema, PostSchema, UserSchema } from '../src/archive/model';
import { runDbBatch, upsertMedia, upsertPost, upsertUser } from '../src/lib/db-service';
import { getFeatureTimelineNamespace } from '../src/lib/feature-timeline';
import { buildTimelineRecordKey, ingestTimeline } from '../src/lib/timeline-store';
import { captures, isCapturing } from '../src/lib/xhr-capture-service';
import { FIXTURE_IDS, fixtureCaptures, fixtureMedia, fixturePosts, fixtureTimelines, fixtureUsers } from './fixtures';

function validate(kind: string, schema: { safeParse(value: unknown): { success: boolean; error?: unknown } }, items: Array<{ id: string }>): void {
  for (const item of items) {
    const result = schema.safeParse(item);
    if (!result.success) console.warn(`[preview] fixture ${kind} ${item.id} violates the archive schema`, result.error);
  }
}

export function seedDatabase(): void {
  const users = fixtureUsers();
  const media = fixtureMedia();
  const posts = fixturePosts();
  validate('user', UserSchema, users);
  validate('media', MediaSchema, media);
  validate('post', PostSchema, posts);

  runDbBatch(() => {
    users.forEach(upsertUser);
    media.forEach(upsertMedia);
    posts.forEach(upsertPost);
  });

  const lists = fixtureTimelines();
  const userList = (userId: string, handle: string, postIds: string[]) => {
    const namespace = getFeatureTimelineNamespace('user-posts');
    ingestTimeline({ key: buildTimelineRecordKey(namespace, userId), namespace, postIds, aliases: [userId, handle], insertMode: 'append' });
  };
  const globalList = (source: Parameters<typeof getFeatureTimelineNamespace>[0], postIds: string[]) => {
    const namespace = getFeatureTimelineNamespace(source);
    ingestTimeline({ key: buildTimelineRecordKey(namespace), namespace, postIds, insertMode: 'append' });
  };

  userList(FIXTURE_IDS.users.nasa, FIXTURE_IDS.nasaHandle, lists.nasaPosts);
  // Home: For You and Following exist; Following · Popular is intentionally empty.
  globalList('home-timeline', lists.homeForYou);
  globalList('home-latest-timeline', lists.homeFollowing);
  globalList('bookmarks', lists.bookmarks);

  const searchNamespace = getFeatureTimelineNamespace('search-latest');
  ingestTimeline({
    key: buildTimelineRecordKey(searchNamespace, FIXTURE_IDS.searchQuery), namespace: searchNamespace,
    postIds: lists.searchLatest, aliases: [FIXTURE_IDS.searchQuery], insertMode: 'append',
  });
}

export function seedCaptures(): void {
  captures.value = fixtureCaptures();
  isCapturing.value = true;
}
