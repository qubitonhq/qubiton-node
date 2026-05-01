import { describe, expect, it, vi } from 'vitest';
import { combineSignals, isAbortError } from '../src/utils/signals';

describe('combineSignals', () => {
  it('returns the internal signal unchanged when no external signal is given', () => {
    const ctrl = new AbortController();
    const { signal, cleanup } = combineSignals(ctrl.signal);
    expect(signal).toBe(ctrl.signal);
    cleanup();
  });

  it('aborts when either source signal aborts (native AbortSignal.any path)', async () => {
    const internal = new AbortController();
    const external = new AbortController();
    const { signal, cleanup } = combineSignals(internal.signal, external.signal);
    expect(signal.aborted).toBe(false);
    external.abort(new Error('caller cancelled'));
    expect(signal.aborted).toBe(true);
    cleanup();
  });

  it('forwards reasons through the polyfill path', () => {
    // Force the polyfill path by stubbing AbortSignal.any to undefined.
    const original = (AbortSignal as unknown as { any?: unknown }).any;
    (AbortSignal as unknown as { any?: unknown }).any = undefined;
    try {
      const internal = new AbortController();
      const external = new AbortController();
      const { signal, cleanup } = combineSignals(internal.signal, external.signal);
      const reason = new Error('explicit reason');
      external.abort(reason);
      expect(signal.aborted).toBe(true);
      // Propagated reason should match exactly — not a generic abort.
      expect(signal.reason).toBe(reason);
      cleanup();
    } finally {
      (AbortSignal as unknown as { any?: unknown }).any = original;
    }
  });

  it('handles already-aborted source through polyfill', () => {
    const original = (AbortSignal as unknown as { any?: unknown }).any;
    (AbortSignal as unknown as { any?: unknown }).any = undefined;
    try {
      const internal = new AbortController();
      const external = new AbortController();
      const reason = new Error('pre-aborted');
      external.abort(reason);
      const { signal, cleanup } = combineSignals(internal.signal, external.signal);
      expect(signal.aborted).toBe(true);
      expect(signal.reason).toBe(reason);
      cleanup();
    } finally {
      (AbortSignal as unknown as { any?: unknown }).any = original;
    }
  });
});

describe('isAbortError', () => {
  it('detects DOMException AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(isAbortError(err)).toBe(true);
  });

  it('detects DOMException TimeoutError', () => {
    const err = new Error('timed out');
    err.name = 'TimeoutError';
    expect(isAbortError(err)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError('string')).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

// Touch the imports so the linter sees them as used in fixtures.
vi.fn();
