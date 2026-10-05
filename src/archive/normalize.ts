import { mergeArchiveRecord } from './merge';
import {
  ArticleSchema,
  CardSchema,
  MediaSchema,
  PostSchema,
  UserSchema,
  type Article,
  type ArticleBlock,
  type Card,
  type Entity,
  type Instant,
  type Media,
  type Place,
  type Poll,
  type Post,
  type Range,
  type Rect,
  type RichText,
  type TextStyle,
  type User,
} from './model';
import { codePointLength, isValidRange, sliceCodePoints, unescapeXText } from './text';

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asCount(value: unknown): number | undefined {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : asNumber(value);
  return number !== undefined && Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : undefined;
}

function read(value: unknown, ...path: string[]): unknown {
  let current = value;
  for (const key of path) {
    const object = asObject(current);
    if (!object) return undefined;
    current = object[key];
  }
  return current;
}

/** Drops `undefined` fields and empty containers so absent data stays absent. */
function compact<T extends Json>(value: T): T | undefined {
  const result: Json = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    if (Array.isArray(entry) && entry.length === 0) continue;
    if (asObject(entry) && Object.keys(entry as Json).length === 0) continue;
    result[key] = entry;
  }
  return Object.keys(result).length > 0 ? result as T : undefined;
}

function nonEmpty<T>(values: T[]): T[] | undefined {
  return values.length > 0 ? values : undefined;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const X_DATE = /^\w{3} (\w{3}) (\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2}) (\d{4})$/;

function formatInstant(milliseconds: number): Instant | undefined {
  if (!Number.isFinite(milliseconds)) return undefined;
  return new Date(milliseconds).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Parses X's `Mon Oct 05 05:10:30 +0000 2026`, ISO strings and epoch seconds. */
function toInstant(value: unknown): Instant | undefined {
  if (typeof value === 'number') return formatInstant(value * 1000);
  const text = asText(value)?.trim();
  if (!text) return undefined;

  const match = X_DATE.exec(text);
  if (match) {
    const [, month, day, hours, minutes, seconds, sign, offsetHours, offsetMinutes, year] = match;
    const monthIndex = MONTHS.indexOf(month);
    if (monthIndex < 0) return undefined;
    const offset = (sign === '-' ? -1 : 1) * (Number(offsetHours) * 60 + Number(offsetMinutes));
    return formatInstant(
      Date.UTC(Number(year), monthIndex, Number(day), Number(hours), Number(minutes), Number(seconds)) - offset * 60_000,
    );
  }

  return formatInstant(Date.parse(text));
}

function toRect(value: unknown): Rect | undefined {
  const rect = [read(value, 'x'), read(value, 'y'), read(value, 'w'), read(value, 'h')].map(asCount);
  return rect.every((part) => part !== undefined) ? rect as Rect : undefined;
}

function toRects(values: unknown): Rect[] | undefined {
  return nonEmpty(asArray(values).map(toRect).filter((rect): rect is Rect => rect !== undefined));
}

function stripSourceHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = />([^<]*)</.exec(html);
  return asText((match ? match[1] : html).trim());
}

/** Accumulates archive records from one or more X responses. */
export class ArchiveCollector {
  readonly users = new Map<string, User>();
  readonly posts = new Map<string, Post>();
  readonly media = new Map<string, Media>();
  readonly warnings: string[] = [];

  warn(path: string, message: string): void {
    this.warnings.push(`${path}: ${message}`);
  }

  private add<T extends { id: string }>(
    map: Map<string, T>,
    schema: { safeParse(value: unknown): { success: true; data: unknown } | { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } },
    candidate: T,
    path: string,
  ): boolean {
    const result = schema.safeParse(candidate);
    if (!result.success) {
      const issue = result.error.issues[0];
      this.warn(path, `invalid record: ${issue?.message ?? 'unknown'} at ${issue?.path.join('.') || '(root)'}`);
      return false;
    }

    const existing = map.get(candidate.id);
    if (existing) mergeArchiveRecord(existing as Json, candidate as Json);
    else map.set(candidate.id, candidate);
    return true;
  }

  addUser(user: User, path: string): boolean {
    return this.add(this.users, UserSchema, user, path);
  }

  addPost(post: Post, path: string): boolean {
    return this.add(this.posts, PostSchema, post, path);
  }

  addMedia(media: Media, path: string): boolean {
    return this.add(this.media, MediaSchema, media, path);
  }
}

// --- Text ---

