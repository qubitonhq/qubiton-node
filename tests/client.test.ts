import { describe, expect, it, vi } from 'vitest';
import { QubitOnClient } from '../src/client';
import {
  ApiError,
  QubitonAbortError,
  QubitonAuthError,
  QubitonError,
  QubitonRateLimitError,
  QubitonServerError,
} from '../src/errors';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('QubitOnClient', () => {
  it('returns the parsed body on 2xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ taxValid: true }));
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch });
    const res = await client.validateTax({
      identityNumber: '1',
      identityNumberType: 'EIN',
      country: 'US',
    });
    expect(res.taxValid).toBe(true);
    expect(res.raw).toBe(res);
  });

  it('does not retry 501 responses', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'not implemented' }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch, maxRetries: 3 });
    await expect(
      client.screenContinuous({ entityName: 'x' }),
    ).rejects.toBeInstanceOf(QubitonServerError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('honours Retry-After on 429 (delta-seconds)', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('{}', { status: 429, headers: { 'retry-after': '0' } });
      }
      return jsonResponse({ ok: true });
    });
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch, maxRetries: 3 });
    const res = await client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' });
    expect(res).toBeDefined();
    expect(calls).toBe(2);
  });

  it('throws QubitonRateLimitError after exhausting retries on 429', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 429, headers: { 'retry-after': '0' } }),
    );
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch, maxRetries: 1 });
    await expect(
      client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' }),
    ).rejects.toBeInstanceOf(QubitonRateLimitError);
  });

  it('classifies 401 without OAuth as terminal QubitonAuthError', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }),
    );
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch });
    await expect(
      client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' }),
    ).rejects.toBeInstanceOf(QubitonAuthError);
    // No retry — single call.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws QubitonAbortError when caller aborts before sending', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true }));
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch });
    const ctrl = new AbortController();
    ctrl.abort(); // already-aborted signal — fast path
    await expect(
      client.validateTax(
        { identityNumber: '1', identityNumberType: 'EIN', country: 'US' },
        { signal: ctrl.signal },
      ),
    ).rejects.toBeInstanceOf(QubitonAbortError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('legacy ApiError instanceof works on QubitonError throw', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 500 }));
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch, maxRetries: 1 });
    try {
      await client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err instanceof QubitonError).toBe(true);
      // Bidirectional alias: legacy name should narrow too.
      expect(err instanceof ApiError).toBe(true);
    }
  });

  it('honours Retry-After on 429 (HTTP-date)', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        // HTTP-date in the past — parses to 0 delta, immediate retry.
        return new Response('{}', {
          status: 429,
          headers: { 'retry-after': new Date(Date.now() - 1000).toUTCString() },
        });
      }
      return jsonResponse({ ok: true });
    });
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch, maxRetries: 3 });
    const res = await client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' });
    expect(res).toBeDefined();
    expect(calls).toBe(2);
  });

  it('triggers a one-shot 401 auto-retry under OAuth before throwing', async () => {
    let tokenCalls = 0;
    let apiCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.endsWith('/api/oauth/token')) {
        tokenCalls += 1;
        return new Response(JSON.stringify({ token: `tok-${tokenCalls}`, expiresInSeconds: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      apiCalls += 1;
      // First API call returns 401 — second should re-fetch token then succeed.
      if (apiCalls === 1) {
        return new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } });
      }
      return jsonResponse({ taxValid: true });
    });
    const client = new QubitOnClient({
      clientId: 'k',
      clientSecret: 's',
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 3,
    });
    const res = await client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' });
    expect(res.taxValid).toBe(true);
    expect(apiCalls).toBe(2); // 1x 401 + 1x 200 — auth-retry didn't consume a retry slot.
    expect(tokenCalls).toBe(2); // token re-fetched after invalidation.
  });

  it('exposes a non-writable, non-configurable raw on object responses', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ taxValid: true }));
    const client = new QubitOnClient({ apiKey: 'k', fetch: fetchImpl as unknown as typeof fetch });
    const res = await client.validateTax({ identityNumber: '1', identityNumberType: 'EIN', country: 'US' });
    const desc = Object.getOwnPropertyDescriptor(res, 'raw');
    expect(desc?.writable).toBe(false);
    expect(desc?.configurable).toBe(false);
  });
});
