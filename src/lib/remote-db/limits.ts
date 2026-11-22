/**
 * Per submit request: at most this many records (posts + users + media) and bytes. The server stores them one
 * transaction at a time (about 10 ms each), so 400 records stay far below the 55 s client timeout, the server's 60 s
 * write timeout and Cloudflare's ~100 s. Shared by the auto-archive engine and the manual (chunked) submit.
 */
export const MAX_REQUEST_RECORDS = 400;
export const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
