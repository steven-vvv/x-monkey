/** One recorded X GraphQL request / response pair. Types only, so pure modules and tests can import it. */
export interface CapturedXhr {
  id: string;
  /** Time the response finished loading. */
  timestamp: number;
  /** Time `send()` was called. */
  startedAt: number;
  /** Page URL at the time `send()` was called. */
  pageUrl: string;
  method: string;
  url: string;
  graphqlId: string;
  operationName: string;
  /** Headers in `setRequestHeader()` call order, including sensitive values. */
  requestHeaders: Array<[string, string]>;
  requestBody: string | null;
  status: number;
  statusText: string;
  responseHeaders: string;
  responseBody: string;
  responseSize: number;
}
