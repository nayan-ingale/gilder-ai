// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { StoreProvider } from '@/store/store';
import { json, mockApi } from '@/test/mock-api';
import type { Profile } from '@/server/session';
import { AccountMenu } from './account-menu';

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const chooseTheme = vi.fn<(theme: string) => Promise<void>>(async () => {});
vi.mock('@/theme/apply-theme', () => ({ chooseTheme: (theme: string) => chooseTheme(theme) }));

const user: Profile = {
  id: 'u1',
  email: 'nayan@example.com',
  name: 'Nayan Ingale',
  avatarUrl: null,
  themePreference: 'system',
};
let fetchMock: ReturnType<typeof vi.fn>;

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
  fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderMenu() {
  render(
    <StoreProvider>
      <ToastProvider>
        <AccountMenu user={user} />
      </ToastProvider>
    </StoreProvider>,
  );
}

function openMenu() {
  renderMenu();
  return userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
}

describe('AccountMenu', () => {
  it('shows who is signed in, with the email until the plan has loaded', () => {
    renderMenu();

    expect(screen.getByText('Nayan Ingale')).toBeTruthy();
    expect(screen.getByText('nayan@example.com')).toBeTruthy();
  });

  it('shows the plan under the name once billing answers', async () => {
    mockApi(
      () => (call) =>
        call.path === '/api/billing/account'
          ? json({ account: { plan: 'starter', planExpiresAt: null, balance: 40 } })
          : new Response(null, { status: 204 }),
    );
    renderMenu();

    expect(await screen.findByText('Starter plan')).toBeTruthy();
  });

  it('changes the theme and marks the current choice', async () => {
    await openMenu();
    expect(screen.getByRole('menuitemradio', { name: 'System' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Dark' }));

    expect(chooseTheme).toHaveBeenCalledWith('dark');
    // Picking a theme keeps the menu open, with the new choice marked.
    expect(screen.getByRole('menuitemradio', { name: 'Dark' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('logs out and goes to the sign-in page', async () => {
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('still goes to the sign-in page when the session had already ended', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 }),
    );
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
});
