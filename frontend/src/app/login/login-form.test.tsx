// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast';
import { LoginForm, type LoginFormProps } from './login-form';

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const signInWithGooglePopup = vi.fn();
vi.mock('@/lib/firebase-client', () => ({ signInWithGooglePopup: () => signInWithGooglePopup() }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderForm(props: Partial<LoginFormProps> = {}) {
  render(
    <ToastProvider>
      <LoginForm googleReady devLogin {...props} />
    </ToastProvider>,
  );
}

describe('LoginForm', () => {
  it('signs in with Google: sends the ID token, then goes home', async () => {
    signInWithGooglePopup.mockResolvedValue('firebase-id-token');
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ method: 'POST', body: '{"idToken":"firebase-id-token"}' }),
    );
  });

  it('disables Google sign-in and says why when it is not set up', () => {
    renderForm({ googleReady: false });

    expect(
      (screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText('Google sign-in is not set up on this server yet.')).toBeTruthy();
  });

  it('signs in as a dev email', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Dev sign-in'), 'dev@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in as this email' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/dev-session',
      expect.objectContaining({ body: '{"email":"dev@example.com"}' }),
    );
  });

  it('links the Terms and the Privacy Policy under the Google button', () => {
    renderForm({ devLogin: false });

    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe(
      '/privacy',
    );
    expect(screen.getByText(/we never see card details/)).toBeTruthy();
  });

  it('has no dev sign-in when it is off', () => {
    renderForm({ devLogin: false });

    expect(screen.queryByLabelText('Dev sign-in')).toBeNull();
  });

  it('shows a toast with the request reference when sign-in fails', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'unauthorized',
          detail: 'The Google sign-in is not valid. Sign in again.',
          requestId: 'abcd1234-ffff',
        }),
        { status: 401 },
      ),
    );
    signInWithGooglePopup.mockResolvedValue('bad-token');
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByText('The Google sign-in is not valid. Sign in again.')).toBeTruthy();
    expect(screen.getByText('abcd1234').closest('p')?.textContent).toBe('Reference: abcd1234');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('stays quiet when the user closes the Google popup', async () => {
    signInWithGooglePopup.mockRejectedValue(
      Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' }),
    );
    renderForm();

    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Continue with Google' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    expect(screen.queryByText('Could not sign in')).toBeNull();
  });
});