interface SourceEntities {
  hashtags?: unknown;
  smarttags?: unknown;
  symbols?: unknown;
  urls?: unknown;
  user_mentions?: unknown;
  media?: unknown;
  timestamps?: unknown;
}

function toRange(indices: unknown, mapOffset: (offset: number) => number, length: number): Range | undefined {
  const [start, end] = asArray(indices).map(asCount);
  if (start === undefined || end === undefined) return undefined;
  const range: Range = [mapOffset(start), mapOffset(end)];
  return isValidRange(range, length) ? range : undefined;
}

function collectEntities(source: SourceEntities | undefined, mapOffset: (offset: number) => number, length: number): Entity[] {
  if (!source) return [];
  const entities: Entity[] = [];
  const seen = new Set<string>();
  const push = (entity: Entity | undefined) => {
    if (!entity) return;
    const key = `${entity.type}:${entity.range.join(',')}`;
    if (seen.has(key)) return;
    seen.add(key);
    entities.push(entity);
  };

  for (const item of [...asArray(source.urls), ...asArray(source.media)]) {
    const range = toRange(read(item, 'indices'), mapOffset, length);
    const expanded = asText(read(item, 'expanded_url'));
    if (range && expanded) push({ type: 'url', range, expanded });
  }
  for (const item of asArray(source.user_mentions)) {
    const range = toRange(read(item, 'indices'), mapOffset, length);
    const userId = asId(read(item, 'id_str'));
    if (range && userId) push({ type: 'mention', range, userId });
  }
  for (const item of asArray(source.hashtags)) {
    const range = toRange(read(item, 'indices'), mapOffset, length);
    if (range) push({ type: 'hashtag', range });
  }
  for (const item of asArray(source.symbols)) {
    const range = toRange(read(item, 'indices'), mapOffset, length);
    if (range) push(compact({ type: 'cashtag', range, name: asText(read(item, 'tag', 'info', 'info', 'name')) }) as Entity);
  }
  // Smart tags (seen since 2026-10) mark an asset identifier such as `bitcoin:native`,
  // which X shows as `$BTC`. Without a ticker the text is shown as written.
  for (const item of asArray(source.smarttags)) {
    const range = toRange(read(item, 'indices'), mapOffset, length);
    const ticker = asText(read(item, 'tag', 'info', 'info', 'ticker'));
    if (range && ticker) push(compact({ type: 'cashtag', range, name: asText(read(item, 'tag', 'info', 'info', 'name')), ticker }) as Entity);
  }
  for (const item of asArray(source.timestamps)) {
    const range = toRange(read(item, 'indices'), mapOffset, length);
    if (range) push({ type: 'timestamp', range });
  }

  return entities.sort((left, right) => left.range[0] - right.range[0] || left.range[1] - right.range[1]);
}

function collectStyles(richtext: unknown, offset: number, length: number): TextStyle[] {
  const styles: TextStyle[] = [];
  for (const tag of asArray(read(richtext, 'richtext_tags'))) {
    const from = asCount(read(tag, 'from_index'));
    const to = asCount(read(tag, 'to_index'));
    const names = asArray(read(tag, 'richtext_types')).map(asText).filter((name): name is string => !!name);
    if (from === undefined || to === undefined || names.length === 0) continue;
    const range: Range = [from + offset, to + offset];
    if (isValidRange(range, length)) styles.push({ range, styles: names });
  }
  return styles;
}

function toRichText(text: string, entities: Entity[], visible?: Range, styles: TextStyle[] = []): RichText {
  const length = codePointLength(text);
  return compact({
    text,
    visible: visible && !(visible[0] === 0 && visible[1] === length) ? visible : undefined,
    entities: nonEmpty(entities),
    styles: nonEmpty(styles),
  }) ?? { text };
}

/**
 * Builds the post text. Long posts use the full `note_tweet` text, prefixed
 * with the reply mentions X keeps only in `legacy.full_text`.
 */
function buildPostText(data: Json): RichText | undefined {
  const legacy = asObject(data.legacy);
  const fullText = asString(legacy?.full_text);
  if (fullText === undefined) return undefined;

  const unescaped = unescapeXText(fullText);
  const length = codePointLength(unescaped.text);
  const legacyEntities = collectEntities(asObject(legacy?.entities) as SourceEntities, unescaped.mapOffset, length);
  const visible = toRange(legacy?.display_text_range, unescaped.mapOffset, length);

  const note = asObject(read(data, 'note_tweet', 'note_tweet_results', 'result'));
  const noteText = asString(note?.text);
  if (noteText === undefined) return toRichText(unescaped.text, legacyEntities, visible);

  const prefixLength = visible?.[0] ?? 0;
  const prefix = Array.from(unescaped.text).slice(0, prefixLength).join('');
  const text = prefix + noteText;
  const textLength = prefixLength + codePointLength(noteText);
  const shift = (offset: number) => offset + prefixLength;
  const entities = [
    ...legacyEntities.filter((entity) => entity.range[1] <= prefixLength),
    ...collectEntities(asObject(note?.entity_set) as SourceEntities, shift, textLength),
  ];
  return toRichText(text, entities, prefixLength > 0 ? [prefixLength, textLength] : undefined, collectStyles(note?.richtext, prefixLength, textLength));
}

