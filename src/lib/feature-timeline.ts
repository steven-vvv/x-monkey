import type { SupportedTimelineOperationName } from './endpoint-support';

export type FeatureTimelineSource =
  | 'user-media'
  | 'user-tweets'
  | 'bookmarks'
  | 'home-timeline'
  | 'home-latest-timeline';

interface FeatureTimelineDescriptor {
  operationName: SupportedTimelineOperationName;
  label: string;
}

const FEATURE_TIMELINE_DESCRIPTORS: Record<FeatureTimelineSource, FeatureTimelineDescriptor> = {
  'user-media': {
    operationName: 'UserMedia',
    label: 'Media',
  },
  'user-tweets': {
    operationName: 'UserTweets',
    label: 'Tweets',
  },
  'bookmarks': {
    operationName: 'Bookmarks',
    label: 'Bookmarks',
  },
  'home-timeline': {
    operationName: 'HomeTimeline',
    label: 'HomeTimeline',
  },
  'home-latest-timeline': {
    operationName: 'HomeLatestTimeline',
    label: 'HomeLatestTimeline',
  },
};

export const HOME_FEATURE_TIMELINE_SOURCES = [
  'home-timeline',
  'home-latest-timeline',
] as const satisfies readonly FeatureTimelineSource[];

export function getFeatureTimelineOperation(source: FeatureTimelineSource): SupportedTimelineOperationName {
  return FEATURE_TIMELINE_DESCRIPTORS[source].operationName;
}

export function getFeatureTimelineLabel(source: FeatureTimelineSource): string {
  return FEATURE_TIMELINE_DESCRIPTORS[source].label;
}

export function isHomeFeatureTimelineSource(source: FeatureTimelineSource): boolean {
  return source === 'home-timeline' || source === 'home-latest-timeline';
}
