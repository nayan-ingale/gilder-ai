// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
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

function openMenu() {
  render(
    <ToastProvider>
      <AccountMenu user={user} />
    </ToastProvider>,
  );
  return userEvent.click(screen.getByRole('button', { name: /Nayan Ingale/ }));
}

describe('AccountMenu', () => {
  it('shows who is signed in', () => {
    render(
      <ToastProvider>
        <AccountMenu user={user} />
      </ToastProvider>,
    );

    expect(screen.getByText('Nayan Ingale')).toBeTruthy();
    expect(screen.getByText('nayan@example.com')).toBeTruthy();
  });

  it('changes the theme and marks the current choice', async () => {
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /Dark/ }));

    expect(chooseTheme).toHaveBeenCalledWith('dark');
    await userEvent.click(screen.getByRole('button', { name: /Nayan Ingale/ }));
    expect(
      screen.getByRole('menuitem', { name: /Dark/ }).querySelector('[aria-label="selected"]'),
    ).not.toBeNull();
  });

  it('signs out and goes to the sign-in page', async () => {
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

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
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
});