/** Converts a `TimelineRichText` (community notes, labels) into rich text. */
function timelineTextToRichText(value: unknown): RichText | undefined {
  const text = asString(read(value, 'text'));
  if (text === undefined) return undefined;
  const length = codePointLength(text);
  const entities: Entity[] = [];
  for (const entity of asArray(read(value, 'entities'))) {
    const range: Range = [asCount(read(entity, 'fromIndex')) ?? -1, asCount(read(entity, 'toIndex')) ?? -1];
    // Note links carry the destination next to the t.co link; the text shows a shortened form.
    const url = asText(read(entity, 'ref', 'expandedUrl')) ?? asText(read(entity, 'ref', 'url'));
    const userId = asId(read(entity, 'ref', 'mention_results', 'result', 'rest_id'));
    if (range[0] < 0 || !isValidRange(range, length)) continue;
    if (userId) entities.push({ type: 'mention', range, userId });
    else if (url) entities.push({ type: 'url', range, expanded: url });
  }
  return toRichText(text, entities);
}

// --- Users ---

function normalizeAffiliation(user: Json): User['affiliation'] {
  const label = asObject(read(user, 'affiliates_highlighted_label', 'label'));
  const name = asText(label?.description);
  if (!label || !name) return undefined;

  const ownerId = asArray(read(label, 'longDescription', 'entities'))
    .map((entity) => asId(read(entity, 'ref', 'mention_results', 'result', 'rest_id')))
    .find(Boolean);

  return compact({
    name,
    url: asText(read(label, 'url', 'url')),
    badgeUrl: asText(read(label, 'badge', 'url')),
    kind: asText(label.userLabelType),
    ownerId,
  });
}

/**
 * Normalizes a `User` node. Since 2026-10 X omits `legacy` and serves its
 * fields from dedicated objects; `legacy` remains the fallback.
 */
export function collectUser(input: unknown, path: string, collector: ArchiveCollector): string | undefined {
  const node = asObject(read(input, 'result')) ?? asObject(input);
  if (!node) return undefined;

  const id = asId(node.rest_id);
  const legacy = asObject(node.legacy);
  const handle = asText(read(node, 'core', 'screen_name')) ?? asText(legacy?.screen_name);
  const name = asString(read(node, 'core', 'name')) ?? asString(legacy?.name);
  if (!id || !handle || name === undefined) {
    collector.warn(path, 'user without id, handle or name');
    return undefined;
  }

  const profileBio = asObject(node.profile_bio);
  const bioSource = profileBio?.description !== undefined
    ? { text: asString(profileBio.description) ?? '', entities: asObject(profileBio.entities) }
    : { text: unescapeXText(asString(legacy?.description) ?? '').text, entities: asObject(legacy?.entities) };
  const bioLength = codePointLength(bioSource.text);
  const bio = asText(bioSource.text)
    ? toRichText(bioSource.text, collectEntities({ urls: read(bioSource.entities, 'description', 'urls') }, (offset) => offset, bioLength))
    : undefined;

  const parody = asText(node.parody_commentary_fan_label);
  const user: User = {
    id,
    handle,
    name,
    ...compact({
      createdAt: toInstant(read(node, 'core', 'created_at') ?? legacy?.created_at),
      avatarUrl: asText(read(node, 'avatar', 'image_url')) ?? asText(legacy?.profile_image_url_https),
      avatarShape: asText(node.profile_image_shape),
      bannerUrl: asText(read(node, 'banner', 'image_url')) ?? asText(legacy?.profile_banner_url),
      bio,
      location: asText(read(node, 'location', 'location')) ?? asText(legacy?.location),
      website: asText(read(asArray(read(bioSource.entities, 'url', 'urls'))[0], 'expanded_url')),
      pinnedPostIds: nonEmpty(asArray(read(node, 'pinned_items', 'tweet_ids_str') ?? legacy?.pinned_tweet_ids_str)
        .map(asId).filter((value): value is string => !!value)),
      protected: asBoolean(read(node, 'privacy', 'protected')) ?? asBoolean(legacy?.protected),
      sensitive: asBoolean(node.possibly_sensitive) ?? asBoolean(legacy?.possibly_sensitive),
      interstitial: asText(read(node, 'profile_metadata', 'profile_interstitial_type')) ?? asText(legacy?.profile_interstitial_type),
      verified: compact({
        blue: asBoolean(node.is_blue_verified),
        type: asText(read(node, 'verification', 'verified_type')),
      }),
      affiliation: normalizeAffiliation(node),
      parody: parody && parody !== 'None' ? parody : undefined,
      professional: compact({
        type: asText(read(node, 'professional', 'professional_type')),
        categories: nonEmpty(asArray(read(node, 'professional', 'category')).map((item) => asText(read(item, 'name'))).filter((value): value is string => !!value)),
      }),
      counts: compact({
        followers: asCount(read(node, 'relationship_counts', 'followers')) ?? asCount(legacy?.followers_count),
        following: asCount(read(node, 'relationship_counts', 'following')) ?? asCount(legacy?.friends_count),
        posts: asCount(read(node, 'tweet_counts', 'tweets')) ?? asCount(legacy?.statuses_count),
        mediaPosts: asCount(read(node, 'tweet_counts', 'media_tweets')) ?? asCount(legacy?.media_count),
        likes: asCount(read(node, 'action_counts', 'favorites_count')) ?? asCount(legacy?.favourites_count),
      }),
    }),
  };

  return collector.addUser(user, path) ? id : undefined;
}

