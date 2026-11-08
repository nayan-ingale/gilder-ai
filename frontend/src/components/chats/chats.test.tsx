// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import type { ChatSummary } from '@/lib/chats';
import { StoreProvider } from '@/store/store';
import { type ApiAnswer, type ApiCall, json, mockApi } from '@/test/mock-api';
import { ChatCommands } from './chat-commands';
import { ChatList } from './chat-list';

const router = { push: vi.fn() };
const pathname = { value: '/' };
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => pathname.value }));

const ID_A = '65f0c0ffee1234567890aaaa';
const ID_B = '65f0c0ffee1234567890bbbb';

function chat(id: string, title: string, pinned = false): ChatSummary {
  const at = new Date().toISOString();
  return { id, title, pinned, lastMessageAt: at, createdAt: at };
}

let calls: ApiCall[];
let answer: ApiAnswer;

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
  pathname.value = '/';
  calls = mockApi(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderWithStore(children: ReactNode) {
  render(
    <StoreProvider>
      <ToastProvider>{children}</ToastProvider>
    </StoreProvider>,
  );
}

describe('ChatList', () => {
  it('shows the chats grouped, and an empty state when there are none', async () => {
    answer = () =>
      json({ items: [chat(ID_A, 'Pinned plan', true), chat(ID_B, 'Goa')], nextCursor: null });
    renderWithStore(<ChatList />);

    const pinned = await screen.findByRole('region', { name: 'Pinned' });
    expect(within(pinned).getByRole('link', { name: 'Pinned plan' }).getAttribute('href')).toBe(
      `/c/${ID_A}`,
    );
    expect(within(screen.getByRole('region', { name: 'Today' })).getByText('Goa')).toBeTruthy();
    cleanup();

    answer = () => json({ items: [], nextCursor: null });
    renderWithStore(<ChatList />);
    expect(await screen.findByText(/No chats yet/)).toBeTruthy();
  });

  it('marks the open chat and loads more pages on request', async () => {
    pathname.value = `/c/${ID_B}`;
    answer = ({ path }) =>
      path.includes('cursor=next')
        ? json({ items: [chat(ID_B, 'Older chat')], nextCursor: null })
        : json({ items: [chat(ID_A, 'First')], nextCursor: 'next' });
    renderWithStore(<ChatList />);

    await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    const open = await screen.findByRole('link', { name: 'Older chat' });
    expect(open.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('renames a chat from its menu', async () => {
    let title = 'Goa';
    answer = ({ method, body }) => {
      if (method === 'PATCH') {
        title = (body as { title: string }).title;
        return json({ chat: chat(ID_A, title) });
      }
      return json({ items: [chat(ID_A, title)], nextCursor: null });
    };
    renderWithStore(<ChatList />);

    await userEvent.click(await screen.findByRole('button', { name: 'Options for Goa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    // The dialog opens once the menu has closed and returned focus, a tick later.
    const field = await screen.findByRole('textbox', { name: 'Title' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Goa trip{Enter}');

    expect(await screen.findByRole('link', { name: 'Goa trip' })).toBeTruthy();
    expect(calls).toContainEqual({
      method: 'PATCH',
      path: `/api/chats/${ID_A}`,
      body: { title: 'Goa trip' },
    });
  });

  it('pins a chat, and puts it back with a message when the call fails', async () => {
    answer = ({ method }) =>
      method === 'PATCH'
        ? json({ detail: 'No such chat', requestId: 'req-1' }, 404)
        : json({ items: [chat(ID_A, 'Goa')], nextCursor: null });
    renderWithStore(<ChatList />);

    await userEvent.click(await screen.findByRole('button', { name: 'Options for Goa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Pin' }));

    expect(await screen.findByText('Could not pin the chat')).toBeTruthy();
    expect(screen.getByText('No such chat')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pinned' })).toBeNull());
  });

  it('deletes the open chat after confirming, and goes to a new chat', async () => {
    pathname.value = `/c/${ID_A}`;
    let deleted = false;
    answer = ({ method }) => {
      if (method === 'DELETE') {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      return json({ items: deleted ? [] : [chat(ID_A, 'Goa')], nextCursor: null });
    };
    renderWithStore(<ChatList />);

    await userEvent.click(await screen.findByRole('button', { name: 'Options for Goa' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete chat?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'));
    expect(await screen.findByText(/No chats yet/)).toBeTruthy();
  });
});

describe('search (⌘K)', () => {
  it('opens with the shortcut, searches as you type, and opens a result with Enter', async () => {
    answer = ({ path }) =>
      path.startsWith('/api/chats?query=')
        ? json({
            items: [chat(ID_B, 'Goa villa taxes'), chat(ID_A, 'Trip to Goa')],
            nextCursor: null,
          })
        : json({ items: [chat(ID_A, 'Trip to Goa')], nextCursor: null });
    renderWithStore(
      <ChatCommands>
        <p>page</p>
      </ChatCommands>,
    );

    await userEvent.keyboard('{Control>}k{/Control}');
    const box = await screen.findByRole('combobox', { name: 'Search chats' });
    expect(await screen.findByRole('option', { name: 'Trip to Goa' })).toBeTruthy();

    await userEvent.type(box, 'goa');
    await screen.findByRole('option', { name: 'Goa villa taxes' });
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(router.push).toHaveBeenCalledWith(`/c/${ID_A}`);
    expect(calls.some((call) => call.path === '/api/chats?query=goa')).toBe(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('starts a new chat with ⌘⇧O', async () => {
    answer = () => json({ items: [], nextCursor: null });
    renderWithStore(
      <ChatCommands>
        <p>page</p>
      </ChatCommands>,
    );

    await userEvent.keyboard('{Meta>}{Shift>}o{/Shift}{/Meta}');

    expect(router.push).toHaveBeenCalledWith('/');
  });
});
