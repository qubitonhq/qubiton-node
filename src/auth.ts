/**
 * OAuth token manager for the QubitOn API.
 *
 * The QubitOn OAuth endpoint is non-standard: it accepts a JSON body
 * `{ "key": "...", "secret": "..." }` and returns
 * `{ "token": "...", "expiresInSeconds": 3600, "subscriptionName": "..." }`.
 * It is NOT standard OAuth2 client_credentials.
 */

import { QubitonAbortError, QubitonAuthError, QubitonError, QubitonTimeoutError } from './errors';
import { USER_AGENT } from './utils/constants';
import { isAbortError } from './utils/signals';

interface TokenCache {
  accessToken: string;
  /** Epoch milliseconds at which the token expires. */
  expiresAt: number;
  /** Subscription name returned with the token (informational). */
  subscriptionName?: string;
}

interface OAuthTokenResponse {
  token?: string;
  expiresInSeconds?: number;
  subscriptionName?: string;
}

/** Refresh tokens 30 seconds before they actually expire to avoid races. */
const TOKEN_REFRESH_SKEW_MS = 30_000;
/** Reasonable hard timeout for the token request itself. */
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Manages OAuth tokens for the QubitOn API. Caches the token in-process and
 * refreshes it on demand. Concurrent calls share a single in-flight refresh.
 *
 * @remarks
 * Most users do not interact with this class directly — pass `clientId` and
 * `clientSecret` to {@link QubitOnClient} and the client will manage the token
 * lifecycle for you. The class is exported for advanced use cases such as
 * sharing a token cache across multiple SDK instances or driving a custom
 * fetch pipeline.
 */
export class OAuthTokenManager {
  private readonly key: string;
  private readonly secret: string;
  private readonly tokenUrl: string;
  private readonly version: string;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private cache: TokenCache | null = null;
  private inflight: Promise<string> | null = null;

  constructor(
    key: string,
    secret: string,
    tokenUrl: string,
    version: string,
    fetchImpl: typeof fetch = fetch,
    requestTimeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
  ) {
    this.key = key;
    this.secret = secret;
    this.tokenUrl = tokenUrl;
    this.version = version;
    this.fetchImpl = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  /**
   * Returns a valid access token, fetching a new one if the cached token is
   * missing or about to expire. `signal` can be used to cancel the per-caller
   * wait; it does NOT abort the underlying network refresh — that would tear
   * the request out from under any other caller piggybacked on the same
   * in-flight refresh.
   */
  async getToken(signal?: AbortSignal | null): Promise<string> {
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.accessToken;
    }
    if (!this.inflight) {
      // The fetch uses ONLY the internal timeout signal — caller-supplied
      // signals are honoured by racing the returned promise below.
      this.inflight = this.fetchToken().finally(() => {
        this.inflight = null;
      });
    }
    return raceWithSignal(this.inflight, signal);
  }

  /**
   * Forces the cached token to be discarded so the next `getToken()` call
   * fetches a fresh one. Used by the client to recover from a 401 response
   * caused by a token that was revoked or rotated server-side.
   */
  invalidate(): void {
    this.cache = null;
  }

  private async fetchToken(): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const resp = await this.fetchImpl(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': `${USER_AGENT}/${this.version}`,
        },
        body: JSON.stringify({ key: this.key, secret: this.secret }),
        signal: controller.signal,
      });

      if (resp.status === 401 || resp.status === 403) {
        throw new QubitonAuthError(resp.status, 'OAuth token request rejected: invalid key or secret');
      }
      if (!resp.ok) {
        let raw: Record<string, unknown> = {};
        try {
          raw = (await resp.json()) as Record<string, unknown>;
        } catch {
          // ignore — body may not be JSON
        }
        throw new QubitonError(resp.status, `OAuth token request failed: HTTP ${resp.status}`, raw);
      }

      let data: OAuthTokenResponse;
      try {
        data = (await resp.json()) as OAuthTokenResponse;
      } catch (parseErr) {
        const msg = (parseErr as Error)?.message ?? String(parseErr);
        throw new QubitonError(0, `OAuth token response read/parse failed: ${msg}`);
      }
      const token = data.token;
      if (!token) {
        throw new QubitonError(0, 'OAuth token response missing "token" field', data as Record<string, unknown>);
      }
      const expiresInSeconds =
        typeof data.expiresInSeconds === 'number' && data.expiresInSeconds > 0 ? data.expiresInSeconds : 3600;

      // Compute the effective skew so a short-TTL token doesn't immediately
      // count as "expired" the moment we cache it (which would loop forever).
      // For long TTLs we subtract the full 30s; for short TTLs we subtract
      // half the lifetime so the cache is still valid for some time after
      // being written.
      const expiresInMs = expiresInSeconds * 1000;
      const effectiveSkew = Math.min(TOKEN_REFRESH_SKEW_MS, expiresInMs / 2);

      this.cache = {
        accessToken: token,
        // Pre-bake the actual expiry-with-skew so getToken()'s comparison
        // (`Date.now() < cache.expiresAt`) is correct even for sub-60s TTLs.
        expiresAt: Date.now() + expiresInMs - effectiveSkew,
        subscriptionName: data.subscriptionName,
      };
      return token;
    } catch (err) {
      if (err instanceof QubitonError) throw err;
      if (isAbortError(err)) {
        throw new QubitonTimeoutError('OAuth token request timed out');
      }
      throw new QubitonError(0, `OAuth token request failed: ${(err as Error).message ?? String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Race a promise against an optional caller-supplied AbortSignal. If the
 * signal aborts before the promise settles, the returned promise rejects with
 * a generic abort error. The underlying promise itself is left untouched —
 * this is by design so that other callers piggybacking on a shared in-flight
 * promise are not affected.
 */
function raceWithSignal<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new QubitonAbortError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      cleanup();
      reject(new QubitonAbortError());
    };
    let settled = false;
    const cleanup = (): void => {
      settled = true;
      signal.removeEventListener('abort', onAbort);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        if (settled) return;
        cleanup();
        resolve(v);
      },
      (e) => {
        if (settled) return;
        cleanup();
        reject(e);
      },
    );
  });
}

// ── Legacy alias (deprecated) ──────────────────────────────────────────────

/** @deprecated Use OAuthTokenManager. */
export const OAuth2TokenManager = OAuthTokenManager;
/** @deprecated Use OAuthTokenManager. */
export type OAuth2TokenManager = OAuthTokenManager;