// --- Media ---

const MEDIA_TYPES: Record<string, Media['type']> = { photo: 'photo', video: 'video', animated_gif: 'gif' };

function collectMedia(input: unknown, path: string, collector: ArchiveCollector): string | undefined {
  const item = asObject(input);
  const id = asId(item?.id_str);
  const type = MEDIA_TYPES[asString(item?.type) ?? ''];
  const url = asText(item?.media_url_https);
  if (!item || !id || !type || !url) {
    collector.warn(path, 'media without id, supported type or url');
    return undefined;
  }

  const sourceUserPath = read(item, 'source_user_results', 'result') !== undefined
    ? ['source_user_results', 'result']
    : ['additional_media_info', 'source_user', 'user_results', 'result'];
  const sourceUser = read(item, ...sourceUserPath);
  if (sourceUser !== undefined) collectUser(sourceUser, `${path}.${sourceUserPath.join('.')}`, collector);

  const availability = asText(read(item, 'ext_media_availability', 'status'));
  const media: Media = {
    id,
    type,
    url,
    ...compact({
      width: asCount(read(item, 'original_info', 'width')),
      height: asCount(read(item, 'original_info', 'height')),
      alt: asText(item.ext_alt_text),
      crops: toRects(read(item, 'original_info', 'focus_rects')),
      faces: toRects(read(item, 'features', 'orig', 'faces')),
      tags: nonEmpty(asArray(read(item, 'features', 'all', 'tags')).flatMap((tag) => {
        const userId = asId(read(tag, 'user_id'));
        return userId ? [compact({ userId, handle: asText(read(tag, 'screen_name')) })!] : [];
      })) as Media['tags'],
      video: compact({
        durationMs: asCount(read(item, 'video_info', 'duration_millis')),
        variants: nonEmpty(asArray(read(item, 'video_info', 'variants')).flatMap((variant) => {
          const variantUrl = asText(read(variant, 'url'));
          const variantType = asText(read(variant, 'content_type'));
          return variantUrl && variantType
            ? [compact({ url: variantUrl, type: variantType, bitrate: asCount(read(variant, 'bitrate')) })!]
            : [];
        })),
      }) as Media['video'],
      sourcePostId: asId(item.source_status_id_str),
      sourceUserId: asId(item.source_user_id_str),
      sensitive: nonEmpty(Object.entries(asObject(item.sensitive_media_warning) ?? {})
        .filter(([, flagged]) => flagged === true)
        .map(([name]) => name)
        .sort()),
      unavailable: availability && availability !== 'Available' ? availability : undefined,
      title: asText(read(item, 'additional_media_info', 'title')),
      description: asText(read(item, 'additional_media_info', 'description')),
      link: asText(read(item, 'additional_media_info', 'call_to_actions', 'visit_site', 'url')),
    }),
  };
  if (media.video && !media.video.variants) delete media.video;

  return collector.addMedia(media, path) ? id : undefined;
}

