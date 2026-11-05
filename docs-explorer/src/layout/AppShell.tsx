import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { MenuIcon } from '../ui/icons.tsx';
import { Breadcrumbs } from './Breadcrumbs.tsx';
import { Sidebar } from './Sidebar.tsx';

// Matches Tailwind's `md` breakpoint: from here up the sidebar is always shown.
const SIDEBAR_SHOWN = '(min-width: 48rem)';

/**
 * The frame around every page: the sidebar, a top bar with breadcrumbs, and the page itself.
 * Below `md` the sidebar moves into a drawer (a modal <dialog>, so focus stays inside it and
 * Escape closes it) opened from the top bar.
 */
export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);

  // The drawer is open for the location it was opened on, so any navigation (a link, Back)
  // closes it without extra code.
  const [drawerOpenAt, setDrawerOpenAt] = useState<string | null>(null);
  const drawerOpen = drawerOpenAt === location.key;
  const closeDrawer = () => setDrawerOpenAt(null);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    if (drawerOpen && !drawer.open) drawer.showModal();
    // Closing a modal dialog puts focus back on the menu button that opened it.
    if (!drawerOpen && drawer.open) drawer.close();
  }, [drawerOpen]);

  // If the window grows wide enough for the sidebar, the drawer is no longer needed.
  useEffect(() => {
    if (!drawerOpen) return;
    const query = window.matchMedia(SIDEBAR_SHOWN);
    const onChange = () => {
      if (query.matches) setDrawerOpenAt(null);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [drawerOpen]);

  // On a new page, start at its top and move focus to it, so keyboard and screen reader users
  // land on the new content. A new selection (only the query changes) leaves focus alone.
  const shownPath = useRef(location.pathname);
  useEffect(() => {
    if (shownPath.current === location.pathname) return;
    shownPath.current = location.pathname;
    const main = mainRef.current;
    if (!main) return;
    main.scrollTop = 0;
    main.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-fg-muted">
      <button
        type="button"
        onClick={() => mainRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-1.5 focus:text-sm focus:text-fg"
      >
        Skip to content
      </button>

      <div className="hidden w-60 shrink-0 border-r border-line bg-surface md:block">
        <Sidebar />
      </div>

      <dialog
        ref={drawerRef}
        id="nav-drawer"
        aria-label="Navigation"
        onClose={closeDrawer}
        onKeyDown={(event) => {
          // Escape closes the drawer (the dialog does that itself) and nothing behind it.
          if (event.key === 'Escape') event.stopPropagation();
        }}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog itself; the sidebar fills the rest.
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 border-r border-line bg-surface p-0 text-fg-muted backdrop:bg-canvas/70"
      >
        <Sidebar onNavigate={closeDrawer} onClose={closeDrawer} />
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3 md:px-4">
          <button
            type="button"
            onClick={() => setDrawerOpenAt(location.key)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="nav-drawer"
            className="-ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-hover hover:text-fg md:hidden"
          >
            <MenuIcon />
          </button>
          <Breadcrumbs />
        </header>
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto focus-visible:outline-none"
        >
          {/* The graph pages load on first visit; the frame stays on screen meanwhile. */}
          <Suspense fallback={<p className="p-6 text-sm text-fg-subtle">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
