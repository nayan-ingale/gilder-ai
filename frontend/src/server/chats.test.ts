import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = { value: 'gilder_sid=abc' };
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.value.includes(`${name}=`) ? { name, value: 'x' } : undefined,
    toString: () => cookieStore.value,
  }),
}));
const redirectMock = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }));

const { getChatWithHistory } = await import('./chats');
const CHAT_ID = '65f0c0ffee1234567890abcd';
let fetchMock: ReturnType<typeof vi.fn>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  process.env.GATEWAY_URL = 'http://gateway.test';
  cookieStore.value = 'gilder_sid=abc';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getChatWithHistory', () => {
  it('reads the chat and its messages from the gateway with the browser cookie', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/messages')
        ? json({ items: [{ id: 'm1' }], nextCursor: null })
        : json({ chat: { id: CHAT_ID, title: 'Goa' } }),
    );

    const result = await getChatWithHistory(CHAT_ID);

    expect(result).toMatchObject({ chat: { title: 'Goa' }, messages: { items: [{ id: 'm1' }] } });
    expect(fetchMock).toHaveBeenCalledWith(
      `http://gateway.test/api/chats/${CHAT_ID}`,
      expect.objectContaining({ headers: expect.objectContaining({ cookie: 'gilder_sid=abc' }) }),
    );
  });

  it('is null for a chat that is missing or not the user’s, and for an ID that cannot exist', async () => {
    fetchMock.mockResolvedValue(json({ detail: 'No such chat' }, 404));

    await expect(getChatWithHistory(CHAT_ID)).resolves.toBeNull();
    await expect(getChatWithHistory('../internal')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends a visitor without a session to /login', async () => {
    cookieStore.value = '';
    await expect(getChatWithHistory(CHAT_ID)).rejects.toThrow('redirect:/login');

    cookieStore.value = 'gilder_sid=old';
    fetchMock.mockResolvedValue(json({}, 401));
    await expect(getChatWithHistory(CHAT_ID)).rejects.toThrow('redirect:/login');
  });

  it('fails loudly when the gateway has a problem', async () => {
    fetchMock.mockResolvedValue(json({}, 503));

    await expect(getChatWithHistory(CHAT_ID)).rejects.toThrow('the gateway answered 503');
  });
});