/** Article images arrive as `ApiImage` references rather than tweet media; other kinds are not seen yet. */
function collectArticleMedia(input: unknown, path: string, collector: ArchiveCollector): string | undefined {
  const id = asId(read(input, 'media_id'));
  const info = asObject(read(input, 'media_info'));
  const url = asText(info?.original_img_url);
  if (!id || !url || info?.__typename !== 'ApiImage') return undefined;
  const media: Media = {
    id,
    type: 'photo',
    url,
    ...compact({ width: asCount(info?.original_img_width), height: asCount(info?.original_img_height) }),
  };
  return collector.addMedia(media, path) ? id : undefined;
}

// --- Cards ---

type BindingValue = { type: 'string'; value: string } | { type: 'boolean'; value: boolean }
  | { type: 'image'; url: string; width?: number; height?: number; alt?: string }
  | { type: 'user'; id: string } | { type: 'other' };

function readBinding(value: unknown): BindingValue {
  const kind = asString(read(value, 'type'));
  if (kind === 'STRING' && asString(read(value, 'string_value')) !== undefined) {
    return { type: 'string', value: asString(read(value, 'string_value'))! };
  }
  if (kind === 'BOOLEAN' && asBoolean(read(value, 'boolean_value')) !== undefined) {
    return { type: 'boolean', value: asBoolean(read(value, 'boolean_value'))! };
  }
  if (kind === 'IMAGE' && asText(read(value, 'image_value', 'url'))) {
    return {
      type: 'image',
      url: asText(read(value, 'image_value', 'url'))!,
      width: asCount(read(value, 'image_value', 'width')),
      height: asCount(read(value, 'image_value', 'height')),
      alt: asText(read(value, 'image_value', 'alt')),
    };
  }
  if (kind === 'USER' && asId(read(value, 'user_value', 'id_str'))) {
    return { type: 'user', id: asId(read(value, 'user_value', 'id_str'))! };
  }
  return { type: 'other' };
}

/** Preferred card image groups; every group repeats one picture at several sizes. */
const CARD_IMAGE_PREFERENCE = ['photo_image_full_size', 'summary_photo_image', 'player_image', 'thumbnail_image'];
const CARD_IMAGE_SUFFIX = /_(original|x_large|large|small|color|alt_text)$/;
/** Modelled bindings, plus two that are never kept: the `card_url` placeholder and the viewer's own poll vote. */
const CARD_CONSUMED_KEYS = new Set(['title', 'description', 'domain', 'vanity_url', 'card_url', 'site', 'creator', 'player_url', 'player_width', 'player_height', 'selected_choice']);
/** Poll templates parsed into `Card.poll`; other poll templates have not been captured. */
const POLL_CARD_TYPES = new Set(['poll4choice_text_only']);
/** Poll bindings without content: the vote endpoint and the duration (end time minus post time). */
const POLL_DROPPED_KEYS = ['api', 'duration_minutes'];

type CardImage = Extract<BindingValue, { type: 'image' }>;

/** Keeps the original rendition of each image group, keyed by group name. */
function collectCardImages(bindings: Map<string, BindingValue>): Map<string, CardImage> {
  const groups = new Map<string, CardImage>();
  for (const [key, binding] of bindings) {
    if (binding.type !== 'image') continue;
    const group = key.replace(CARD_IMAGE_SUFFIX, '');
    if (!groups.has(group) || key.endsWith('_original')) groups.set(group, binding);
  }
  return groups;
}

function imageBase(url: string): string {
  return url.split('?')[0];
}

/** Reads a poll and reports the bindings it covers; needs at least two labelled choices. */
function collectPoll(bindings: Map<string, BindingValue>): { poll: Poll; keys: Set<string> } | undefined {
  const text = (key: string) => {
    const binding = bindings.get(key);
    return binding?.type === 'string' ? binding.value : undefined;
  };
  const keys = new Set(['end_datetime_utc', 'last_updated_datetime_utc', 'counts_are_final', ...POLL_DROPPED_KEYS]);
  const choices: Poll['choices'] = [];
  for (let index = 1; asText(text(`choice${index}_label`)) !== undefined; index += 1) {
    choices.push(compact({ label: text(`choice${index}_label`)!, count: asCount(text(`choice${index}_count`)) })!);
    keys.add(`choice${index}_label`).add(`choice${index}_count`);
  }
  if (choices.length < 2) return undefined;

  const final = bindings.get('counts_are_final');
  return {
    poll: {
      choices,
      ...compact({
        endsAt: toInstant(text('end_datetime_utc')),
        final: final?.type === 'boolean' ? final.value : undefined,
        updatedAt: toInstant(text('last_updated_datetime_utc')),
      }),
    },
    keys,
  };
}

