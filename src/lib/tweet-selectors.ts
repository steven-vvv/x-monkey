import type {
  AnnotatedText,
  TweetNote,
  TweetPermalink,
} from '../schema/tweet-schema';
import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from './types';

interface TweetFieldAccess {
  content: {
    legacyText: AnnotatedText;
    note?: TweetNote;
    mediaIds: string[];
  };
  conversation: {
    replyTo?: {
      tweetId?: string;
      userId?: string;
      userName?: string;
    };
    quote?: {
      tweetId: string;
      permalink?: TweetPermalink;
    };
    repostId?: string;
  };
}

interface MediaFieldAccess {
  origin?: {
    tweetId?: string;
    userId?: string;
  };
}

export interface TweetTextSegment {
  kind: 'plain' | 'hashtag' | 'symbol' | 'mention' | 'url' | 'media';
  text: string;
  emphasis: boolean;
}

interface TextReplacement {
  start: number;
  end: number;
  kind: TweetTextSegment['kind'];
  text: string;
}

function stripQuery(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

function replacePhotoSize(mediaUrl: string, name: 'small' | 'orig'): string {
  const cleanUrl = stripQuery(mediaUrl);
  const dotIndex = cleanUrl.lastIndexOf('.');
  if (dotIndex === -1) return cleanUrl;

  const base = cleanUrl.slice(0, dotIndex);
  const ext = cleanUrl.slice(dotIndex + 1);
  return `${base}?format=${ext}&name=${name}`;
}

function getBestVideoVariant(media: Pick<DbMediaRecord, 'video'>): string | null {
  const variants = media.video?.variants ?? [];
  const mp4Variants = variants.filter((variant) => variant.contentType === 'video/mp4');
  if (mp4Variants.length === 0) return null;

  mp4Variants.sort((left, right) => (right.bitrate ?? 0) - (left.bitrate ?? 0));
  return stripQuery(mp4Variants[0].url);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&nbsp;/g, ' ');
}

function decodeBackslashEscapes(text: string): string {
  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, '\'')
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\');
}

function decodeTextContent(text: string): string {
  return decodeBackslashEscapes(decodeHtmlEntities(text));
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getAnnotatedTextDisplayRange(value: AnnotatedText): { start: number; end: number } {
  const max = value.text.length;
  const start = clampIndex(value.displayRange?.start ?? 0, 0, max);
  const end = clampIndex(value.displayRange?.end ?? max, start, max);
  return { start, end };
}

function getAnnotatedTextReplacements(value: AnnotatedText): TextReplacement[] {
  const replacements: TextReplacement[] = [];

  for (const item of value.entities.hashtags) {
    replacements.push({
      start: item.range.start,
      end: item.range.end,
      kind: 'hashtag',
      text: `#${item.text}`,
    });
  }

  for (const item of value.entities.symbols) {
    if (!item.range) continue;
    replacements.push({
      start: item.range.start,
      end: item.range.end,
      kind: 'symbol',
      text: value.text.slice(item.range.start, item.range.end),
    });
  }

  for (const item of value.entities.mentions) {
    replacements.push({
      start: item.range.start,
      end: item.range.end,
      kind: 'mention',
      text: `@${item.userName}`,
    });
  }

  for (const item of value.entities.urls) {
    replacements.push({
      start: item.range.start,
      end: item.range.end,
      kind: 'url',
      text: item.expandedUrl || item.displayText || item.url,
    });
  }

  for (const item of value.entities.media) {
    if (!item.range) continue;
    replacements.push({
      start: item.range.start,
      end: item.range.end,
      kind: 'media',
      text: value.text.slice(item.range.start, item.range.end),
    });
  }

  return replacements.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start;
    return right.end - left.end;
  });
}

