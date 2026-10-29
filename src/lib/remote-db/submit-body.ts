import type { RemoteDbSubmission, RemoteDbSubmitBody } from './types';

/**
 * Whether submits carry `merge: "explicit"`. tweet-db-v2 understands it since
 * the 2026-10-30 release (b1b183f); an older server decodes the batch with
 * `DisallowUnknownFields` and would answer 400 `invalid_batch`, so turn this
 * off when pointing a build at one.
 */
export const SUBMIT_EXPLICIT_MERGE = true;

/**
 * Builds the `POST /api/v1/archive/submit` body. `merge: "explicit"` tells the
 * server to apply missing / `null` / typed-empty semantics to user records
 * (see design/x-archive-model.md); posts and media still omit what they lack.
 */
export function buildSubmitBody(submission: RemoteDbSubmission, explicitMerge: boolean = SUBMIT_EXPLICIT_MERGE): RemoteDbSubmitBody {
  return explicitMerge ? { merge: 'explicit', ...submission } : submission;
}