function collectCard(input: unknown, path: string, collector: ArchiveCollector): Card | undefined {
  const legacy = asObject(read(input, 'legacy'));
  const type = asText(legacy?.name);
  const url = asText(legacy?.url) ?? asText(read(input, 'rest_id'));
  // Unexpanded cards carry only the t.co link that the text entity already has.
  if (!legacy || !type || !url) return undefined;

  for (const [index, ref] of asArray(legacy.user_refs_results).entries()) {
    collectUser(ref, `${path}.legacy.user_refs_results[${index}]`, collector);
  }

  const bindings = new Map<string, BindingValue>();
  for (const binding of asArray(legacy.binding_values)) {
    const key = asString(read(binding, 'key'));
    if (key) bindings.set(key, readBinding(read(binding, 'value')));
  }
  const text = (key: string) => {
    const binding = bindings.get(key);
    return binding?.type === 'string' ? asText(binding.value) : undefined;
  };
  const userId = (key: string) => {
    const binding = bindings.get(key);
    return binding?.type === 'user' ? binding.id : undefined;
  };

  const images = collectCardImages(bindings);
  const imageGroup = CARD_IMAGE_PREFERENCE.find((group) => images.has(group)) ?? images.keys().next().value;
  const imageBinding = imageGroup ? images.get(imageGroup) : undefined;
  const image = imageBinding
    ? compact({ url: imageBinding.url, width: imageBinding.width, height: imageBinding.height, alt: text(`${imageGroup}_alt_text`) ?? imageBinding.alt })
    : undefined;

  const playerUrl = text('player_url');
  const domain = text('domain') ?? text('vanity_url');
  const poll = POLL_CARD_TYPES.has(type) ? collectPoll(bindings) : undefined;
  const extra: Record<string, string | boolean> = {};
  for (const [key, binding] of bindings) {
    if (CARD_CONSUMED_KEYS.has(key) || poll?.keys.has(key)) continue;
    // Renditions, colors and alt texts belong to an image group handled below.
    if (images.has(key.replace(CARD_IMAGE_SUFFIX, ''))) continue;
    if (binding.type === 'string' || binding.type === 'boolean') extra[key] = binding.value;
    else if (binding.type === 'user') extra[key] = binding.id;
  }
  for (const [group, binding] of images) {
    if (group === imageGroup || (imageBinding && imageBase(binding.url) === imageBase(imageBinding.url))) continue;
    extra[group] = binding.url;
    const alt = text(`${group}_alt_text`);
    if (alt) extra[`${group}_alt_text`] = alt;
  }
  if (text('vanity_url') && text('vanity_url') !== domain) extra.vanity_url = text('vanity_url')!;

  return {
    type,
    url,
    ...compact({
      title: text('title'),
      description: text('description'),
      domain,
      image,
      siteUserId: userId('site'),
      creatorUserId: userId('creator'),
      player: playerUrl ? compact({ url: playerUrl, width: asCount(text('player_width')), height: asCount(text('player_height')) }) : undefined,
      poll: poll?.poll,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    }),
  } as Card;
}

// --- Articles ---

