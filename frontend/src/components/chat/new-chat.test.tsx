// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { peekQueuedFiles } from '@/lib/pending-files';
import { makeStore } from '@/store/store';
import { type ApiCall, json, mockApi } from '@/test/mock-api';
import { Greeting, NewChatComposer } from './new-chat';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

let calls: ApiCall[];

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
  calls = mockApi(
    () => (call) =>
      call.path === '/api/billing/account'
        ? json({ account: { plan: 'free', planExpiresAt: null, balance: 100 } })
        : call.method === 'POST' && call.path === '/api/chats'
          ? json({ chat: { id: '65f0c0ffee1234567890bbbb', title: 'New chat' } }, 201)
          : json({}),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderComposer() {
  render(
    <Provider store={makeStore()}>
      <ToastProvider>
        <NewChatComposer />
      </ToastProvider>
    </Provider>,
  );
}

describe('Greeting', () => {
  it('greets by the time of day and the first name', () => {
    render(<Greeting name="Nayan Ingale" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /^Good (morning|afternoon|evening), Nayan$/,
    );
  });

  it('greets without a name when there is none', () => {
    render(<Greeting name={null} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/^Good \w+$/);
  });
});

describe('NewChatComposer', () => {
  it('fills the box and picks the agent from a suggestion', async () => {
    renderComposer();

    await userEvent.click(screen.getByRole('button', { name: /Research a topic with sources/ }));

    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveProperty(
      'value',
      'What are the latest developments in ',
    );
    expect(screen.getByRole('button', { name: 'Agent: Search' })).toBeTruthy();
  });

  it('lists every agent with its cost, and switches with a click', async () => {
    renderComposer();

    await userEvent.click(screen.getByRole('button', { name: 'Agent: Auto' }));
    const code = screen.getByRole('menuitemradio', { name: /Code/ });
    expect(code.textContent).toContain('10 credits');
    expect(screen.getByRole('menuitemradio', { name: /Chat/ }).textContent).toContain('1 credit');
    await userEvent.click(code);

    expect(screen.getByRole('button', { name: 'Agent: Code' })).toBeTruthy();
  });

  it('starts the chat when a file is attached and hands the file and text over', async () => {
    renderComposer();
    const file = new File(['%PDF-1.4'], 'lease.pdf', { type: 'application/pdf' });

    await userEvent.type(screen.getByRole('textbox', { name: 'Message' }), 'Summarise this');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    await userEvent.upload(input!, file);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/c/65f0c0ffee1234567890bbbb'));
    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/chats')).toBe(true);
    expect(peekQueuedFiles('65f0c0ffee1234567890bbbb')).toEqual({
      files: [file],
      draft: 'Summarise this',
    });
  });
});

describe('dictation', () => {
  it('types what is said after the words already in the box, and stops on a second press', async () => {
    const recognizers: FakeRecognizer[] = [];
    class FakeRecognizer {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: ((event: unknown) => void) | null = null;
      onerror = null;
      onend: (() => void) | null = null;
      constructor() {
        recognizers.push(this);
      }
      start() {}
      stop() {
        this.onend?.();
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognizer);
    renderComposer();
    const box = screen.getByRole('textbox', { name: 'Message' });
    await userEvent.type(box, 'Plan');

    await userEvent.click(screen.getByRole('button', { name: 'Dictate a message' }));
    recognizers[0]!.onresult!({
      results: { length: 1, 0: { isFinal: false, 0: { transcript: 'a trip' } } },
    });

    await waitFor(() => expect(box).toHaveProperty('value', 'Plan a trip'));
    await userEvent.click(screen.getByRole('button', { name: 'Stop dictating' }));
    expect(screen.getByRole('button', { name: 'Dictate a message' })).toBeTruthy();
  });

  it('hides the mic where the browser has no speech recognition', () => {
    renderComposer();

    expect(screen.queryByRole('button', { name: 'Dictate a message' })).toBeNull();
  });
});
