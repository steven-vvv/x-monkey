import type { Entity, Media, Post, RichText, User } from '../archive/model';

export interface TextSegment {
  kind: 'plain' | Entity['type'];
  text: string;
  href?: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

type StyleFlags = Pick<TextSegment, 'bold' | 'italic' | 'underline' | 'strike'>;

const STYLE_FLAGS: Record<string, keyof StyleFlags> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  underlined: 'underline',
  strike: 'strike',
  strikethrough: 'strike',
};

/** Shows a URL the way X does: without scheme, shortened when long. */
export function formatUrlForDisplay(url: string): string {
  const bare = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return bare.length > 42 ? `${bare.slice(0, 41)}…` : bare;
}

function entityHref(entity: Entity, text: string): string | undefined {
  switch (entity.type) {
    case 'url':
      return entity.expanded;
    case 'mention':
      return `https://x.com/${text.replace(/^[@＠]/, '')}`;
    case 'hashtag':
      return `https://x.com/hashtag/${encodeURIComponent(text.replace(/^[#＃]/, ''))}`;
    case 'cashtag':
      return `https://x.com/search?q=${encodeURIComponent(entity.ticker ? `$${entity.ticker} OR ${text}` : text)}`;
    default:
      return undefined;
  }
}

const SHORT_LINK = /^https?:\/\/t\.co\//;

/** What X shows for an entity: the shortened link, or `$TICKER` for a tagged asset identifier. */
function entityText(entity: Entity, text: string): string {
  // Some community note links come without their destination; the text already shows a readable form.
  if (entity.type === 'url') return SHORT_LINK.test(entity.expanded) && !SHORT_LINK.test(text) ? text : formatUrlForDisplay(entity.expanded);
  if (entity.type === 'cashtag' && entity.ticker) return `$${entity.ticker}`;
  return text;
}

/**
 * Splits the visible part of a rich text into renderable segments. All ranges
 * are code point offsets, so the text is indexed by code points as well.
 */
export function getRichTextSegments(value: RichText): TextSegment[] {
  const points = Array.from(value.text);
  const [start, end] = value.visible ?? [0, points.length];
  const flagsAt = (index: number): StyleFlags => {
    const flags: StyleFlags = { bold: false, italic: false, underline: false, strike: false };
    for (const style of value.styles ?? []) {
      if (style.range[0] > index || style.range[1] <= index) continue;
      for (const name of style.styles) {
        const flag = STYLE_FLAGS[name.toLowerCase()];
        if (flag) flags[flag] = true;
      }
    }
    return flags;
  };

  const segments: TextSegment[] = [];
  const push = (segment: TextSegment) => {
    if (!segment.text) return;
    const previous = segments[segments.length - 1];
    if (previous && previous.kind === 'plain' && segment.kind === 'plain'
      && previous.bold === segment.bold && previous.italic === segment.italic
      && previous.underline === segment.underline && previous.strike === segment.strike) {
      previous.text += segment.text;
      return;
    }
    segments.push(segment);
  };

  const entities = (value.entities ?? []).filter((entity) => entity.range[0] >= start && entity.range[1] <= end);
  let cursor = start;
  for (const entity of entities) {
    if (entity.range[0] < cursor) continue;
    for (; cursor < entity.range[0]; cursor += 1) push({ kind: 'plain', text: points[cursor], ...flagsAt(cursor) });

    const raw = points.slice(entity.range[0], entity.range[1]).join('');
    push({
      kind: entity.type,
      text: entityText(entity, raw),
      href: entityHref(entity, raw),
      ...flagsAt(entity.range[0]),
    });
    cursor = entity.range[1];
  }
  for (; cursor < end; cursor += 1) push({ kind: 'plain', text: points[cursor], ...flagsAt(cursor) });

  return segments;
}

/** Visible text with links expanded, for previews and search-like displays. */
export function getPlainText(value: RichText | null | undefined): string {
  if (!value) return '';
  return getRichTextSegments(value).map((segment) => segment.text).join('').trim();
}

export function getUserOpenUrl(user: Pick<User, 'handle'>): string {
  return `https://x.com/${user.handle}`;
}

export function getPostOpenUrl(post: Pick<Post, 'id'>, author: Pick<User, 'handle'> | undefined): string {
  return author ? `https://x.com/${author.handle}/status/${post.id}` : `https://x.com/i/status/${post.id}`;
}

export function getAvatarUrl(user: Pick<User, 'avatarUrl'>, size: 'normal' | '400x400' = '400x400'): string | undefined {
  return user.avatarUrl?.replace(/_normal(\.\w+)$/, `_${size}$1`);
}

function photoUrl(url: string, name: 'small' | 'large' | 'orig'): string {
  const [base, query] = url.split('?');
  if (query) return `${base}?${query.replace(/(^|&)name=[^&]*/, '')}&name=${name}`.replace('?&', '?');
  const dot = base.lastIndexOf('.');
  return dot === -1 ? base : `${base.slice(0, dot)}?format=${base.slice(dot + 1)}&name=${name}`;
}

export function getMediaThumbUrl(media: Pick<Media, 'url'>): string {
  return photoUrl(media.url, 'small');
}

export function getMediaOpenUrl(media: Pick<Media, 'type' | 'url' | 'video'>): string {
  if (media.type === 'photo') return photoUrl(media.url, 'orig');
  const best = (media.video?.variants ?? [])
    .filter((variant) => variant.type === 'video/mp4')
    .sort((left, right) => (right.bitrate ?? 0) - (left.bitrate ?? 0))[0];
  return best?.url.split('?')[0] ?? media.url;
}
