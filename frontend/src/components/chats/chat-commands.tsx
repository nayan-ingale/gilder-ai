'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SearchDialog } from './search-dialog';

const OpenSearchContext = createContext<() => void>(() => {});

/**
 * The app-wide chat shortcuts: ⌘K (Ctrl+K) opens search, ⌘⇧O (Ctrl+Shift+O) starts a new chat.
 * It owns the one search dialog, so every search button opens the same one.
 */
export function ChatCommands({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'k' && !event.shiftKey) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      } else if (key === 'o' && event.shiftKey) {
        event.preventDefault();
        setSearchOpen(false);
        router.push('/');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return (
    <OpenSearchContext.Provider value={() => setSearchOpen(true)}>
      {children}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </OpenSearchContext.Provider>
  );
}

/** The sidebar's search button, with its shortcut. */
export function SearchButton() {
  const openSearch = useContext(OpenSearchContext);
  return (
    <button
      type="button"
      onClick={openSearch}
      data-closes-nav
      className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-fg-muted hover:bg-sunken hover:text-fg"
    >
      <Search size={16} aria-hidden="true" />
      <span className="flex-1 text-left">Search chats</span>
      <Kbd aria-hidden="true">⌘K</Kbd>
    </button>
  );
}

/** The search button in the small-screen top bar. */
export function SearchIconButton() {
  const openSearch = useContext(OpenSearchContext);
  return (
    <IconButton label="Search chats" icon={<Search size={18} />} size="sm" onClick={openSearch} />
  );
}
