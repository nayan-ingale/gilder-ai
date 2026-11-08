'use client';

import { Pin } from 'lucide-react';
import { useEffect } from 'react';
import type { ChatSummary } from '@/lib/chats';
import { useGetChatQuery } from '@/store/api';

/**
 * The chat's title bar. It starts from the server's copy and follows the cache, so a rename or
 * pin from the sidebar shows here at once. It also sets the tab title.
 */
export function ChatHeader({ chat: initial }: { chat: ChatSummary }) {
  const { data } = useGetChatQuery(initial.id);
  const chat = data?.chat ?? initial;

  // The page's metadata sets the first title; this keeps the tab in step after a rename.
  useEffect(() => {
    document.title = `${chat.title} · GilderAi`;
  }, [chat.title]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
      <h1 className="truncate text-base text-fg">{chat.title}</h1>
      {chat.pinned ? (
        <Pin size={14} className="shrink-0 text-fg-subtle" aria-label="Pinned" role="img" />
      ) : null}
    </header>
  );
}
