/**
 * Shared utilities for AbortSignal handling.
 *
 * Used by both `client.ts` and `auth.ts` so the polyfill / leak-cleanup logic
 * lives in exactly one place.
 */

/**
 * Combine an internal AbortSignal with an optional caller-supplied signal so
 * that aborting either one cancels the request. Falls back gracefully on Node
 * versions older than 20.3 that do not have AbortSignal.any.
 *
 * Returns `{ signal, cleanup }`. Callers MUST invoke `cleanup()` once the
 * underlying operation has finished (success OR failure) — this removes the
 * `abort` listeners attached to the source signals so we don't leak them on
 * long-lived signals.
 */
export function combineSignals(
  internal: AbortSignal,
  external?: AbortSignal | null,
): { signal: AbortSignal; cleanup: () => void } {
  if (!external) {
    return { signal: internal, cleanup: noop };
  }

  type AbortSignalAny = (signals: AbortSignal[]) => AbortSignal;
  const anyFn = (AbortSignal as unknown as { any?: AbortSignalAny }).any;
  if (typeof anyFn === 'function') {
    // Native AbortSignal.any handles GC of its source listeners itself.
    return { signal: anyFn([internal, external]), cleanup: noop };
  }

  // Polyfill for Node < 20.3: forward both source aborts to a new
  // controller, and remember the listeners so we can detach on cleanup.
  // Reasons (`signal.reason`) are forwarded so caller-supplied reasons
  // are preserved on the merged signal — this matches the behaviour of
  // native `AbortSignal.any` and lets downstream code distinguish
  // timeouts from user cancellations.
  const controller = new AbortController();
  if (internal.aborted) {
    controller.abort(internal.reason);
    return { signal: controller.signal, cleanup: noop };
  }
  if (external.aborted) {
    controller.abort(external.reason);
    return { signal: controller.signal, cleanup: noop };
  }

  const onInternal = (): void => controller.abort(internal.reason);
  const onExternal = (): void => controller.abort(external.reason);
  internal.addEventListener('abort', onInternal, { once: true });
  external.addEventListener('abort', onExternal, { once: true });

  const cleanup = (): void => {
    internal.removeEventListener('abort', onInternal);
    external.removeEventListener('abort', onExternal);
  };
  return { signal: controller.signal, cleanup };
}

/** True for both DOMException AbortError and TimeoutError. */
export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  return name === 'AbortError' || name === 'TimeoutError';
}

function noop(): void {
  // intentionally empty
}
