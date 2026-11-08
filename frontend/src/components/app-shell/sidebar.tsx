import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser } from '@/server/session';
import { AccountMenu } from './account-menu';
import { ThemeSync } from './theme-sync';

/** The sidebar frame: brand and New chat are static; the account part needs the session. */
export function SidebarFrame({ children }: { children: React.ReactNode }) {
  return (
    <aside
      aria-label="Sidebar"
      className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex"
    >
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="text-base font-semibold tracking-tight text-fg">
          GilderAi
        </Link>
      </div>
      <div className="px-3">
        <Link
          href="/"
          className="flex h-9 items-center gap-2 rounded-md border border-line bg-raised px-3 text-sm font-medium text-fg hover:bg-sunken"
        >
          <Plus size={16} aria-hidden="true" />
          New chat
        </Link>
      </div>
      <nav aria-label="Chats" className="mt-4 flex-1 overflow-y-auto px-3">
        <p className="px-2 text-xs text-fg-subtle">Your chats will appear here.</p>
      </nav>
      <div className="border-t border-line p-2">{children}</div>
    </aside>
  );
}

/** The top bar on small screens, where the sidebar is hidden: brand and the account menu. */
export function MobileBar({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-3 md:hidden">
      <Link href="/" className="text-base font-semibold tracking-tight text-fg">
        GilderAi
      </Link>
      {children}
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
    <div className="flex items-center gap-2 p-2" aria-label="Loading your account">
      <Skeleton className="size-7 rounded-full" />
      <Skeleton className="h-4 flex-1" />
    </div>
  );
}
