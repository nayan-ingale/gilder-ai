import { useId } from 'react';
import { Link, useLocation } from 'react-router';
import { guides } from '../model/index.ts';
import { NAV, paths } from '../routes.ts';
import { preloadSearch } from '../search/lazy-search.ts';
import { SHORTCUT } from '../search/shortcut.ts';
import { CloseIcon, SearchIcon } from '../ui/icons.tsx';
import { docsPageOf, sectionOf } from './sections.ts';

interface SidebarProps {
  /** Called when a link is followed, so the drawer can close. */
  onNavigate?: () => void;
  /** When given (in the drawer), a close button is shown next to the brand. */
  onClose?: () => void;
  /** Opens search. The button looks like a search box and shows the keyboard shortcut. */
  onSearch?: () => void;
}

interface SidebarLinkProps {
  to: string;
  label: string;
  /** "page" when this is exactly the page shown, "true" when the page is inside the section. */
  current: 'page' | 'true' | undefined;
  onNavigate?: () => void;
}

function SidebarLink({ to, label, current, onNavigate }: SidebarLinkProps) {
  const isActive = current !== undefined;
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={current}
      className={`relative flex items-center rounded-md px-3 py-1.5 text-sm transition-colors ${
        isActive
          ? 'bg-accent-soft font-medium text-fg'
          : 'text-fg-muted hover:bg-raised hover:text-fg'
      }`}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
        />
      ) : null}
      {label}
    </Link>
  );
}

/**
 * The brand, the list of sections and, under them, the docs pages. Used as the fixed sidebar on
 * wide screens and inside the drawer on narrow ones. Plain links, not NavLink: the active item
 * comes from sectionOf, because an error flow lives under /flows/ but belongs to Error Handling.
 */
export function Sidebar({ onNavigate, onClose, onSearch }: SidebarProps) {
  const { pathname } = useLocation();
  const active = sectionOf(pathname);
  const activeDocsPage = active === 'docs' ? docsPageOf(pathname) : undefined;
  const docsHeadingId = useId();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <Link
          to={paths.overview()}
          onClick={onNavigate}
          className="flex min-w-0 items-baseline gap-2 rounded-sm"
        >
          <span className="text-sm font-semibold text-fg">GilderAi</span>
          <span className="truncate text-xs text-fg-subtle">Docs Explorer</span>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-1.5 inline-flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-hover hover:text-fg"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
      {onSearch ? (
        <div className="shrink-0 px-2 pt-2">
          <button
            type="button"
            onClick={onSearch}
            onPointerEnter={preloadSearch}
            onFocus={preloadSearch}
            aria-haspopup="dialog"
            aria-keyshortcuts={SHORTCUT.keys}
            className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted"
          >
            <SearchIcon />
            <span className="flex-1 text-left">Search…</span>
            <kbd
              aria-hidden="true"
              className="rounded border border-line px-1 font-sans text-[0.6875rem] text-fg-subtle"
            >
              {SHORTCUT.hint}
            </kbd>
          </button>
        </div>
      ) : null}
      <nav aria-label="Sections" className="relative min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-px">
          {NAV.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <SidebarLink
                  to={item.to}
                  label={item.label}
                  current={isActive ? (pathname === item.to ? 'page' : 'true') : undefined}
                  onNavigate={onNavigate}
                />
              </li>
            );
          })}
        </ul>
        {guides.docsPages.length > 0 ? (
          <>
            <h2
              id={docsHeadingId}
              className="mt-4 mb-1 px-3 text-xs font-medium tracking-wide text-fg-subtle uppercase"
            >
              Docs
            </h2>
            <ul aria-labelledby={docsHeadingId} className="flex flex-col gap-px">
              {guides.docsPages.map((page) => (
                <li key={page.id}>
                  <SidebarLink
                    to={paths.doc(page.id)}
                    label={page.title}
                    current={page.id === activeDocsPage ? 'page' : undefined}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>
    </div>
  );
}
