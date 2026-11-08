'use client';

import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { ChatSummary } from '@/lib/chats';
import { errorMessage, useDeleteChatMutation, useUpdateChatMutation } from '@/store/api';

/** One chat in the sidebar: a link to it, and a menu to rename, pin or delete it. */
export function ChatRow({ chat }: { chat: ChatSummary }) {
  const href = `/c/${chat.id}`;
  const active = usePathname() === href;
  const router = useRouter();
  const toast = useToast();
  const [updateChat, update] = useUpdateChatMutation();
  const [deleteChat, removal] = useDeleteChatMutation();
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  // A dialog chosen from the menu opens only once the menu has closed and given focus back to its
  // button. Opened any earlier, the menu's focus return lands outside the dialog and closes it.
  const pendingDialog = useRef<'rename' | 'delete' | null>(null);

  function failed(title: string, error: unknown) {
    const { message, requestId } = errorMessage(error);
    toast({ title, description: message, tone: 'danger', ...(requestId ? { requestId } : {}) });
  }

  async function togglePin() {
    try {
      await updateChat({ id: chat.id, pinned: !chat.pinned }).unwrap();
      // Pinning moves the chat to another group, which remounts its row; keep keyboard focus on
      // the moved row's menu button instead of losing it. The list exists twice (sidebar and the
      // small-screen panel), so pick the copy that is on screen.
      requestAnimationFrame(() => {
        const buttons = document.querySelectorAll<HTMLElement>(`[data-chat-options="${chat.id}"]`);
        [...buttons].find((button) => button.getClientRects().length > 0)?.focus();
      });
    } catch (error) {
      failed(chat.pinned ? 'Could not unpin the chat' : 'Could not pin the chat', error);
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get('title') ?? '').trim();
    if (!title || title === chat.title) {
      setDialog(null);
      return;
    }
    try {
      await updateChat({ id: chat.id, title }).unwrap();
      setDialog(null);
    } catch (error) {
      failed('Could not rename the chat', error);
    }
  }

  async function remove() {
    try {
      await deleteChat(chat.id).unwrap();
      setDialog(null);
      if (active) {
        router.push('/');
      }
    } catch (error) {
      failed('Could not delete the chat', error);
    }
  }

  return (
    <li className="group relative">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-9 items-center rounded-md pr-9 pl-2 text-sm',
          active ? 'bg-sunken text-fg' : 'text-fg-muted hover:bg-sunken hover:text-fg',
        )}
      >
        <span className="truncate">{chat.title}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Options for ${chat.title}`}
          data-chat-options={chat.id}
          className="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-fg focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={() => {
            const next = pendingDialog.current;
            pendingDialog.current = null;
            if (next) {
              // Let Radix focus the button first, so the dialog returns focus there when it closes.
              setTimeout(() => setDialog(next));
            }
          }}
        >
          <DropdownMenuItem
            icon={<Pencil size={14} />}
            onSelect={() => {
              pendingDialog.current = 'rename';
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            onSelect={togglePin}
          >
            {chat.pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={<Trash2 size={14} />}
            tone="danger"
            onSelect={() => {
              pendingDialog.current = 'delete';
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog === 'rename'}
        onOpenChange={(open) => setDialog(open ? 'rename' : null)}
        title="Rename chat"
      >
        <form onSubmit={rename} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-fg-muted">
            Title
            <Input name="title" defaultValue={chat.title} maxLength={120} required data-autofocus />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isLoading}>
              Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title="Delete chat?"
        description={`“${chat.title}” and its messages will be removed from your chats.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove} disabled={removal.isLoading}>
            Delete
          </Button>
        </div>
      </Dialog>
    </li>
  );
}
