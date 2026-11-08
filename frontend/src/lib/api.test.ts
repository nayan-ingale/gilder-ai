import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status: number, body?: unknown, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn(
    async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiFetch', () => {
  it('calls /api with a JSON body and returns the JSON answer', async () => {
    const fetchMock = answer(200, { user: { id: 'u1' } });

    const result = await apiFetch('/me', { method: 'PATCH', json: { themePreference: 'dark' } });

    expect(result).toEqual({ user: { id: 'u1' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{"themePreference":"dark"}',
    });
  });

  it('returns undefined for 204', async () => {
    answer(204);
    await expect(apiFetch('/auth/session', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('turns problem+json into an ApiError with the code, message and request ID', async () => {
    answer(401, { code: 'unauthorized', detail: 'Sign in first', requestId: 'req-1' });

    const error = await apiFetch('/me').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 401,
      code: 'unauthorized',
      message: 'Sign in first',
      requestId: 'req-1',
    });
  });

  it('falls back to the title and the X-Request-Id header', async () => {
    answer(
      503,
      { code: 'service_unavailable', title: 'Service unavailable' },
      { 'x-request-id': 'req-2' },
    );

    await expect(apiFetch('/me')).rejects.toMatchObject({
      message: 'Service unavailable',
      requestId: 'req-2',
    });
  });

  it('reports a network failure clearly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 0, code: 'network_error' });
  });
});
