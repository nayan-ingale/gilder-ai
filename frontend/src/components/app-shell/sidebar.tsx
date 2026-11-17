import { SquarePen } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { CreditsCard } from '@/components/billing/credits-card';
import { SearchButton, SearchIconButton } from '@/components/chats/chat-commands';
import { ChatList } from '@/components/chats/chat-list';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser } from '@/server/session';
import { AccountMenu } from './account-menu';
import { Logo, Wordmark } from './brand';
import { MobileNav } from './mobile-nav';
import { MobileTitle } from './mobile-title';
import { SidebarToggle } from './sidebar-toggle';
import { ThemeSync } from './theme-sync';

/**
 * The sidebar: brand, New chat, search, the chat list, credits and the account. Collapsed, it is a
 * narrow rail with just the buttons; the account parts need the session, so they come in as props.
 */
export function SidebarFrame({
  account,
  railAccount,
}: {
  account: ReactNode;
  railAccount: ReactNode;
}) {
  return (
    <aside
      aria-label="Sidebar"
      className="hidden w-[272px] shrink-0 flex-col gap-1.5 border-r border-line bg-surface px-3 pt-3.5 pb-3 md:flex sidebar-collapsed:w-16 sidebar-collapsed:items-center sidebar-collapsed:px-2"
    >
      <div className="flex items-center gap-2.5 px-1 pt-0.5 pb-2 sidebar-collapsed:px-0">
        <Link
          href="/"
          aria-label="GilderAi home"
          className="flex items-center gap-2.5 rounded-sm sidebar-collapsed:hidden"
        >
          <Logo size={22} />
          <Wordmark className="text-xl" />
        </Link>
        <SidebarToggle className="ml-auto sidebar-collapsed:ml-0" />
      </div>

      <Link
        href="/"
        className="flex min-h-[42px] items-center gap-2.5 rounded-md border border-line bg-raised pr-2.5 pl-3 text-sm font-medium text-fg hover:bg-sunken sidebar-collapsed:hidden"
      >
        <SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="flex-1">New chat</span>
        <Kbd aria-hidden="true">⌘⇧O</Kbd>
      </Link>
      <Link
        href="/"
        aria-label="New chat"
        title="New chat"
        className="hidden size-10 items-center justify-center rounded-md border border-line bg-raised text-fg hover:bg-sunken sidebar-collapsed:flex"
      >
        <SquarePen size={18} strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <div className="sidebar-collapsed:hidden">
        <SearchButton />
      </div>
      <div className="hidden sidebar-collapsed:block">
        <SearchIconButton />
      </div>

      <nav
        aria-label="Chats"
        className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 sidebar-collapsed:hidden"
      >
        <ChatList />
      </nav>
      <div className="sidebar-collapsed:hidden">
        <CreditsCard />
      </div>
      <div className="sidebar-collapsed:hidden">{account}</div>
      <div className="mt-auto hidden sidebar-collapsed:block">{railAccount}</div>
    </aside>
  );
}

/**
 * The top bar on small screens, where the sidebar is hidden: the menu with the chats and the
 * account, the chat's title with the credits under it, and New chat.
 */
export function MobileBar({ account }: { account: ReactNode }) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-1 border-b border-line bg-canvas px-1.5 md:hidden">
      {/* Both read the current path, so each waits in its own Suspense boundary, with a same-size
          stand-in in the prerendered shell. */}
      <Suspense fallback={<span aria-hidden="true" className="size-11 shrink-0" />}>
        <MobileNav account={account} />
      </Suspense>
      <Suspense fallback={<span aria-hidden="true" className="flex-1" />}>
        <MobileTitle />
      </Suspense>
      <Link
        href="/"
        aria-label="New chat"
        title="New chat"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-fg hover:bg-sunken"
      >
        <SquarePen size={20} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </header>
  );
}

/** The signed-in part of the sidebar. Sends visitors without a valid session to /login. */
export async function SidebarAccount({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return (
    <>
      <ThemeSync theme={user.themePreference} />
      <AccountMenu user={user} compact={compact} />
    </>
  );
}

export function SidebarAccountSkeleton() {
  return (
    <div className="flex items-center gap-2.5 pt-1.5 pr-0.5 pl-1" aria-label="Loading your account">
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}
