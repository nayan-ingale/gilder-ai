'use client';

import { BarChart3, LogOut, Monitor, Moon, Receipt, SlidersHorizontal, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { ApiError, apiFetch } from '@/lib/api';
import { PLAN_NAMES } from '@/lib/billing';
import type { Profile } from '@/server/session';
import { useGetAccountQuery } from '@/store/api';
import { chooseTheme } from '@/theme/apply-theme';
import { isTheme, type Theme } from '@/theme/theme-names';

const THEME_CHOICES: { theme: Theme; label: string; icon: typeof Sun }[] = [
  { theme: 'system', label: 'System', icon: Monitor },
  { theme: 'light', label: 'Light', icon: Sun },
  { theme: 'dark', label: 'Dark', icon: Moon },
];

export interface AccountMenuProps {
  user: Profile;
  /** Just the avatar, for the small-screen top bar and the collapsed sidebar. */
  compact?: boolean;
}

/**
 * Who is signed in, with their plan, and the account menu: the theme, billing, usage and log out.
 */
export function AccountMenu({ user, compact = false }: AccountMenuProps) {
  const router = useRouter();
  const toast = useToast();
  const { data } = useGetAccountQuery();
  const [theme, setTheme] = useState<Theme>(user.themePreference);
  const displayName = user.name ?? user.email;

  async function signOut() {
    try {
      await apiFetch('/auth/session', { method: 'DELETE' });
    } catch (error) {
      // Already signed out (401) is fine: the point is to end up on the sign-in page.
      if (!(error instanceof ApiError && error.status === 401)) {
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

  const menu = (
    <DropdownMenuContent align="end" side="top" className="w-[248px] p-2">
      <DropdownMenuLabel>Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) => {
          if (isTheme(value)) {
            setTheme(value);
            void chooseTheme(value);
          }
        }}
        aria-label="Theme"
        className="mx-1 mb-1.5 flex gap-1 rounded-sm bg-sunken p-[3px]"
      >
        {THEME_CHOICES.map(({ theme: choice, label, icon: Icon }) => (
          <DropdownMenuRadioItem
            key={choice}
            value={choice}
            className="flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-sm border border-transparent text-[12.5px] text-fg-muted data-[highlighted]:text-fg data-[state=checked]:border-line data-[state=checked]:bg-raised data-[state=checked]:text-fg"
          >
            <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        icon={<Receipt size={16} strokeWidth={1.75} />}
        onSelect={() => router.push('/settings/billing')}
      >
        Billing
      </DropdownMenuItem>
      <DropdownMenuItem
        icon={<BarChart3 size={16} strokeWidth={1.75} />}
        onSelect={() => router.push('/settings/usage')}
      >
        Usage
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        icon={<LogOut size={16} strokeWidth={1.75} />}
        onSelect={() => void signOut()}
      >
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account: ${displayName}`}
          className="rounded-full p-0.5 hover:bg-sunken"
        >
          <Avatar name={displayName} src={user.avatarUrl} size="sm" />
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <div className="flex items-center gap-2.5 pt-1.5 pr-0.5 pl-1">
        <Avatar name={displayName} src={user.avatarUrl} size="sm" className="size-8 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-fg">{displayName}</span>
          <span className="block truncate text-xs text-fg-muted">
            {data ? `${PLAN_NAMES[data.account.plan]} plan` : user.email}
          </span>
        </span>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-raised hover:text-fg data-[state=open]:bg-raised"
        >
          <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
        </DropdownMenuTrigger>
      </div>
      {menu}
    </DropdownMenu>
  );
}
