// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_EMAIL } from '@/components/legal/legal-page';
import { ToastProvider } from '@/components/ui/toast';
import type { Profile } from '@/server/session';
import { GeneralSettings } from './general-settings';

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const chooseTheme = vi.fn<(theme: string) => Promise<void>>(async () => {});
vi.mock('@/theme/apply-theme', () => ({ chooseTheme: (theme: string) => chooseTheme(theme) }));

const user: Profile = {
  id: 'u1',
  email: 'settings@example.com',
  name: 'Asha Rao',
  avatarUrl: null,
  themePreference: 'light',
};
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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

function renderSettings() {
  render(
    <ToastProvider>
      <GeneralSettings user={user} />
    </ToastProvider>,
  );
}

describe('GeneralSettings', () => {
  it('shows who is signed in, and how to delete the account', () => {
    renderSettings();

    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.getByText('settings@example.com')).toBeTruthy();
    expect(screen.getByText('Signed in with Google')).toBeTruthy();
    expect(screen.getByRole('link', { name: CONTACT_EMAIL }).getAttribute('href')).toBe(
      `mailto:${CONTACT_EMAIL}`,
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
  });

  it('marks the saved theme and applies a new one', async () => {
    renderSettings();
    const theme = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(screen.getByRole('radio', { name: 'Light' }).getAttribute('aria-checked')).toBe('true');

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(chooseTheme).toHaveBeenCalledWith('dark');
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    expect(theme).toBeTruthy();
  });

  it('logs out and goes to the sign-in page', async () => {
    renderSettings();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

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
    renderSettings();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });

  it('stays and says so when logging out fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 'internal_error', requestId: 'req-1' }), {
        status: 500,
      }),
    );
    renderSettings();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByText('Could not log out')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });
});
