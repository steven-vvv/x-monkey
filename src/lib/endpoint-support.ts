export type EndpointKind = 'timeline' | 'tweet-detail';

export interface EndpointSupportRecord {
  operationName: string;
  kind: EndpointKind;
  /**
   * `user` timelines belong to the profile in `variables.userId`, `query` ones
   * to the search in `variables.rawQuery`; `global` ones are a single list.
   */
  scope?: 'user' | 'global' | 'query';
  /** New pages land on top (home feeds) instead of being appended. */
  prepend?: boolean;
}

/** GraphQL operations captured into the in-memory database (2026-10 web client). */
export const SUPPORTED_ENDPOINTS = [
  { operationName: 'TweetDetail', kind: 'tweet-detail' },
  { operationName: 'HomeTimeline', kind: 'timeline', scope: 'global', prepend: true },
  { operationName: 'HomeLatestTimeline', kind: 'timeline', scope: 'global', prepend: true },
  { operationName: 'Bookmarks', kind: 'timeline', scope: 'global' },
  // Likes are private since 2024: the list always belongs to the signed-in account.
  { operationName: 'Likes', kind: 'timeline', scope: 'global' },
  { operationName: 'UserOriginalsTimeline', kind: 'timeline', scope: 'user' },
  { operationName: 'UserTweetsAndReplies', kind: 'timeline', scope: 'user' },
  { operationName: 'UserHighlightsTweets', kind: 'timeline', scope: 'user' },
  { operationName: 'UserRepliesTimeline', kind: 'timeline', scope: 'user' },
  { operationName: 'UserRepostsTimeline', kind: 'timeline', scope: 'user' },
  { operationName: 'UserArticlesTweets', kind: 'timeline', scope: 'user' },
  { operationName: 'UserVideoTimeline', kind: 'timeline', scope: 'user' },
  { operationName: 'UserPhotoTimeline', kind: 'timeline', scope: 'user' },
  { operationName: 'SearchTimeline', kind: 'timeline', scope: 'query' },
] as const satisfies readonly EndpointSupportRecord[];

export type SupportedEndpoint = (typeof SUPPORTED_ENDPOINTS)[number];
export type SupportedTimelineOperationName = Extract<SupportedEndpoint, { kind: 'timeline' }>['operationName'];

const endpointsByName = new Map<string, EndpointSupportRecord>(SUPPORTED_ENDPOINTS.map((item) => [item.operationName, item]));

export function getSupportedEndpoint(operationName: string): EndpointSupportRecord | undefined {
  return endpointsByName.get(operationName);
}

/**
 * Identifies one ordered list. An operation serves several lists when a
 * variable selects one: `popular` for `sortByMostLiked` (the `?sort=popular`
 * views) and the search `product` (`Top`, `Latest`, `Media`).
 */
export function getTimelineNamespace(operationName: string, variant?: string): string {
  return variant ? `${operationName}#${variant}` : operationName;
}
