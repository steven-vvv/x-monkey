import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ArchiveBatch, Media, Post, User } from '../src/archive/model';
import { mergeArchiveRecord } from '../src/archive/merge';
import { getSupportedEndpoint } from '../src/lib/endpoint-support';
import { parseTimelineResponse, parseTweetDetailResponse } from '../src/lib/parser';
import { buildArchiveBatch } from '../src/lib/remote-db/adapter';
import { loadDumpFixtures } from './dump-fixtures';

/**
 * Writes a small archive batch built from real captures into tweet-db-v2's
 * projection testdata, so the Go projection is tested against what x-monkey
 * actually submits. Only public profile timelines and post details are used:
 * likes, bookmarks, home feeds and searches describe the capturing account,
 * whose own posts are left out as well.
 */
const PUBLIC_SOURCES = /^(User[A-Za-z]*|TweetDetail)$/;
const DEFAULT_OUTPUT = '../tweet-db-v2/internal/projection/testdata/x-monkey-batch.json';

const fixtures = loadDumpFixtures();
/** Likes are private, so a captured Likes request names the capturing account. */
const viewerIds = new Set(fixtures
  .filter((fixture) => fixture.operationName === 'Likes')
  .map((fixture) => fixture.variables?.userId)
  .filter((id): id is string => typeof id === 'string'));

const posts = new Map<string, Post>();
const users = new Map<string, User>();
const media = new Map<string, Media>();

function addAll<T extends { id: string }>(target: Map<string, T>, source: Map<string, T>): void {
  for (const [id, record] of source) {
    const existing = target.get(id);
    if (existing) mergeArchiveRecord(existing as Record<string, unknown>, record as Record<string, unknown>);
    else target.set(id, structuredClone(record));
  }
}

for (const fixture of fixtures) {
  const endpoint = getSupportedEndpoint(fixture.operationName);
  if (!endpoint || !PUBLIC_SOURCES.test(fixture.operationName) || fixture.operationName === 'Likes') continue;
  const parsed = endpoint.kind === 'tweet-detail' ? parseTweetDetailResponse(fixture.response) : parseTimelineResponse(fixture.response);
  addAll(posts, parsed.posts);
  addAll(users, parsed.users);
  addAll(media, parsed.media);
}

const mediaOf = (post: Post) => (post.mediaIds ?? []).map((id) => media.get(id)).filter((item): item is Media => !!item);

/** One post per feature the projection handles, picked deterministically. */
const FEATURES: Array<[string, (post: Post) => boolean]> = [
  ['long post with styles', (post) => !!post.text?.styles],
  ['reply with hidden mention prefix', (post) => !!post.replyTo && (post.text?.visible?.[0] ?? 0) > 0],
  ['link card', (post) => post.card?.type === 'summary_large_image' && !!post.card.image],
  ['player card', (post) => post.card?.type === 'player'],
  ['finished poll', (post) => post.card?.poll?.final === true],
  ['open poll', (post) => post.card?.poll?.final === false],
  ['full article', (post) => !!post.article?.blocks],
  ['article preview', (post) => !!post.article && !post.article.blocks],
  ['repost', (post) => !!post.repostOf && posts.has(post.repostOf)],
  ['quote', (post) => !!post.quote && posts.has(post.quote.postId)],
  ['video', (post) => mediaOf(post).some((item) => item.type === 'video')],
  ['several photos', (post) => mediaOf(post).filter((item) => item.type === 'photo').length > 1],
  ['video timestamps', (post) => !!post.text?.entities?.some((entity) => entity.type === 'timestamp')],
  ['hashtag', (post) => !!post.text?.entities?.some((entity) => entity.type === 'hashtag')],
  ['asset tag', (post) => !!post.text?.entities?.some((entity) => entity.type === 'cashtag' && entity.ticker)],
  ['community note', (post) => !!post.communityNote],
  ['edited', (post) => !!post.editIds],
  ['ai disclosure', (post) => !!post.aiGenerated],
  ['place', (post) => !!post.place],
];

const output = resolve(process.cwd(), process.argv[2] ?? DEFAULT_OUTPUT);
// Posts of the current sample are kept while they still show their feature, so new captures only add to it.
const current = new Set<string>(existsSync(output)
  ? (JSON.parse(readFileSync(output, 'utf8')) as ArchiveBatch).posts.map((post) => post.id)
  : []);

const ordered = [...posts.values()]
  .filter((post) => !viewerIds.has(post.authorId))
  .sort((left, right) => left.id.localeCompare(right.id));
const picked: string[] = [];
for (const [feature, matches] of FEATURES) {
  const post = ordered.find((item) => current.has(item.id) && matches(item)) ?? ordered.find(matches);
  if (!post) {
    console.log(`- ${feature}: no sample`);
    continue;
  }
  picked.push(post.id);
  console.log(`- ${feature}: ${post.id}`);
}

const { batch } = buildArchiveBatch([...new Set(picked)], {
  getPost: (id) => posts.get(id),
  getUser: (id) => users.get(id),
  getMedia: (id) => media.get(id),
});

if (batch.users.some((user) => viewerIds.has(user.id))) {
  throw new Error('the sample would include the capturing account through a quoted or reposted post');
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(batch, null, 1)}\n`);
console.log(`wrote ${batch.posts.length} posts, ${batch.users.length} users, ${batch.media.length} media to ${output}`);
