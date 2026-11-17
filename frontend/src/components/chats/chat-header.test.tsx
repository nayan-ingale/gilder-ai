// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import type { ChatSummary } from '@/lib/chats';
import { StoreProvider } from '@/store/store';
import { type ApiCall, json, mockApi } from '@/test/mock-api';
import { ChatHeader, dayLabel } from './chat-header';

const router = { push: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/c/65f0c0ffee1234567890aaaa',
}));

const CHAT: ChatSummary = {
  id: '65f0c0ffee1234567890aaaa',
  title: 'Goa trip',
  pinned: false,
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};
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
      call.method === 'PATCH' ? json({ chat: { ...CHAT, pinned: true } }) : json({ chat: CHAT }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('dayLabel', () => {
  it('says Today, Yesterday or the date', () => {
    const now = new Date(2026, 10, 17, 18, 0);

    expect(dayLabel(new Date(2026, 10, 17, 9, 0).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 16, 23, 30).toISOString(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 10, 12, 10, 0).toISOString(), now)).toBe('Nov 12');
  });
});

describe('ChatHeader', () => {
  it('shows the title, the day and the message count, and pins the chat', async () => {
    render(
      <StoreProvider>
        <ToastProvider>
          <ChatHeader chat={CHAT} messageCount={4} />
        </ToastProvider>
      </StoreProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeTruthy();
    expect(screen.getByText('Today · 4 messages')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Pin chat' }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'PATCH',
        path: `/api/chats/${CHAT.id}`,
        body: { pinned: true },
      }),
    );
  });

  it('renames the chat from its options menu', async () => {
    render(
      <StoreProvider>
        <ToastProvider>
          <ChatHeader chat={CHAT} messageCount={1} />
        </ToastProvider>
      </StoreProvider>,
    );

    expect(screen.getByText('Today · 1 message')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Chat options' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(await screen.findByRole('dialog', { name: 'Rename chat' })).toBeTruthy();
  });
});
