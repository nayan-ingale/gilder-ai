import type { Metadata } from 'next';
import { googleSignInConfigured } from '@/lib/firebase-client';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl text-fg">Sign in to GilderAi</h1>
        <p className="mt-1 text-sm text-fg-muted">Chat, search, code and documents in one place.</p>
        <div className="mt-8">
          {/* Dev sign-in exists only in development builds; production builds don't contain it. */}
          <LoginForm
            googleReady={googleSignInConfigured}
            devLogin={process.env.NODE_ENV === 'development'}
          />
        </div>
      </div>
    </main>
  );
}
