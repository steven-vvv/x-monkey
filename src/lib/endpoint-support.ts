export type EndpointKind = 'timeline' | 'tweet-detail';

export interface EndpointSupportRecord {
  operationName: string;
  kind: EndpointKind;
  dumpDir: string;
  extraDumpDirs?: readonly string[];
  supportVersion: number;
}

export const SUPPORTED_ENDPOINTS = [
  {
    operationName: 'TweetDetail',
    kind: 'tweet-detail',
    dumpDir: 'dumps/legacy/TweetDetail',
    extraDumpDirs: ['dumps/misc/3'],
    supportVersion: 1,
  },
  {
    operationName: 'Bookmarks',
    kind: 'timeline',
    dumpDir: 'dumps/Bookmarks',
    supportVersion: 1,
  },
  {
    operationName: 'HomeTimeline',
    kind: 'timeline',
    dumpDir: 'dumps/HomeTimeline',
    supportVersion: 1,
  },
  {
    operationName: 'HomeLatestTimeline',
    kind: 'timeline',
    dumpDir: 'dumps/HomeLatestTimeline',
    supportVersion: 1,
  },
  {
    operationName: 'UserTweets',
    kind: 'timeline',
    dumpDir: 'dumps/UserTweets',
    supportVersion: 1,
  },
  {
    operationName: 'UserMedia',
    kind: 'timeline',
    dumpDir: 'dumps/UserMedia',
    supportVersion: 1,
  },
] as const satisfies readonly EndpointSupportRecord[];

export type SupportedEndpointOperationName = (typeof SUPPORTED_ENDPOINTS)[number]['operationName'];
export type SupportedTimelineOperationName = Extract<(typeof SUPPORTED_ENDPOINTS)[number], { kind: 'timeline' }>['operationName'];

const supportedEndpointNameSet = new Set<string>(SUPPORTED_ENDPOINTS.map((item) => item.operationName));

export function isSupportedEndpointOperation(value: string): value is SupportedEndpointOperationName {
  return supportedEndpointNameSet.has(value);
}

export function getEndpointFixtureDirs(endpoint: EndpointSupportRecord): readonly string[] {
  return endpoint.extraDumpDirs ? [endpoint.dumpDir, ...endpoint.extraDumpDirs] : [endpoint.dumpDir];
}
