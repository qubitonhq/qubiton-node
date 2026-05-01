/**
 * Shared SDK constants. Single source of truth for version, base URL, and
 * the User-Agent string that both the API client and the OAuth token manager
 * send on every request.
 */

export const SDK_VERSION = '1.0.0';
export const DEFAULT_BASE_URL = 'https://api.qubiton.com';
export const USER_AGENT = `qubiton-node-sdk/${SDK_VERSION}`;

/** Maximum exponential-backoff delay between retries (milliseconds). */
export const MAX_BACKOFF_MS = 30_000;
/** Default maximum number of transient-failure retry attempts. */
export const MAX_RETRIES = 3;
