// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import type { ChatMessage } from '@/lib/chats';
import { queueFirstMessage } from '@/store/pending-slice';
import { makeStore } from '@/store/store';
import { type ApiAnswer, type ApiCall, json, mockApi } from '@/test/mock-api';
import { Provider } from 'react-redux';
import { ChatThread } from './chat-thread';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const CHAT = '65f0c0ffee1234567890aaaa';
let calls: ApiCall[];
let answer: ApiAnswer;

/** A streamed answer: the events, optionally held open until `release` is called. */
function streamed(events: [string, unknown][], hold?: Promise<void>) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        for (const [index, [event, data]] of events.entries()) {
          if (hold && index === events.length - 1) {
            await hold;
          }
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
}

const happyAnswer = () =>
  streamed([
    ['meta', { turnId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' }],
    ['agent', { agent: 'chat', reason: 'router' }],
    ['token', { text: 'Hello ' }],
    ['token', { text: '**there**' }],
    ['usage', { creditsCharged: 1, balance: 99 }],
    ['done', {}],
  ]);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  calls = mockApi(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderThread(initialMessages: ChatMessage[] = [], store = makeStore()) {
  render(
    <Provider store={store}>
      <ToastProvider>
        <ChatThread chatId={CHAT} initialMessages={initialMessages} />
      </ToastProvider>
    </Provider>,
  );
  return store;
}

const account = (balance: number) =>
  json({ account: { plan: 'free', planExpiresAt: null, balance } });
const routes =
  (turn: () => Response, balance = 100): ApiAnswer =>
  (call) =>
    call.path === '/api/billing/account'
      ? account(balance)
      : call.method === 'POST' && call.path.startsWith('/api/chats/')
        ? turn()
        : json({ items: [], nextCursor: null });

describe('ChatThread', () => {
  it('shows the message at once, streams the answer as Markdown, and offers its actions', async () => {
    answer = routes(happyAnswer);
    renderThread();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi there{Enter}');

    const list = await screen.findByRole('list', { name: 'Messages' });
    await waitFor(() => expect(within(list).getByText('there').tagName).toBe('STRONG'));
    expect(within(list).getByText('Hi there')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Regenerate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    const send = calls.find((call) => call.path === `/api/chats/${CHAT}/messages`);
    expect(send?.body).toMatchObject({ content: 'Hi there' });
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty('value', '');
  });

  it('puts everything back and says why when the message is refused', async () => {
    answer = routes(() =>
      json(
        {
          code: 'insufficient_credits',
          detail: 'This answer needs 1 credit; you have 0',
          requestId: 'req-1',
        },
        402,
      ),
    );
    renderThread();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello{Enter}');

    expect(await screen.findByText('Out of credits')).toBeTruthy();
    expect(screen.getByText('This answer needs 1 credit; you have 0')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Messages' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty('value', 'Hello');
  });

  it('turns send into stop while writing, and stops on the server too', async () => {
    let release = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    answer = routes(() =>
      streamed(
        [
          ['meta', { turnId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' }],
          ['token', { text: 'Partial' }],
          ['done', {}],
        ],
        hold,
      ),
    );
    renderThread();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Long story{Enter}');
    await screen.findByText('Partial');
    await userEvent.click(screen.getByRole('button', { name: 'Stop the answer' }));

    await waitFor(() =>
      expect(calls.some((call) => call.path === '/api/turns/a1/stop')).toBe(true),
    );
    expect(await screen.findByText('Stopped')).toBeTruthy();
    act(() => release());
  });

  it('regenerates the latest answer in place', async () => {
    answer = routes(() =>
      streamed([
        ['meta', { turnId: 'a2', userMessageId: 'u1', assistantMessageId: 'a2' }],
        ['token', { text: 'A better answer' }],
        ['done', {}],
      ]),
    );
    const at = new Date().toISOString();
    const saved = (id: string, role: 'user' | 'assistant', content: string): ChatMessage => ({
      id,
      role,
      content,
      agent: role === 'assistant' ? 'chat' : null,
      status: 'complete',
      clientMessageId: null,
      attachments: [],
      fileRefs: [],
      artifacts: [],
      sources: [],
      citations: [],
      createdAt: at,
    });
    renderThread([saved('u1', 'user', 'Tell me a joke'), saved('a1', 'assistant', 'A weak joke')]);

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    expect(await screen.findByText('A better answer')).toBeTruthy();
    expect(screen.queryByText('A weak joke')).toBeNull();
    expect(calls.some((call) => call.path === `/api/chats/${CHAT}/messages/a1/regenerate`)).toBe(
      true,
    );
  });

  it('sends the first message typed on the new-chat page as soon as the chat opens', async () => {
    answer = routes(happyAnswer);
    const store = makeStore();
    store.dispatch(
      queueFirstMessage({
        chatId: CHAT,
        content: 'From the new chat page',
        clientMessageId: 'first-0001',
      }),
    );

    renderThread([], store);

    expect(await screen.findByText('From the new chat page')).toBeTruthy();
    await waitFor(() =>
      expect(calls.filter((call) => call.path === `/api/chats/${CHAT}/messages`)).toHaveLength(1),
    );
    expect(calls.find((call) => call.path === `/api/chats/${CHAT}/messages`)?.body).toMatchObject({
      clientMessageId: 'first-0001',
    });
    expect(store.getState().pending[CHAT]).toBeUndefined();
  });

  it('warns and blocks sending when the user is out of credits', async () => {
    answer = routes(happyAnswer, 0);
    renderThread();

    expect(await screen.findByText(/You are out of credits/)).toBeTruthy();
    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    expect(screen.getByRole('button', { name: 'Send' })).toHaveProperty('disabled', true);
  });
});

describe('attachments', () => {
  it('uploads an attached image, then sends its ID with the message', async () => {
    const stored: string[] = [];
    answer = (call) => {
      if (call.url?.startsWith('https://bucket')) {
        stored.push(call.url);
        return new Response(null, { status: 204 });
      }
      if (call.path === '/api/billing/account') {
        return account(100);
      }
      if (call.path === '/api/files/uploads') {
        return json(
          {
            file: { id: 'file-1', name: 'cat.png', status: 'pending', purpose: 'image' },
            upload: {
              url: 'https://bucket.s3.amazonaws.com/',
              fields: { key: 'users/u1/uploads/file-1' },
            },
          },
          201,
        );
      }
      if (call.path === '/api/files/file-1/complete') {
        return json({ file: { id: 'file-1', name: 'cat.png', status: 'ready', purpose: 'image' } });
      }
      if (call.path === '/api/files/file-1') {
        return json({
          file: { id: 'file-1', name: 'cat.png', status: 'ready', purpose: 'image' },
          indexing: null,
        });
      }
      if (call.method === 'POST' && call.path === `/api/chats/${CHAT}/messages`) {
        return happyAnswer();
      }
      return json({ items: [], nextCursor: null });
    };
    renderThread();

    const picker = document.querySelector('input[type=file]') as HTMLInputElement;
    await userEvent.upload(picker, new File(['png'], 'cat.png', { type: 'image/png' }));
    const chips = await screen.findByRole('list', { name: 'Attached files' });
    await waitFor(() => expect(within(chips).queryByText('Uploading…')).toBeNull());

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'What is this?{Enter}');

    await waitFor(() =>
      expect(calls.find((call) => call.path === `/api/chats/${CHAT}/messages`)?.body).toMatchObject(
        {
          content: 'What is this?',
          attachments: ['file-1'],
        },
      ),
    );
    expect(stored).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'cat.png' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Attached files' })).toBeNull();
  });
});

describe('generated files', () => {
  it('shows progress while a file is made, then the file to download', async () => {
    let release = () => {};
    const hold = new Promise<void>((resolve) => (release = resolve));
    answer = (call) => {
      if (call.path === '/api/billing/account') {
        return account(100);
      }
      if (call.path === '/api/files/gen-1') {
        return json({
          file: { id: 'gen-1', name: 'packing-list.pdf', purpose: 'pdf', status: 'ready' },
          indexing: null,
        });
      }
      if (call.method === 'POST' && call.path === `/api/chats/${CHAT}/messages`) {
        return streamed(
          [
            ['meta', { turnId: 'a1', userMessageId: 'u1', assistantMessageId: 'a1' }],
            ['agent', { agent: 'pdf', reason: 'shortcut' }],
            ['progress', { step: 'Laying out the pages', current: 2, total: 3 }],
            ['token', { text: 'Here is your PDF.' }],
            [
              'file',
              {
                fileId: 'gen-1',
                kind: 'pdf',
                name: 'packing-list.pdf',
                url: 'https://x',
                expiresAt: '',
              },
            ],
            ['done', {}],
          ],
          hold,
        );
      }
      return json({ items: [], nextCursor: null });
    };
    renderThread();

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Message' }),
      '/pdf packing list{Enter}',
    );

    // A job card: the step, a progress bar and the steps so far.
    expect(await screen.findByText('Creating your PDF')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: 'Progress' }).getAttribute('aria-valuenow'),
    ).toBe('67');
    expect(screen.getByText('Laying out the pages')).toBeTruthy();
    expect(screen.getByText('10 credits reserved')).toBeTruthy();
    act(() => release());
    expect(await screen.findByText('packing-list.pdf')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download packing-list.pdf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open packing-list.pdf' })).toBeTruthy();
    expect(screen.queryByText('Creating your PDF')).toBeNull();
  });
});

/** A stream the test writes to event by event, then ends. */
function liveStream() {
  const encoder = new TextEncoder();
  let output!: ReadableStreamDefaultController<Uint8Array>;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        output = controller;
      },
    }),
    { headers: { 'content-type': 'text/event-stream' } },
  );
  return {
    response,
    send: (...events: [string, unknown][]) =>
      output.enqueue(
        encoder.encode(
          events
            .map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            .join(''),
        ),
      ),
    end: () => output.close(),
  };
}

