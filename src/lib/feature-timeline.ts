import { getTimelineNamespace, type SupportedTimelineOperationName } from './endpoint-support';

export type FeatureTimelineSource =
  | 'user-posts'
  | 'user-all'
  | 'user-highlights'
  | 'user-replies'
  | 'user-reposts'
  | 'user-articles'
  | 'user-videos'
  | 'user-photos'
  | 'bookmarks'
  | 'likes'
  | 'home-timeline'
  | 'home-latest-timeline';

/** `?sort=popular` on the Posts, All and Highlights profile tabs. */
export type FeatureTimelineSort = 'popular';

interface FeatureTimelineDescriptor {
  operationName: SupportedTimelineOperationName;
  label: string;
}

const FEATURE_TIMELINE_DESCRIPTORS: Record<FeatureTimelineSource, FeatureTimelineDescriptor> = {
  'user-posts': { operationName: 'UserOriginalsTimeline', label: 'Posts' },
  'user-all': { operationName: 'UserTweetsAndReplies', label: 'All' },
  'user-highlights': { operationName: 'UserHighlightsTweets', label: 'Highlights' },
  'user-replies': { operationName: 'UserRepliesTimeline', label: 'Replies' },
  'user-reposts': { operationName: 'UserRepostsTimeline', label: 'Reposts' },
  'user-articles': { operationName: 'UserArticlesTweets', label: 'Articles' },
  'user-videos': { operationName: 'UserVideoTimeline', label: 'Videos' },
  'user-photos': { operationName: 'UserPhotoTimeline', label: 'Photos' },
  'bookmarks': { operationName: 'Bookmarks', label: 'Bookmarks' },
  'likes': { operationName: 'Likes', label: 'Likes' },
  'home-timeline': { operationName: 'HomeTimeline', label: 'For You' },
  'home-latest-timeline': { operationName: 'HomeLatestTimeline', label: 'Following' },
};

export const HOME_FEATURE_TIMELINE_SOURCES = [
  'home-timeline',
  'home-latest-timeline',
] as const satisfies readonly FeatureTimelineSource[];

export function getFeatureTimelineNamespace(source: FeatureTimelineSource, sort?: FeatureTimelineSort): string {
  return getTimelineNamespace(FEATURE_TIMELINE_DESCRIPTORS[source].operationName, sort);
}

export function getFeatureTimelineLabel(source: FeatureTimelineSource, sort?: FeatureTimelineSort): string {
  const label = FEATURE_TIMELINE_DESCRIPTORS[source].label;
  return sort === 'popular' ? `${label} · Popular` : label;
}

export function isHomeFeatureTimelineSource(source: FeatureTimelineSource): boolean {
  return source === 'home-timeline' || source === 'home-latest-timeline';
}
