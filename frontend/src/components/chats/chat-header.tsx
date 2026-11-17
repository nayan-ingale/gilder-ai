'use client';

import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatSummary } from '@/lib/chats';
import { useGetChatQuery } from '@/store/api';
import { useChatActions } from './chat-actions';

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const noSubscription = () => () => {};

/** "Today", "Yesterday" or "12 Nov", by the visitor's own calendar. */
export function dayLabel(iso: string, now = new Date()): string {
  const day = new Date(iso);
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((startOf(now) - startOf(day)) / 86_400_000);
  if (daysAgo === 0) {
    return 'Today';
  }
  return daysAgo === 1 ? 'Yesterday' : dayFormat.format(day);
}

/**
 * The chat's title bar: the title, when it was last active and how many messages it has, and
 * buttons to pin it and for its other actions. It starts from the server's copy and follows the
 * cache, so a rename or pin from the sidebar shows here at once. It also sets the tab title.
 */
export function ChatHeader({
  chat: initial,
  messageCount,
}: {
  chat: ChatSummary;
  messageCount: number;
}) {
  const { data } = useGetChatQuery(initial.id);
  const chat = data?.chat ?? initial;
  const actions = useChatActions(chat);
  // The day depends on the visitor's clock, so only the browser fills it in.
  const day = useSyncExternalStore(
    noSubscription,
    () => dayLabel(chat.lastMessageAt ?? chat.createdAt),
    () => null,
  );

  // The page's metadata sets the first title; this keeps the tab in step after a rename.
  useEffect(() => {
    document.title = `${chat.title} · GilderAi`;
  }, [chat.title]);

  const count = `${messageCount} ${messageCount === 1 ? 'message' : 'messages'}`;
  const pinLabel = chat.pinned ? 'Unpin chat' : 'Pin chat';
  return (
    <header className="sticky top-0 z-10 flex min-h-[60px] shrink-0 items-center gap-3 border-b border-line bg-canvas pr-3 pl-4 sm:pr-5 sm:pl-7">
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-[15px] font-semibold text-fg">{chat.title}</h1>
        <p className="text-xs text-fg-muted">{day ? `${day} · ${count}` : count}</p>
      </div>
      <button
        type="button"
        onClick={() => void actions.togglePin()}
        aria-pressed={chat.pinned}
        aria-label={pinLabel}
        title={pinLabel}
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-sm hover:bg-sunken',
          chat.pinned ? 'text-accent-text' : 'text-fg-muted hover:text-fg',
        )}
      >
        {chat.pinned ? (
          <PinOff size={18} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Pin size={18} strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Chat options"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg data-[state=open]:bg-sunken"
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[196px]" onCloseAutoFocus={actions.onMenuCloseAutoFocus}>
          <DropdownMenuItem
            icon={<Pencil size={16} strokeWidth={1.75} />}
            onSelect={() => actions.chooseDialog('rename')}
          >
            Rename
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
    </header>
  );
}