/**
 * The thread inside a <main> that scrolls like a browser's: 500px tall, as tall inside as
 * `size.content`, scrollTop kept within range, and a scroll event on every change.
 */
function renderInScroller(size: { content: number }) {
  render(
    <Provider store={makeStore()}>
      <ToastProvider>
        <main data-testid="scroller">
          <ChatThread chatId={CHAT} initialMessages={[]} />
        </main>
      </ToastProvider>
    </Provider>,
  );
  const scroller = screen.getByTestId('scroller');
  let top = 0;
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, get: () => 500 });
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, get: () => size.content });
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      const next = Math.max(0, Math.min(value, size.content - 500));
      if (next !== top) {
        top = next;
        scroller.dispatchEvent(new Event('scroll'));
      }
    },
  });
  return scroller;
}

describe('following the answer', () => {
  it('keeps the newest text in view however fast it grows, until the reader scrolls up', async () => {
    const stream = liveStream();
    answer = routes(() => stream.response);
    const intoView = vi.spyOn(Element.prototype, 'scrollIntoView');
    const size = { content: 1000 };
    const scroller = renderInScroller(size);

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi{Enter}');
    stream.send(
      ['meta', { turnId: 't1', userMessageId: 'u1', assistantMessageId: 'a1' }],
      ['token', { text: 'First words.' }],
    );
    expect(await screen.findByText('First words.')).toBeTruthy();
    expect(scroller.scrollTop).toBe(500);

    // The text grew faster than scroll events arrive: the next one finds the view far from
    // the end. That is not the reader scrolling, so the thread keeps following.
    size.content = 3000;
    scroller.dispatchEvent(new Event('scroll'));
    stream.send(['token', { text: ' More.' }]);
    expect(await screen.findByText('First words. More.')).toBeTruthy();
    expect(scroller.scrollTop).toBe(2500);

    // The reader scrolls up to read: new text no longer moves the view.
    scroller.scrollTop = 800;
    size.content = 3500;
    stream.send(['token', { text: ' Even more.' }]);
    expect(await screen.findByText('First words. More. Even more.')).toBeTruthy();
    expect(scroller.scrollTop).toBe(800);

    // Back near the end, it follows again.
    scroller.scrollTop = 2950;
    stream.send(['token', { text: ' Done.' }], ['done', {}]);
    stream.end();
    expect(await screen.findByRole('button', { name: 'Regenerate' })).toBeTruthy();
    expect(scroller.scrollTop).toBe(3000);
    // Only the conversation scrolls, never the page around it.
    expect(intoView).not.toHaveBeenCalled();
  });
});

describe('streamed words', () => {
  it('adds the words that arrive together in one update, before the next frame', async () => {
    const stream = liveStream();
    answer = routes(() => stream.response);
    const frames = vi.spyOn(window, 'requestAnimationFrame');
    renderThread();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi{Enter}');
    const before = frames.mock.calls.length;
    stream.send(
      ['token', { text: 'One ' }],
      ['token', { text: 'two ' }],
      ['token', { text: 'three ' }],
      ['token', { text: 'four.' }],
    );

    expect(await screen.findByText('One two three four.')).toBeTruthy();
    expect(frames.mock.calls.length - before).toBe(1);
    stream.send(['done', {}]);
    stream.end();
  });

  it('keeps the words that came before a failure, in order', async () => {
    const stream = liveStream();
    answer = routes(() => stream.response);
    renderThread();

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Hi{Enter}');
    stream.send(
      ['token', { text: 'Half an ' }],
      ['token', { text: 'answer' }],
      ['error', { code: 'provider_failed', message: 'The model stopped answering' }],
    );
    stream.end();

    expect(await screen.findByText('Half an answer')).toBeTruthy();
    expect(await screen.findByText('The answer failed')).toBeTruthy();
  });
});
