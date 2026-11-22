import type { ArchiveRecordSource } from './adapter';
import { submitPostsChunked, type ChunkedSubmitOptions } from './chunked-submit';
import { submitRemoteDbArchive } from './client';
import type { RemoteDbSubmitResponse } from './types';

/** Manual submit of posts: `submitPostsChunked` over the real client. Use this instead of one unbounded request. */
export function submitRemoteDbPosts(
  postIds: readonly string[],
  source: ArchiveRecordSource,
  options?: ChunkedSubmitOptions,
): Promise<RemoteDbSubmitResponse> {
  return submitPostsChunked(postIds, source, { submit: submitRemoteDbArchive }, options);
}
