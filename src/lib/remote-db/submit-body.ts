import type { RemoteDbSubmission, RemoteDbSubmitBody } from './types';

/**
 * Whether submits carry `merge: "explicit"`. tweet-db-v2 decodes the archive
 * batch with `DisallowUnknownFields`, so a server without the `merge` field
 * answers 400 `invalid_batch` to the whole request. Switch this on only once
 * every server this build talks to knows the key; until then user records go
 * out with the same shape and the server keeps its sparse merge, which ignores
 * `null` and typed empty values.
 */
export const SUBMIT_EXPLICIT_MERGE = false;

/**
 * Builds the `POST /api/v1/archive/submit` body. `merge: "explicit"` tells the
 * server to apply missing / `null` / typed-empty semantics to user records
 * (see design/x-archive-model.md); posts and media still omit what they lack.
 */
export function buildSubmitBody(submission: RemoteDbSubmission, explicitMerge: boolean = SUBMIT_EXPLICIT_MERGE): RemoteDbSubmitBody {
  return explicitMerge ? { merge: 'explicit', ...submission } : submission;
}
