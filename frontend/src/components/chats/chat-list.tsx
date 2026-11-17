'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { groupChats } from '@/lib/chats';
import { useListChatsInfiniteQuery } from '@/store/api';
import { ChatRow } from './chat-row';

/** The chats in the sidebar, grouped by Pinned, Today, Previous 7 days and Older. */
export function ChatList() {
  const { data, isLoading, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useListChatsInfiniteQuery();
  // Grouping reads the clock, so it only runs once chats have loaded in the browser, never in the
  // prerendered shell (Next.js refuses the current time there).
  const groups = useMemo(
    () => (data ? groupChats(data.pages.flatMap((page) => page.items)) : []),
    [data],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 px-2.5 pt-3.5" aria-label="Loading your chats">
        {['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2'].map((width) => (
          <Skeleton key={width} className={`h-5 ${width}`} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2 px-2.5 pt-3.5 text-xs text-fg-subtle">
        <p>Could not load your chats.</p>
        <Button size="sm" variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="px-2.5 pt-3.5 text-xs text-fg-subtle">No chats yet. Start one with New chat.</p>
    );
  }

  return (
    <div className="flex flex-col pb-4">
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`chat-group-${group.label}`}>
          <h2
            id={`chat-group-${group.label}`}
            className="px-2.5 pt-3.5 pb-1.5 text-xs font-medium text-fg-subtle"
          >
            {group.label}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {group.chats.map((chat) => (
              <ChatRow key={chat.id} chat={chat} />
            ))}
          </ul>
        </section>
      ))}
      {hasNextPage ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 self-start"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? 'Loading…' : 'Show more'}
        </Button>
      ) : null}
    </div>
  );
}
