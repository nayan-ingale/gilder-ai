'use client';

import { Menu, Plus } from 'lucide-react';
import Link from 'next/link';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type MouseEvent, useState } from 'react';
import { CreditsCard } from '@/components/billing/credits-card';
import { SearchButton } from '@/components/chats/chat-commands';
import { ChatList } from '@/components/chats/chat-list';
import { IconButton } from '@/components/ui/button';

/**
 * The chat list on small screens, where the sidebar is hidden: a panel that slides in from the
 * left. It closes when a link or the search button inside it is used.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  function closeOnNavigate(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('a, [data-closes-nav]')) {
      setOpen(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <IconButton label="Open chats" icon={<Menu size={18} />} size="sm" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-canvas/70 md:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[min(85vw,18rem)] flex-col border-r border-line bg-surface shadow-xl md:hidden"
          onClick={closeOnNavigate}
        >
          <DialogPrimitive.Title className="flex h-12 items-center px-4 text-base font-semibold tracking-tight text-fg">
            GilderAi
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Your chats, search and a new chat.
          </DialogPrimitive.Description>
          <div className="flex flex-col gap-1 px-3">
            <Link
              href="/"
              className="flex h-9 items-center gap-2 rounded-md border border-line bg-raised px-3 text-sm font-medium text-fg hover:bg-sunken"
            >
              <Plus size={16} aria-hidden="true" />
              New chat
            </Link>
            <SearchButton />
          </div>
          <nav aria-label="Chats" className="mt-4 flex-1 overflow-y-auto px-3">
            <ChatList />
          </nav>
          <CreditsCard />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
