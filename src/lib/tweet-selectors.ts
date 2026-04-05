import type { DbMediaRecord, DbTweetRecord, DbUserRecord } from './types';

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

export function getTweetDisplayText(tweet: Pick<DbTweetRecord, 'body' | 'note'>): string {
  return (tweet.note?.text.text ?? tweet.body.text).replace(/https:\/\/t\.co\/\S+/g, '').trim();
}

export function getUserBioText(user: Pick<DbUserRecord, 'profile'>): string {
  return user.profile.bio?.text ?? '';
}

export function getUserOpenUrl(user: Pick<DbUserRecord, 'userName'>): string {
  return `https://x.com/${user.userName}`;
}

export function getTweetOpenUrl(
  tweet: Pick<DbTweetRecord, 'id'>,
  author: Pick<DbUserRecord, 'userName'> | undefined,
): string | null {
  if (!author?.userName) return null;
  return `https://x.com/${author.userName}/status/${tweet.id}`;
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
