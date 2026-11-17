'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import type { ChatSummary } from '@/lib/chats';
import { errorMessage, useDeleteChatMutation, useUpdateChatMutation } from '@/store/api';

type DialogKind = 'rename' | 'delete';

export interface ChatActions {
  /** Pins or unpins the chat; `after` runs once it has moved, to put focus back. */
  togglePin: (after?: () => void) => Promise<void>;
  /** Picks a dialog from a menu; it opens once the menu has closed (onMenuCloseAutoFocus). */
  chooseDialog: (kind: DialogKind) => void;
  /** For the menu's onCloseAutoFocus: opens the dialog chosen from it, if any. */
  onMenuCloseAutoFocus: () => void;
  /** The rename and delete dialogs, to render next to the menu. */
  dialogs: ReactNode;
}

/**
 * Rename, pin and delete for one chat, shared by its sidebar row and its header. The list changes
 * at once: updateChat and deleteChat change the cache and undo it on failure.
 */
export function useChatActions(chat: ChatSummary): ChatActions {
  const href = `/c/${chat.id}`;
  const open = usePathname() === href;
  const router = useRouter();
  const toast = useToast();
  const [updateChat, update] = useUpdateChatMutation();
  const [deleteChat, removal] = useDeleteChatMutation();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  // A dialog chosen from a menu opens only once the menu has closed and given focus back to its
  // button. Opened any earlier, the menu's focus return lands outside the dialog and closes it.
  const pendingDialog = useRef<DialogKind | null>(null);

  function failed(title: string, error: unknown) {
    const { message, requestId } = errorMessage(error);
    toast({ title, description: message, tone: 'danger', ...(requestId ? { requestId } : {}) });
  }

  async function togglePin(after?: () => void) {
    try {
      await updateChat({ id: chat.id, pinned: !chat.pinned }).unwrap();
      if (after) {
        requestAnimationFrame(after);
      }
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
      if (open) {
        router.push('/');
      }
    } catch (error) {
      failed('Could not delete the chat', error);
    }
  }

  const dialogs = (
    <>
      <Dialog
        open={dialog === 'rename'}
        onOpenChange={(isOpen) => setDialog(isOpen ? 'rename' : null)}
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
        onOpenChange={(isOpen) => setDialog(isOpen ? 'delete' : null)}
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
    </>
  );

  return {
    togglePin,
    chooseDialog: (kind) => {
      pendingDialog.current = kind;
    },
    onMenuCloseAutoFocus: () => {
      const next = pendingDialog.current;
      pendingDialog.current = null;
      if (next) {
        // Let Radix focus the button first, so the dialog returns focus there when it closes.
        setTimeout(() => setDialog(next));
      }
    },
    dialogs,
  };
}
