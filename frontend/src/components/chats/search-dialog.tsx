'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useId, useMemo, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ChatSummary } from '@/lib/chats';
import { useListChatsInfiniteQuery, useSearchChatsQuery } from '@/store/api';

const MIN_TERM = 2;
const DEBOUNCE_MS = 250;
const RECENT_COUNT = 8;

export interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Search chats by title or message text (⌘K). With nothing typed it shows the latest chats.
 * Arrow keys move through the results and Enter opens one.
 */
export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const searching = term.length >= MIN_TERM;
  const recent = useListChatsInfiniteQuery(undefined, { skip: !open });
  const search = useSearchChatsQuery(term, { skip: !open || !searching });

  const results: ChatSummary[] = useMemo(() => {
    if (searching) {
      return search.data?.items ?? [];
    }
    return (recent.data?.pages.flatMap((page) => page.items) ?? []).slice(0, RECENT_COUNT);
  }, [searching, search.data, recent.data]);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setText('');
      setTerm('');
      setActive(0);
    }
  }

  function openChat(chat: ChatSummary) {
    close(false);
    router.push(`/c/${chat.id}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chat = results[Math.min(active, results.length - 1)];
      if (chat) {
        openChat(chat);
      }
    }
  }

  const status = searching
    ? search.isFetching
      ? 'Searching…'
      : search.isError
        ? 'Search failed. Try again.'
        : results.length === 0
          ? `No chats match “${term}”.`
          : null
    : results.length === 0 && !recent.isLoading
      ? 'No chats yet.'
      : null;
  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <Dialog open={open} onOpenChange={close} title="Search chats">
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
        />
        <Input
          role="combobox"
          aria-label="Search chats"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          placeholder="Search titles and messages"
          className="pl-9"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          data-autofocus
        />
      </div>
      <p className="mt-3 mb-1 px-1 text-xs text-fg-subtle">{searching ? 'Results' : 'Recent'}</p>
      <ul id={listId} role="listbox" aria-label="Chats" className="max-h-72 overflow-y-auto">
        {results.map((chat, index) => (
          <li
            key={chat.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            className={cn(
              'cursor-pointer truncate rounded-md px-2 py-2 text-sm',
              index === active ? 'bg-sunken text-fg' : 'text-fg-muted',
            )}
            onMouseEnter={() => setActive(index)}
            onClick={() => openChat(chat)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openChat(chat);
              }
            }}
          >
            {chat.title}
          </li>
        ))}
      </ul>
      {status ? (
        <p role="status" className="px-1 py-2 text-sm text-fg-subtle">
          {status}
        </p>
      ) : null}
    </Dialog>
  );
}
