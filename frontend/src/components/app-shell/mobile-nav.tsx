'use client';

import { Menu, SquarePen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type MouseEvent, type ReactNode, useState } from 'react';
import { CreditsCard } from '@/components/billing/credits-card';
import { SearchButton } from '@/components/chats/chat-commands';
import { ChatList } from '@/components/chats/chat-list';
import { Logo, Wordmark } from './brand';

/**
 * The chats on small screens, where the sidebar is hidden: a panel that slides in from the left
 * with New chat, search, the chat list, the credits and the account. It closes when a link or the
 * search button inside it is used.
 */
export function MobileNav({ account }: { account: ReactNode }) {
  const pathname = usePathname();
  // Open only on the page it was opened on, so going to another page (from a link or the account
  // menu) closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  function closeOnNavigate(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('a, [data-closes-nav]')) {
      setOpen(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Open chats"
        title="Open chats"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-fg hover:bg-sunken"
      >
        <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[min(85vw,18rem)] flex-col gap-1.5 border-r border-line bg-surface px-3 pt-3.5 pb-3 shadow-raised md:hidden"
          onClick={closeOnNavigate}
        >
          <DialogPrimitive.Title className="flex items-center gap-2.5 px-1 pt-0.5 pb-2">
            <Logo size={22} />
            <Wordmark className="text-xl" />
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Your chats, search, a new chat and your account.
          </DialogPrimitive.Description>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-md border border-line bg-raised pr-2.5 pl-3 text-sm font-medium text-fg hover:bg-sunken"
          >
            <SquarePen size={16} strokeWidth={1.75} aria-hidden="true" />
            New chat
          </Link>
          <SearchButton />
          <nav aria-label="Chats" className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            <ChatList />
          </nav>
          <CreditsCard />
          {account}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
