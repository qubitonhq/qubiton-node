/**
 * Typed exception hierarchy for the QubitOn SDK.
 *
 * All errors extend QubitonError. Catch the specific subclass you care about,
 * or catch QubitonError to handle any SDK-thrown error.
 */

/** Base class for all errors thrown by the QubitOn SDK. */
export class QubitonError extends Error {
  /** HTTP status code (0 if the request never completed). */
  public readonly status: number;
  /** Raw decoded server response body, if any. */
  public readonly raw: Record<string, unknown>;

  constructor(status: number, message: string, raw?: Record<string, unknown>) {
    super(message);
    this.name = 'QubitonError';
    this.status = status;
    this.raw = raw ?? {};
    // Restore prototype chain (TS quirk when extending Error).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Raised on 401/403 responses from the API. */
export class QubitonAuthError extends QubitonError {
  constructor(status = 401, message = 'Authentication failed', raw?: Record<string, unknown>) {
    super(status, message, raw);
    this.name = 'QubitonAuthError';
    Object.setPrototypeOf(this, QubitonAuthError.prototype);
  }
}

/** Raised on 404 responses. */
export class QubitonNotFoundError extends QubitonError {
  constructor(message = 'Not found', raw?: Record<string, unknown>) {
    super(404, message, raw);
    this.name = 'QubitonNotFoundError';
    Object.setPrototypeOf(this, QubitonNotFoundError.prototype);
  }
}

/** Raised on 400/422 (and other 4xx that aren't auth/rate-limit/404) responses. */
export class QubitonValidationError extends QubitonError {
  constructor(status: number, message: string, raw?: Record<string, unknown>) {
    super(status, message, raw);
    this.name = 'QubitonValidationError';
    Object.setPrototypeOf(this, QubitonValidationError.prototype);
  }
}

/** Raised on 429 responses. `retryAfter` is in seconds (or undefined if the header was missing). */
export class QubitonRateLimitError extends QubitonError {
  public readonly retryAfter: number | undefined;

  constructor(retryAfter?: number, raw?: Record<string, unknown>, message = 'Rate limit exceeded') {
    super(429, message, raw);
    this.name = 'QubitonRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, QubitonRateLimitError.prototype);
  }
}

/**
 * Raised on 5xx server errors. `retryAfter` mirrors `QubitonRateLimitError` —
 * if the server included a `Retry-After` header, it is exposed here in seconds.
 */
export class QubitonServerError extends QubitonError {
  public readonly retryAfter: number | undefined;

  constructor(
    status: number,
    message = 'Server error',
    raw?: Record<string, unknown>,
    retryAfter?: number,
  ) {
    super(status, message, raw);
    this.name = 'QubitonServerError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, QubitonServerError.prototype);
  }
}

/**
 * Raised when a request is cancelled by the per-call timeout (NOT by a
 * caller-supplied AbortSignal — those throw {@link QubitonAbortError}).
 */
export class QubitonTimeoutError extends QubitonError {
  constructor(message = 'Request timed out — please try again', raw?: Record<string, unknown>) {
    super(0, message, raw);
    this.name = 'QubitonTimeoutError';
    Object.setPrototypeOf(this, QubitonTimeoutError.prototype);
  }
}

/**
 * Raised when a request is cancelled by a caller-supplied AbortSignal.
 * Distinct from {@link QubitonTimeoutError}, which represents the per-call
 * deadline expiring; this error means the caller themselves aborted the
 * request.
 */
export class QubitonAbortError extends QubitonError {
  constructor(message = 'request aborted by caller', raw?: Record<string, unknown>) {
    super(0, message, raw);
    this.name = 'QubitonAbortError';
    Object.setPrototypeOf(this, QubitonAbortError.prototype);
  }
}

// ── Legacy aliases (deprecated — use the Qubiton* names above) ─────────────
//
// These are bidirectional aliases: `err instanceof ApiError` and
// `err instanceof QubitonError` BOTH return true for any SDK-thrown error.
// We achieve this with `Symbol.hasInstance` so callers using either name
// get correct narrowing, regardless of which class the SDK actually
// constructed at the throw site.

/** @deprecated Use QubitonError. */
export class ApiError extends QubitonError {
  static override [Symbol.hasInstance](instance: unknown): boolean {
    return instance instanceof QubitonError;
  }
  constructor(status: number, message: string, raw?: Record<string, unknown>) {
    super(status, message, raw);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** @deprecated Use QubitonAuthError. */
export class AuthenticationError extends QubitonAuthError {
  static override [Symbol.hasInstance](instance: unknown): boolean {
    return instance instanceof QubitonAuthError;
  }
  constructor(status = 401, message = 'Authentication failed', raw?: Record<string, unknown>) {
    super(status, message, raw);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/** @deprecated Use QubitonRateLimitError. */
export class RateLimitError extends QubitonRateLimitError {
  static override [Symbol.hasInstance](instance: unknown): boolean {
    return instance instanceof QubitonRateLimitError;
  }
  constructor(retryAfter?: number, raw?: Record<string, unknown>, message = 'Rate limit exceeded') {
    super(retryAfter, raw, message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
