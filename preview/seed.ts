/** Feeds the fixtures into the real stores, the way the XHR interceptor does. */
import { MediaSchema, PostSchema, UserSchema } from '../src/archive/model';
import { runDbBatch, upsertMedia, upsertPost, upsertUser } from '../src/lib/db-service';
import { getFeatureTimelineNamespace } from '../src/lib/feature-timeline';
import { buildTimelineRecordKey, getTimelinePagesByAlias, getTimelinePostIdsByAlias, ingestTimeline } from '../src/lib/timeline-store';
import { captures, isCapturing } from '../src/lib/xhr-capture-service';
import {
  FIXTURE_CLOCK, FIXTURE_IDS, fixtureCaptures, fixtureHomePages, fixtureMedia, fixturePosts, fixtureTimelines, fixtureUsers, makeFeedPost,
  type HomePageFixture,
} from './fixtures';

export type HomeList = HomePageFixture['list'];
const HOME_SOURCES = { forYou: 'home-timeline', following: 'home-latest-timeline' } as const;
const CURSOR_PREFIX = { forYou: 'fy', following: 'fo' } as const;
const homeNamespace = (list: HomeList): string => getFeatureTimelineNamespace(HOME_SOURCES[list]);

/** Bottom cursor of each captured page, by list and page id (the store only maps cursors to pages). */
const bottomCursors: Record<HomeList, Map<number, string>> = { forYou: new Map(), following: new Map() };

/** Ingests one home response the way the interceptor does (home endpoints prepend). Returns the new page id. */
function ingestHomeResponse(list: HomeList, response: Pick<HomePageFixture, 'cursor' | 'bottomCursor' | 'postIds'>, capturedAt: number): number | undefined {
  const namespace = homeNamespace(list);
  const before = getTimelinePagesByAlias(namespace).length;
  ingestTimeline({
    key: buildTimelineRecordKey(namespace), namespace, postIds: response.postIds, insertMode: 'prepend',
    cursor: response.cursor, bottomCursor: response.bottomCursor, capturedAt,
  });
  const pages = getTimelinePagesByAlias(namespace);
  if (pages.length === before) return undefined;
  bottomCursors[list].set(pages.length, response.bottomCursor);
  return pages.length;
}

let runtimeFeedCounter = 0;

/**
 * Preview hook: captures one more home response of `count` new synthetic posts, plus `repeats` ids already
 * on earlier pages. `older` continues the current last page (its bottom cursor); `newer` has no cursor.
 * Returns the new page id.
 */
export function addHomePage(list: HomeList, kind: 'newer' | 'older', count = 6, repeats = 0): number {
  const namespace = homeNamespace(list);
  const pages = getTimelinePagesByAlias(namespace);
  const last = pages[pages.length - 1];
  const created = Array.from({ length: Math.max(1, count) }, () => {
    const n = 200 + runtimeFeedCounter++;
    return makeFeedPost(n, `新页面帖子 #${n - 199}`, 5);
  });
  runDbBatch(() => {
    for (const { post, media } of created) {
      media.forEach(upsertMedia);
      upsertPost(post);
    }
  });

  const postIds = created.map(({ post }) => post.id);
  const earlier = [...getTimelinePostIdsByAlias(namespace)];
  const wanted = Math.min(repeats, earlier.length);
  for (let r = 0; r < wanted; r += 1) {
    const repeat = earlier[Math.floor((r * earlier.length) / wanted)];
    postIds.splice(Math.min(1 + r * 2, postIds.length), 0, repeat);
  }

  const cursor = kind === 'older' && last ? bottomCursors[list].get(last.id) : undefined;
  const bottomCursor = `${CURSOR_PREFIX[list]}-b${pages.length + 1}`;
  // Deterministic clock: seven minutes after the previous page, so screenshots do not drift.
  const capturedAt = (last?.capturedAt ?? FIXTURE_CLOCK) + 7 * 60_000;
  const pageId = ingestHomeResponse(list, { cursor, bottomCursor, postIds }, capturedAt);
  if (pageId === undefined) throw new Error('addHomePage: the response created no page');
  return pageId;
}

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
  // Home: For You and Following exist as several captured pages; Following · Popular is intentionally empty.
  for (const page of fixtureHomePages()) {
    ingestHomeResponse(page.list, page, FIXTURE_CLOCK + page.capturedAtOffsetMinutes * 60_000);
  }
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
