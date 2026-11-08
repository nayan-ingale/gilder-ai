'use client';

import { Check, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiFetch } from '@/lib/api';
import type { Profile } from '@/server/session';
import { chooseTheme } from '@/theme/apply-theme';
import type { Theme } from '@/theme/theme-names';

const THEME_CHOICES: { theme: Theme; label: string; icon: typeof Sun }[] = [
  { theme: 'system', label: 'System', icon: Monitor },
  { theme: 'light', label: 'Light', icon: Sun },
  { theme: 'dark', label: 'Dark', icon: Moon },
];

export interface AccountMenuProps {
  user: Profile;
  /** Just the avatar, for the small-screen top bar. */
  compact?: boolean;
}

/** The account button at the bottom of the sidebar: who is signed in, theme, sign out. */
export function AccountMenu({ user, compact = false }: AccountMenuProps) {
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>(user.themePreference);
  const displayName = user.name ?? user.email;

  async function signOut() {
    try {
      await apiFetch('/auth/session', { method: 'DELETE' });
    } catch (error) {
      // Already signed out (401) is fine: the point is to end up on the sign-in page.
      if (!(error instanceof ApiError && error.status === 401)) {
        toast({
          title: 'Could not sign out',
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
    <DropdownMenu>
      {compact ? (
        <DropdownMenuTrigger
          aria-label={`Account: ${displayName}`}
          className="rounded-full p-0.5 hover:bg-sunken"
        >
          <Avatar name={displayName} src={user.avatarUrl} size="sm" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-sunken">
          <Avatar name={displayName} src={user.avatarUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{displayName}</span>
            {user.name ? (
              <span className="block truncate text-xs text-fg-subtle">{user.email}</span>
            ) : null}
          </span>
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {THEME_CHOICES.map(({ theme: choice, label, icon: Icon }) => (
          <DropdownMenuItem
            key={choice}
            icon={<Icon size={15} />}
            onSelect={() => {
              setTheme(choice);
              void chooseTheme(choice);
            }}
          >
            <span className="flex-1">{label}</span>
            {theme === choice ? (
              <Check size={15} aria-label="selected" className="text-accent" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut size={15} />} onSelect={() => void signOut()}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
