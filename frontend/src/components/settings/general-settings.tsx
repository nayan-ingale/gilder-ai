'use client';

import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RadioGroup } from 'radix-ui';
import { useState } from 'react';
import { ContactEmail } from '@/components/legal/legal-page';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiFetch } from '@/lib/api';
import type { Profile } from '@/server/session';
import { chooseTheme } from '@/theme/apply-theme';
import { isTheme, type Theme } from '@/theme/theme-names';

const THEME_CHOICES: { theme: Theme; label: string; icon: typeof Sun }[] = [
  { theme: 'system', label: 'System', icon: Monitor },
  { theme: 'light', label: 'Light', icon: Sun },
  { theme: 'dark', label: 'Dark', icon: Moon },
];

const CARD = 'rounded-lg border border-line bg-surface p-[22px]';

/** The General tab: who is signed in, the theme, and logging out or deleting the account. */
export function GeneralSettings({ user }: { user: Profile }) {
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>(user.themePreference);
  const [leaving, setLeaving] = useState(false);
  const displayName = user.name ?? user.email;

  async function signOut() {
    setLeaving(true);
    try {
      await apiFetch('/auth/session', { method: 'DELETE' });
    } catch (error) {
      // Already signed out (401) is fine: the point is to end up on the sign-in page.
      if (!(error instanceof ApiError && error.status === 401)) {
        setLeaving(false);
        toast({
          title: 'Could not log out',
          description: 'Please try again.',
          tone: 'danger',
          ...(error instanceof ApiError && error.requestId ? { requestId: error.requestId } : {}),
        });
        return;
      }
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-7 pt-1">
      <section aria-labelledby="profile-title" className="flex flex-col gap-3.5">
        <h2 id="profile-title" className="text-lg text-fg">
          Profile
        </h2>
        <div className={`${CARD} flex flex-wrap items-center gap-4`}>
          <Avatar name={displayName} src={user.avatarUrl} className="size-14 text-base" />
          <div className="flex min-w-48 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-semibold text-fg">{displayName}</span>
            <span className="truncate text-sm text-fg-muted">{user.email}</span>
          </div>
          <span className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs font-medium text-fg-muted">
            Signed in with Google
          </span>
        </div>
      </section>

      <section aria-labelledby="appearance-title" className="flex flex-col gap-3.5">
        <h2 id="appearance-title" className="text-lg text-fg">
          Appearance
        </h2>
        <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span id="theme-label" className="text-sm font-medium text-fg">
              Theme
            </span>
            <span className="text-sm text-fg-muted">
              System follows your device. Your choice is saved to your account.
            </span>
          </div>
          <RadioGroup.Root
            value={theme}
            onValueChange={(value) => {
              if (isTheme(value)) {
                setTheme(value);
                void chooseTheme(value);
              }
            }}
            aria-labelledby="theme-label"
            orientation="horizontal"
            className="flex gap-0.5 rounded-md border border-line bg-sunken p-[3px]"
          >
            {THEME_CHOICES.map(({ theme: choice, label, icon: Icon }) => (
              <RadioGroup.Item
                key={choice}
                value={choice}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-transparent px-3.5 text-[13px] text-fg-muted hover:text-fg data-[state=checked]:border-line data-[state=checked]:bg-raised data-[state=checked]:font-medium data-[state=checked]:text-fg"
              >
                <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
        </div>
      </section>

      <section aria-labelledby="account-title" className="flex flex-col gap-3.5">
        <h2 id="account-title" className="text-lg text-fg">
          Account
        </h2>
        <div className={`${CARD} flex flex-col gap-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-fg">Log out</span>
              <span className="text-sm text-fg-muted">End your session on this device.</span>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={leaving}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-line-strong bg-raised px-4 text-sm font-medium text-fg hover:bg-sunken disabled:opacity-60"
            >
              <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              {leaving ? 'Logging out…' : 'Log out'}
            </button>
          </div>
          <div className="flex flex-col gap-0.5 border-t border-line pt-4">
            <span className="text-sm font-medium text-fg">Delete your account</span>
            <p className="text-sm leading-[1.55] text-fg-muted">
              To delete your account and all its data, email <ContactEmail />. The{' '}
              <Link
                href="/privacy"
                className="text-accent-text underline underline-offset-2 hover:no-underline"
              >
                Privacy Policy
              </Link>{' '}
              says what is kept and for how long.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
