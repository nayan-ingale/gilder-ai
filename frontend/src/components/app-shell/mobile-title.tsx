'use client';

import { skipToken } from '@reduxjs/toolkit/query';
import { usePathname } from 'next/navigation';
import { creditsLabel } from '@/components/chat/composer';
import { useGetAccountQuery, useGetChatQuery } from '@/store/api';

/**
 * The middle of the small-screen top bar: the open chat's title (or the page's name) with the
 * credits under it. On a chat page it is the page's heading, since the chat header is hidden there.
 */
export function MobileTitle() {
  const pathname = usePathname();
  const chatId = pathname.startsWith('/c/') ? pathname.slice('/c/'.length) : null;
  const { data: chat } = useGetChatQuery(chatId ?? skipToken);
  const { data: account } = useGetAccountQuery();
  const title = chatId
    ? (chat?.chat.title ?? 'Chat')
    : pathname.startsWith('/settings')
      ? 'Settings'
      : 'New chat';
  const Title = chatId ? 'h1' : 'p';
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <Title className="max-w-full truncate text-[15px] font-semibold text-fg">{title}</Title>
      {account ? (
        <p className="text-xs text-fg-muted">{creditsLabel(account.account.balance)}</p>
      ) : null}
    </div>
  );
}
