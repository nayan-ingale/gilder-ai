'use client';

import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatSummary } from '@/lib/chats';
import { useChatActions } from './chat-actions';

/** One chat in the sidebar: a link to it, and a menu to rename, pin or delete it. */
export function ChatRow({ chat }: { chat: ChatSummary }) {
  const href = `/c/${chat.id}`;
  const active = usePathname() === href;
  const actions = useChatActions(chat);

  // Pinning moves the chat to another group, which remounts its row; keep keyboard focus on the
  // moved row's menu button. The list exists twice (sidebar and the small-screen panel), so pick
  // the copy that is on screen.
  function focusMovedRow() {
    const buttons = document.querySelectorAll<HTMLElement>(`[data-chat-options="${chat.id}"]`);
    [...buttons].find((button) => button.getClientRects().length > 0)?.focus();
  }

  return (
    <li className="group relative">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-10 items-center rounded-sm pr-11 pl-2.5 text-[13.5px]',
          active
            ? 'bg-accent-soft font-medium text-fg'
            : 'text-fg-muted hover:bg-sunken hover:text-fg',
        )}
      >
        <span className="truncate">{chat.title}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Options for ${chat.title}`}
          data-chat-options={chat.id}
          className={cn(
            'absolute top-0 right-0.5 inline-flex size-10 items-center justify-center rounded-sm text-fg-muted group-hover:opacity-100 hover:text-fg focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100',
            active ? 'opacity-100' : 'opacity-0',
          )}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[196px]"
          onCloseAutoFocus={actions.onMenuCloseAutoFocus}
        >
          <DropdownMenuItem
            icon={<Pencil size={16} strokeWidth={1.75} />}
            onSelect={() => actions.chooseDialog('rename')}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={
              chat.pinned ? (
                <PinOff size={16} strokeWidth={1.75} />
              ) : (
                <Pin size={16} strokeWidth={1.75} />
              )
            }
            onSelect={() => void actions.togglePin(focusMovedRow)}
          >
            {chat.pinned ? 'Unpin' : 'Pin to top'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Trash2 size={16} strokeWidth={1.75} />}
            tone="danger"
            onSelect={() => actions.chooseDialog('delete')}
          >
            Delete chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.dialogs}
    </li>
  );
}
