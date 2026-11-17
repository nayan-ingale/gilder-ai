'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiFetch } from '@/lib/api';
import { signInWithGooglePopup } from '@/lib/firebase-client';

export interface LoginFormProps {
  /** Whether the Firebase web config is set. Without it Google sign-in can't start. */
  googleReady: boolean;
  /** Shows the dev sign-in form. Only true in development builds. */
  devLogin: boolean;
}

export function LoginForm({ googleReady, devLogin }: LoginFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<'google' | 'dev' | null>(null);
  const [email, setEmail] = useState('');

  async function finish(start: () => Promise<unknown>, method: 'google' | 'dev') {
    setBusy(method);
    try {
      await start();
      router.replace('/');
      router.refresh();
    } catch (error) {
      // Closing the Google popup is a choice, not an error.
      if (error instanceof Error && 'code' in error && error.code === 'auth/popup-closed-by-user') {
        return;
      }
      toast({
        title: 'Could not sign in',
        description: error instanceof ApiError ? error.message : 'Please try again.',
        tone: 'danger',
        ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
      });
    } finally {
      setBusy(null);
    }
  }

  function signInWithGoogle() {
    void finish(async () => {
      const idToken = await signInWithGooglePopup();
      await apiFetch('/auth/session', { method: 'POST', json: { idToken } });
    }, 'google');
  }

  function signInAsDev(event: FormEvent) {
    event.preventDefault();
    void finish(() => apiFetch('/auth/dev-session', { method: 'POST', json: { email } }), 'dev');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={!googleReady || busy !== null}
          className="flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-line-strong bg-raised px-[18px] text-[15px] font-medium text-fg shadow-raised transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            aria-hidden="true"
            className="flex size-[22px] items-center justify-center rounded-full bg-fg text-[13px] font-bold text-canvas"
          >
            G
          </span>
          {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
        </button>
        {googleReady ? null : (
          <p className="mt-2 text-xs text-fg-subtle">
            Google sign-in is not set up on this server yet.
          </p>
        )}
      </div>
      <p className="text-[12.5px] leading-[1.55] text-fg-subtle">
        By continuing you agree to the{' '}
        <Link href="/terms" className="text-accent-text underline underline-offset-2">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-accent-text underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </p>
      <div aria-hidden="true" className="h-px bg-line" />
      <div className="flex items-start gap-2.5 text-[13px] leading-normal text-fg-muted">
        <Lock size={16} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Your session lives on our servers and ends the moment you log out. Payments go through
          Razorpay; we never see card details.
        </span>
      </div>

      {devLogin ? (
        <form onSubmit={signInAsDev} className="flex flex-col gap-2 border-t border-line pt-6">
          <label htmlFor="dev-email" className="text-sm font-medium text-fg">
            Dev sign-in
          </label>
          <p className="text-xs text-fg-subtle">
            Development only: signs in as any email, no password.
          </p>
          <Input
            id="dev-email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={busy !== null}>
            {busy === 'dev' ? 'Signing in…' : 'Sign in as this email'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
