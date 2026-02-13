import type { XTweet, XUser } from './types';

export interface StatItem {
  label: string;
  value: string;
}

export function tweetText(tweet: Pick<XTweet, 'fullText'>): string {
  return tweet.fullText.replace(/https:\/\/t\.co\/\S+/g, '').trim();
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

export function avatarFull(url: string): string {
  return url.replace('_normal.', '_400x400.');
}

export function toTweetStats(
  tweet: Pick<XTweet, 'viewCount' | 'favoriteCount' | 'retweetCount' | 'replyCount' | 'quoteCount' | 'bookmarkCount'>,
): StatItem[] {
  return [
    { label: 'Views', value: tweet.viewCount != null ? formatCount(tweet.viewCount) : '-' },
    { label: 'Likes', value: formatCount(tweet.favoriteCount) },
    { label: 'RT', value: formatCount(tweet.retweetCount) },
    { label: 'Replies', value: formatCount(tweet.replyCount) },
    { label: 'Quotes', value: formatCount(tweet.quoteCount) },
    { label: 'Bookmarks', value: formatCount(tweet.bookmarkCount) },
  ];
}

export function toUserStats(
  user: Pick<XUser, 'followersCount' | 'friendsCount' | 'statusesCount' | 'favouritesCount' | 'mediaCount' | 'listedCount'>,
): StatItem[] {
  return [
    { label: 'Followers', value: formatCount(user.followersCount) },
    { label: 'Following', value: formatCount(user.friendsCount) },
    { label: 'Tweets', value: formatCount(user.statusesCount) },
    { label: 'Likes', value: formatCount(user.favouritesCount) },
    { label: 'Media', value: formatCount(user.mediaCount) },
    { label: 'Listed', value: formatCount(user.listedCount) },
  ];
}
