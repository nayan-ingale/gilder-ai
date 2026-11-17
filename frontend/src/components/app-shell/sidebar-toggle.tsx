'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/components/ui/cn';
import { SIDEBAR_KEY } from './sidebar-state';

const CHANGE_EVENT = 'gilder:sidebar';

function isCollapsed(): boolean {
  return document.documentElement.dataset.sidebar === 'collapsed';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Collapses the sidebar to a narrow rail or opens it again; the browser remembers the choice. */
export function SidebarToggle({ className }: { className?: string }) {
  // The page starts expanded on the server; the head script may already have collapsed it.
  const collapsed = useSyncExternalStore(subscribe, isCollapsed, () => false);

  function toggle() {
    const next = !collapsed;
    if (next) {
      document.documentElement.dataset.sidebar = 'collapsed';
    } else {
      delete document.documentElement.dataset.sidebar;
    }
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
    } catch {
      // Blocked storage only means the choice lasts until the page reloads.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className={cn(
        'inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-fg-muted hover:bg-sunken hover:text-fg focus-visible:outline-2 focus-visible:outline-accent',
        className,
      )}
    >
      {collapsed ? (
        <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
