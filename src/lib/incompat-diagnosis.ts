/** Decides whether a response of a supported GraphQL operation was (fully) understood by the parser. Pure: no GM or Vue imports. */
import type { EndpointKind } from './endpoint-support';
import type { CapturedXhr } from './captured-xhr';

export type IncompatReason = 'invalid-json' | 'handler-error' | 'no-instructions' | 'parse-warnings';

export interface IncompatDiagnosis {
  reason: IncompatReason;
  operationKind: EndpointKind;
  /** Error text or the parser's warnings, in the order they were raised. */
  messages: string[];
  /** Where the parser found its input (`null` when it found none). */
  instructionPath: string | null;
  /** Entries in the response's top-level `errors` array; informational, never a trigger. */
  graphqlErrorCount: number;
}

export interface IncompatRecord {
  capture: CapturedXhr;
  diagnosis: IncompatDiagnosis;
}

/** What happened to a response, as seen by `handleGraphqlResponse`. */
export type ParseOutcome =
  | { stage: 'json'; error: unknown }
  | { stage: 'handler'; json: unknown; error: unknown }
  | { stage: 'parsed'; json: unknown; meta: { instructionPath: string | null; warnings: readonly string[] } };

export function countGraphqlErrors(json: unknown): number {
  const errors = (json as { errors?: unknown } | null | undefined)?.errors;
  return Array.isArray(errors) ? errors.length : 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/** `null` when the response was handled cleanly (including unavailable accounts, which parse without a warning). */
export function diagnoseResponse(kind: EndpointKind, outcome: ParseOutcome): IncompatDiagnosis | null {
  if (outcome.stage === 'json') {
    return { reason: 'invalid-json', operationKind: kind, messages: [errorMessage(outcome.error)], instructionPath: null, graphqlErrorCount: 0 };
  }
  const graphqlErrorCount = countGraphqlErrors(outcome.json);
  if (outcome.stage === 'handler') {
    return { reason: 'handler-error', operationKind: kind, messages: [errorMessage(outcome.error)], instructionPath: null, graphqlErrorCount };
  }
  const { instructionPath, warnings } = outcome.meta;
  if (warnings.length === 0) return null;
  // The parser warns when it finds nothing to read; a missing path without warnings is a legitimate empty result.
  const reason: IncompatReason = instructionPath === null ? 'no-instructions' : 'parse-warnings';
  return { reason, operationKind: kind, messages: [...warnings], instructionPath, graphqlErrorCount };
}