function collectArticle(input: unknown, path: string, collector: ArchiveCollector): Article | undefined {
  const result = asObject(read(input, 'article_results', 'result'));
  const id = asId(result?.rest_id);
  const title = asString(result?.title);
  if (!result || !id || title === undefined) return undefined;

  const entityKeys = new Map<string, number>();
  const entities: NonNullable<Article['entities']> = [];
  for (const item of asArray(read(result, 'content_state', 'entityMap'))) {
    const key = asString(read(item, 'key'));
    const type = asText(read(item, 'value', 'type'));
    if (key === undefined || !type) continue;
    // `entityKey` is an editor-internal UUID with no meaning outside Draft.js.
    const { entityKey: _entityKey, ...data } = asObject(read(item, 'value', 'data')) ?? {};
    entityKeys.set(key, entities.length);
    entities.push({ type, data });
  }

  const blocks: ArticleBlock[] = asArray(read(result, 'content_state', 'blocks')).flatMap((block) => {
    const type = asText(read(block, 'type'));
    const text = asString(read(block, 'text'));
    if (!type || text === undefined) return [];
    const styles = asArray(read(block, 'inlineStyleRanges')).flatMap((span) => {
      const offset = asCount(read(span, 'offset'));
      const length = asCount(read(span, 'length'));
      const style = asText(read(span, 'style'));
      return offset !== undefined && length !== undefined && style ? [[offset, length, style] as [number, number, string]] : [];
    });
    const spans = asArray(read(block, 'entityRanges')).flatMap((span) => {
      const offset = asCount(read(span, 'offset'));
      const length = asCount(read(span, 'length'));
      const key = entityKeys.get(String(read(span, 'key')));
      return offset !== undefined && length !== undefined && key !== undefined ? [[offset, length, key] as [number, number, number]] : [];
    });
    const data = asObject(read(block, 'data'));
    return [{
      type,
      text,
      ...compact({
        styles: nonEmpty(styles),
        entities: nonEmpty(spans),
        data: data && Object.keys(data).length > 0 ? data : undefined,
      }),
    }];
  });

  const cover = read(result, 'cover_media');
  const coverMediaId = cover !== undefined ? collectArticleMedia(cover, `${path}.cover_media`, collector) : undefined;
  const mediaIds = asArray(result.media_entities)
    .map((item, index) => collectArticleMedia(item, `${path}.media_entities[${index}]`, collector))
    .filter((value): value is string => !!value);

  const article = {
    id,
    title,
    ...compact({
      preview: asText(result.preview_text),
      coverMediaId,
      publishedAt: toInstant(read(result, 'metadata', 'first_published_at_secs')),
      modifiedAt: toInstant(read(result, 'lifecycle_state', 'modified_at_secs')),
      blocks: nonEmpty(blocks),
      entities: nonEmpty(entities),
      mediaIds: nonEmpty(mediaIds),
    }),
  };
  const parsed = ArticleSchema.safeParse(article);
  if (!parsed.success) {
    collector.warn(path, `invalid article: ${parsed.error.issues[0]?.message}`);
    return undefined;
  }
  return article;
}

// --- Posts ---

function normalizePlace(input: unknown): Place | undefined {
  const place = asObject(input);
  const id = asText(place?.id);
  if (!place || !id) return undefined;

  const points = asArray(asArray(read(place, 'bounding_box', 'coordinates'))[0])
    .map((point) => asArray(point).map(asNumber))
    .filter((point): point is [number, number] => point.length >= 2 && point[0] !== undefined && point[1] !== undefined);
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);

  return {
    id,
    ...compact({
      name: asText(place.name),
      fullName: asText(place.full_name),
      country: asText(place.country),
      countryCode: asText(place.country_code),
      type: asText(place.place_type),
      bbox: points.length > 0
        ? [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)] as Place['bbox']
        : undefined,
    }),
  };
}

function unwrapTweetResult(input: unknown): Json | undefined {
  const node = asObject(input);
  if (!node) return undefined;
  if (node.__typename === 'TweetWithVisibilityResults') return asObject(node.tweet);
  if (node.__typename === 'TweetTombstone') return undefined;
  return node;
}

/**
 * Collects a `tweet_results.result` node with its author, media and the posts
 * it references. Returns the post id, or `undefined` for tombstones.
 */