export function getAnnotatedTextSegments(value: AnnotatedText): TweetTextSegment[] {
  const { start, end } = getAnnotatedTextDisplayRange(value);
  const replacements = getAnnotatedTextReplacements(value);
  const segments: TweetTextSegment[] = [];
  let cursor = start;

  for (const replacement of replacements) {
    if (replacement.start < start || replacement.end > end) continue;
    if (replacement.end <= cursor) continue;
    if (replacement.start > cursor) {
      const plainText = decodeTextContent(value.text.slice(cursor, replacement.start));
      if (plainText) {
        segments.push({
          kind: 'plain',
          text: plainText,
          emphasis: false,
        });
      }
    }

    const entityText = decodeTextContent(replacement.text);
    if (entityText) {
      segments.push({
        kind: replacement.kind,
        text: entityText,
        emphasis: replacement.kind !== 'plain',
      });
    }
    cursor = replacement.end;
  }

  if (cursor < end) {
    const trailingText = decodeTextContent(value.text.slice(cursor, end));
    if (trailingText) {
      segments.push({
        kind: 'plain',
        text: trailingText,
        emphasis: false,
      });
    }
  }

  return segments;
}

export function getTweetDisplayText(tweet: TweetFieldAccess): string {
  return (getTweetNote(tweet)?.text.text ?? getTweetLegacyText(tweet).text)
    .replace(/https:\/\/t\.co\/\S+/g, '')
    .trim();
}

export function getTweetSummaryText(tweet: TweetFieldAccess): string {
  return decodeTextContent(getTweetLegacyText(tweet).text);
}

export function getTweetDetailTextSegments(tweet: TweetFieldAccess): TweetTextSegment[] {
  return getAnnotatedTextSegments(getTweetNote(tweet)?.text ?? getTweetLegacyText(tweet));
}

export function getUserBioText(user: Pick<DbUserRecord, 'profile'>): string {
  return user.profile.bio?.text ?? '';
}

export function getUserOpenUrl(user: Pick<DbUserRecord, 'profile'>): string {
  return `https://x.com/${user.profile.userName}`;
}

export function getTweetOpenUrl(
  tweet: Pick<DbTweetRecord, 'id'>,
  author: Pick<DbUserRecord, 'profile'> | undefined,
): string | null {
  if (!author?.profile.userName) return null;
  return `https://x.com/${author.profile.userName}/status/${tweet.id}`;
}

export function getMediaThumbUrl(media: Pick<DbMediaRecord, 'mediaUrl'>): string {
  if (!media.mediaUrl) return '';
  return replacePhotoSize(media.mediaUrl, 'small');
}

export function getMediaOpenUrl(
  media: Pick<DbMediaRecord, 'type' | 'mediaUrl' | 'video'>,
): string {
  if (media.type === 'photo' && media.mediaUrl) {
    return replacePhotoSize(media.mediaUrl, 'orig');
  }

  return getBestVideoVariant(media) ?? media.mediaUrl ?? '';
}

export function getTweetLegacyText(tweet: TweetFieldAccess): AnnotatedText {
  return tweet.content.legacyText;
}

export function getTweetNote(tweet: TweetFieldAccess): TweetNote | undefined {
  return tweet.content.note;
}

export function getTweetMediaIds(tweet: TweetFieldAccess): string[] {
  return tweet.content.mediaIds;
}

export function getTweetReplyToTweetId(tweet: TweetFieldAccess): string | undefined {
  return tweet.conversation.replyTo?.tweetId;
}

export function getTweetReplyToUserId(tweet: TweetFieldAccess): string | undefined {
  return tweet.conversation.replyTo?.userId;
}

export function getTweetReplyToUserName(tweet: TweetFieldAccess): string | undefined {
  return tweet.conversation.replyTo?.userName;
}

export function getTweetQuoteId(tweet: TweetFieldAccess): string | undefined {
  return tweet.conversation.quote?.tweetId;
}

export function getTweetQuotePermalink(tweet: TweetFieldAccess): TweetPermalink | undefined {
  return tweet.conversation.quote?.permalink;
}

export function getTweetRepostId(tweet: TweetFieldAccess): string | undefined {
  return tweet.conversation.repostId;
}

export function getMediaOriginTweetId(media: MediaFieldAccess): string | undefined {
  return media.origin?.tweetId;
}

export function getMediaOriginUserId(media: MediaFieldAccess): string | undefined {
  return media.origin?.userId;
}
