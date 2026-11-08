import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { value: '' };
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.value.includes(`${name}=`) ? { name, value: 'x' } : undefined,
    toString: () => cookieStore.value,
  }),
}));

const { getCurrentUser } = await import('./session');
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.GATEWAY_URL = 'http://gateway.test';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCurrentUser', () => {
  it('asks the gateway for /api/me with the browser cookie', async () => {
    cookieStore.value = 'gilder_sid=abc; theme=dark';
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'u1', email: 'a@b.c' } }), { status: 200 }),
    );

    await expect(getCurrentUser()).resolves.toMatchObject({ id: 'u1' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://gateway.test/api/me',
      expect.objectContaining({
        headers: { cookie: 'gilder_sid=abc; theme=dark', 'x-gilder-client': 'web' },
      }),
    );
  });

  it('is null without a session cookie, without calling the gateway', async () => {
    cookieStore.value = 'theme=dark';

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is null when the session has ended', async () => {
    cookieStore.value = 'gilder_sid=old';
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('fails loudly when the gateway has a problem', async () => {
    cookieStore.value = 'gilder_sid=abc';
    fetchMock.mockResolvedValue(new Response('{}', { status: 503 }));

    await expect(getCurrentUser()).rejects.toThrow('the gateway answered 503 for /api/me');
  });
});