export function collectTweet(
  input: unknown,
  path: string,
  collector: ArchiveCollector,
  stack: Set<string> = new Set(),
): string | undefined {
  const data = unwrapTweetResult(input);
  const dataPath = asObject(input)?.__typename === 'TweetWithVisibilityResults' ? `${path}.tweet` : path;
  const id = asId(data?.rest_id);
  if (!data || !id) {
    if (data) collector.warn(path, 'tweet without rest_id');
    return undefined;
  }
  if (stack.has(id)) return id;

  const legacy = asObject(data.legacy);
  const authorId = collectUser(read(data, 'core', 'user_results', 'result'), `${dataPath}.core.user_results.result`, collector)
    ?? asId(legacy?.user_id_str);
  const createdAt = toInstant(legacy?.created_at);
  if (!legacy || !authorId || !createdAt) {
    collector.warn(dataPath, 'tweet without legacy, author or created_at');
    return undefined;
  }

  stack.add(id);
  try {
    const repostResult = read(legacy, 'retweeted_status_result', 'result');
    const repostOf = repostResult !== undefined
      ? collectTweet(repostResult, `${dataPath}.legacy.retweeted_status_result.result`, collector, stack)
      : undefined;
    if (repostOf) {
      return collector.addPost({ id, authorId, createdAt, repostOf }, dataPath) ? id : undefined;
    }

    // A quoted tweet carries its own quote in `nested_quoted_tweet_results` (seen since 2026-10).
    const quoteKey = read(data, 'quoted_status_result', 'result') !== undefined ? 'quoted_status_result' : 'nested_quoted_tweet_results';
    const quoteResult = read(data, quoteKey, 'result');
    const quotedId = (quoteResult !== undefined
      ? collectTweet(quoteResult, `${dataPath}.${quoteKey}.result`, collector, stack)
      : undefined)
      ?? asId(legacy.quoted_status_id_str)
      ?? asId(read(data, 'quotedRefResult', 'result', 'rest_id'));

    const mediaSource = asArray(read(legacy, 'extended_entities', 'media')).length > 0
      ? 'extended_entities'
      : 'entities';
    const mediaIds = [...new Set(asArray(read(legacy, mediaSource, 'media'))
      .map((item, index) => collectMedia(item, `${dataPath}.legacy.${mediaSource}.media[${index}]`, collector))
      .filter((value): value is string => !!value))];

    const replyToPostId = asId(legacy.in_reply_to_status_id_str);
    const conversationId = asId(legacy.conversation_id_str);
    const editIds = asArray(read(data, 'edit_control', 'edit_control_initial', 'edit_tweet_ids') ?? read(data, 'edit_control', 'edit_tweet_ids'))
      .map(asId)
      .filter((value): value is string => !!value);
    const note = asObject(data.birdwatch_pivot);
    const noteText = timelineTextToRichText(note?.subtitle);
    const aiDisclosure = asObject(read(data, 'content_disclosure', 'ai_generated_disclosure'));
    const aiMedia = asBoolean(aiDisclosure?.has_ai_generated_media);
    const aiSource = asText(aiDisclosure?.ai_generated_detection_source);

    const post: Post = {
      id,
      authorId,
      createdAt,
      ...compact({
        conversationId: conversationId && conversationId !== id ? conversationId : undefined,
        replyTo: replyToPostId
          ? compact({ postId: replyToPostId, userId: asId(legacy.in_reply_to_user_id_str), handle: asText(legacy.in_reply_to_screen_name) })
          : undefined,
        quote: quotedId ? compact({ postId: quotedId, url: asText(read(legacy, 'quoted_status_permalink', 'expanded')) }) : undefined,
        text: buildPostText(data),
        lang: asText(legacy.lang),
        source: stripSourceHtml(asString(data.source)),
        mediaIds: nonEmpty(mediaIds),
        card: collectCard(data.card, `${dataPath}.card`, collector),
        article: collectArticle(data.article, `${dataPath}.article`, collector),
        place: normalizePlace(legacy.place),
        counts: compact({
          replies: asCount(legacy.reply_count),
          reposts: asCount(legacy.retweet_count),
          quotes: asCount(legacy.quote_count),
          likes: asCount(legacy.favorite_count),
          bookmarks: asCount(legacy.bookmark_count),
          views: asCount(read(data, 'views', 'count')),
        }),
        editIds: editIds.length > 1 ? editIds : undefined,
        communityNote: noteText
          ? compact({
            id: asId(read(note, 'note', 'rest_id')),
            title: asText(note?.title),
            text: noteText,
            lang: asText(read(note, 'note', 'language')),
            url: asText(note?.destinationUrl),
          })
          : undefined,
        sensitive: asBoolean(legacy.possibly_sensitive),
        replyPolicy: asText(read(legacy, 'conversation_control', 'policy')),
        paidPromotion: asBoolean(read(data, 'content_disclosure', 'advertising_disclosure', 'is_paid_promotion')),
        aiGenerated: aiMedia !== undefined && aiSource ? { media: aiMedia, source: aiSource } : undefined,
      }),
    } as Post;

    // Each attachment (a price chart under the post) repeats an asset the text tags, so it is not stored.
    const taggedAssets = new Set((post.text?.entities ?? [])
      .filter((entity) => entity.type === 'cashtag')
      .map((entity) => sliceCodePoints(post.text!.text, entity.range[0], entity.range[1]).toLowerCase()));
    for (const [index, attachment] of asArray(data.cashtag_attachments).entries()) {
      const asset = asText(read(attachment, 'rest_id'));
      if (!asset || !taggedAssets.has(asset.toLowerCase())) {
        collector.warn(`${dataPath}.cashtag_attachments[${index}]`, 'cashtag attachment is not tagged in the text');
      }
    }

    const card = post.card;
    if (card && !CardSchema.safeParse(card).success) {
      collector.warn(`${dataPath}.card`, 'invalid card dropped');
      delete post.card;
    }

    return collector.addPost(post, dataPath) ? id : undefined;
  } finally {
    stack.delete(id);
  }
}
