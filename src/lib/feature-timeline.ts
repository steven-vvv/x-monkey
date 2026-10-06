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
  | 'search-top'
  | 'search-latest'
  | 'search-media'
  | 'home-timeline'
  | 'home-latest-timeline';

/** `?sort=popular` on the Posts, All and Highlights profile tabs, and the Popular sort of Following. */
export type FeatureTimelineSort = 'popular';

interface FeatureTimelineDescriptor {
  operationName: SupportedTimelineOperationName;
  label: string;
  /** The search product, which selects one of the lists `SearchTimeline` serves. */
  variant?: string;
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
  'search-top': { operationName: 'SearchTimeline', label: 'Search · Top', variant: 'Top' },
  'search-latest': { operationName: 'SearchTimeline', label: 'Search · Latest', variant: 'Latest' },
  'search-media': { operationName: 'SearchTimeline', label: 'Search · Media', variant: 'Media' },
  'home-timeline': { operationName: 'HomeTimeline', label: 'For You' },
  'home-latest-timeline': { operationName: 'HomeLatestTimeline', label: 'Following' },
};

/** The home page lists: For You, and Following in its Recent and Popular sorts. */
export const HOME_FEATURE_TIMELINES: ReadonlyArray<{ source: FeatureTimelineSource; sort?: FeatureTimelineSort }> = [
  { source: 'home-timeline' },
  { source: 'home-latest-timeline' },
  { source: 'home-latest-timeline', sort: 'popular' },
];

export function getFeatureTimelineNamespace(source: FeatureTimelineSource, sort?: FeatureTimelineSort): string {
  const descriptor = FEATURE_TIMELINE_DESCRIPTORS[source];
  return getTimelineNamespace(descriptor.operationName, descriptor.variant ?? sort);
}

export function getFeatureTimelineLabel(source: FeatureTimelineSource, sort?: FeatureTimelineSort): string {
  const label = FEATURE_TIMELINE_DESCRIPTORS[source].label;
  return sort === 'popular' ? `${label} · Popular` : label;
}

export function isHomeFeatureTimelineSource(source: FeatureTimelineSource): boolean {
  return source === 'home-timeline' || source === 'home-latest-timeline';
}
