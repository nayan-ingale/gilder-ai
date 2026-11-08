import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { streamTurn, type TurnEvent, type TurnRequest } from './turns';

const sse = (events: [string, unknown][]) =>
  new Response(
    events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''),
    {
      headers: { 'content-type': 'text/event-stream' },
    },
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

async function collect(request: TurnRequest) {
  const events: TurnEvent[] = [];
  for await (const event of streamTurn(request, new AbortController().signal)) {
    events.push(event);
  }
  return events;
}

describe('streamTurn', () => {
  it('posts each kind of turn to its route and yields the events', async () => {
    const fetchMock = vi.fn(async () =>
      sse([
        ['token', { text: 'Hi' }],
        ['done', {}],
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const events = await collect({
      kind: 'send',
      chatId: 'c1',
      content: 'hey',
      clientMessageId: 'id-00001',
      agent: 'chat',
    });
    await collect({
      kind: 'regenerate',
      chatId: 'c1',
      messageId: 'm2',
      clientMessageId: 'id-00002',
    });
    await collect({
      kind: 'edit',
      chatId: 'c1',
      messageId: 'm1',
      content: 'new',
      clientMessageId: 'id-00003',
    });

    expect(events).toEqual([
      { event: 'token', data: { text: 'Hi' } },
      { event: 'done', data: {} },
    ]);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([path, init]) => [path, JSON.parse(String(init.body))])).toEqual([
      ['/api/chats/c1/messages', { content: 'hey', clientMessageId: 'id-00001', agent: 'chat' }],
      ['/api/chats/c1/messages/m2/regenerate', { clientMessageId: 'id-00002' }],
      ['/api/chats/c1/messages/m1/edit', { content: 'new', clientMessageId: 'id-00003' }],
    ]);
  });

  it('turns a refusal before the stream into an ApiError with the request ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            code: 'insufficient_credits',
            detail: 'This answer needs 1 credit; you have 0',
            requestId: 'req-9',
          },
          { status: 402 },
        ),
      ),
    );

    const failure = await collect({
      kind: 'send',
      chatId: 'c1',
      content: 'hey',
      clientMessageId: 'id-00001',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({
      status: 402,
      code: 'insufficient_credits',
      message: 'This answer needs 1 credit; you have 0',
      requestId: 'req-9',
    });
  });
});
