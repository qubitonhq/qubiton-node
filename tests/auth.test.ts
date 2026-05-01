import { describe, expect, it, vi } from 'vitest';
import { OAuthTokenManager } from '../src/auth';

describe('OAuthTokenManager', () => {
  it('caches tokens with the full skew on long TTLs', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'tok-1', expiresInSeconds: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const mgr = new OAuthTokenManager('k', 's', 'https://example/token', '1.0.0', fakeFetch as unknown as typeof fetch);

    const t1 = await mgr.getToken();
    const t2 = await mgr.getToken();
    expect(t1).toBe('tok-1');
    expect(t2).toBe('tok-1');
    // Two getToken calls, but only one network refresh.
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT loop on short-TTL tokens (skew clamped to expiresInMs/2)', async () => {
    // 10-second TTL — full 30 s skew would have made the token "already
    // expired" on cache write, looping forever.
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'short', expiresInSeconds: 10 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const mgr = new OAuthTokenManager('k', 's', 'https://example/token', '1.0.0', fakeFetch as unknown as typeof fetch);

    await mgr.getToken();
    await mgr.getToken();
    await mgr.getToken();
    // Only one fetch — cache stayed valid.
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('throws QubitonAuthError on 401 from the token endpoint', async () => {
    const fakeFetch = vi.fn(
      async () => new Response('{}', { status: 401, headers: { 'content-type': 'application/json' } }),
    );
    const mgr = new OAuthTokenManager('k', 's', 'https://example/token', '1.0.0', fakeFetch as unknown as typeof fetch);
    await expect(mgr.getToken()).rejects.toThrow(/invalid key or secret/);
  });

  it('wraps body-read errors as QubitonError, not raw Error', async () => {
    const fakeFetch = vi.fn(async () => {
      const failingResp = {
        status: 200,
        ok: true,
        async json() {
          throw new TypeError('terminated');
        },
      };
      return failingResp as unknown as Response;
    });
    const mgr = new OAuthTokenManager('k', 's', 'https://example/token', '1.0.0', fakeFetch as unknown as typeof fetch);
    await expect(mgr.getToken()).rejects.toMatchObject({ name: 'QubitonError' });
  });

  it('shares a single in-flight refresh across concurrent getToken() callers', async () => {
    let pending: ((v: Response) => void) | undefined;
    const fakeFetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pending = resolve;
        }),
    );
    const mgr = new OAuthTokenManager('k', 's', 'https://example/token', '1.0.0', fakeFetch as unknown as typeof fetch);

    // Three concurrent callers — only ONE network refresh should happen.
    const p1 = mgr.getToken();
    const p2 = mgr.getToken();
    const p3 = mgr.getToken();

    pending?.(
      new Response(JSON.stringify({ token: 'tok-shared', expiresInSeconds: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const results = await Promise.all([p1, p2, p3]);
    expect(results).toEqual(['tok-shared', 'tok-shared', 'tok-shared']);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });
});
