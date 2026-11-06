import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router';
import { docs } from '../model/index.ts';
import { SearchIcon } from '../ui/icons.tsx';
import { plural } from '../ui/plural.ts';
import { buildSearchDocuments } from './search-documents.ts';
import { createSearchEngine, type SearchHit, type SearchResults } from './search-engine.ts';
import { SearchOption } from './SearchOption.tsx';

// The search palette: a modal dialog with a search box over a grouped list of results, built
// as a combobox and listbox so keyboard and screen reader users get the usual behaviour. Built
// once, the first time search opens; this module loads only then.

const engine = createSearchEngine(buildSearchDocuments(docs));

/** How long the result count waits for typing to pause before it is read out. */
const ANNOUNCE_DELAY_MS = 500;

const KEY_HINT = 'rounded border border-line px-1 font-sans text-[0.6875rem] text-fg-subtle';

/** "17 shown of 27 matches" when each group's limit hid some results; otherwise nothing. */
function cappedCount(results: SearchResults, shown: number): string | undefined {
  return results.total > shown ? `${shown} shown of ${results.total} matches` : undefined;
}

function announcement(results: SearchResults, shown: number): string {
  if (results.query === '') return '';
  if (shown === 0) return `No matches for ${results.query}`;
  return cappedCount(results, shown) ?? plural(shown, 'result');
}

interface SearchDialogProps {
  open: boolean;
  /** Called once the dialog has closed, however it was closed. */
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const scrollToActive = useRef(false);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => engine.search(query), [query]);
  const options = useMemo(() => results.groups.flatMap((group) => group.hits), [results]);
  const active = options.length === 0 ? -1 : Math.min(activeIndex, options.length - 1);

  // Each group's first option's position in the whole list, for the option ids.
  const groupStarts = useMemo(
    () =>
      results.groups.map((_, groupIndex) =>
        results.groups.slice(0, groupIndex).reduce((count, group) => count + group.hits.length, 0),
      ),
    [results],
  );

  // The dialog follows `open`. showModal keeps focus inside it and the page behind inert; close
  // puts focus back on whatever opened it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Keyboard moves keep the active result in view; mouse moves never scroll. Back at the first
  // result, the list goes back to its top, so the hint and first group label show again.
  useEffect(() => {
    if (!scrollToActive.current || active < 0) return;
    scrollToActive.current = false;
    if (active === 0 && listRef.current) listRef.current.scrollTop = 0;
    else
      document.getElementById(`${baseId}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, baseId]);

  // The result count is read out once typing pauses, not on every key.
  const capped = cappedCount(results, options.length);
  const message = announcement(results, options.length);
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(message), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  const close = () => dialogRef.current?.close();

  const choose = (hit: SearchHit) => {
    // Closing first puts focus back where it was; a new page then moves it to its content.
    close();
    void navigate(hit.doc.to);
  };

  const move = (step: number) => {
    if (options.length === 0) return;
    scrollToActive.current = true;
    setActiveIndex((Math.max(active, 0) + step + options.length) % options.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      const hit = options[active];
      if (hit) choose(hit);
    } else {
      return;
    }
    // Handled here: the page behind (a walkthrough, the detail panel) must not act on it too.
    event.preventDefault();
    event.stopPropagation();
  };

  // A click on the backdrop lands on the dialog itself; the content fills the rest. The press
  // must start there too, so a text selection dragged out of the box doesn't close it.
  const onBackdropMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  };
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressedOnBackdrop.current && event.target === event.currentTarget) close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search the docs"
      onClose={() => {
        // Every close comes through here (Escape, the backdrop, a chosen result), so the next
        // search starts empty.
        setQuery('');
        setActiveIndex(0);
        onClose();
      }}
      onKeyDown={(event) => {
        // Escape closes the dialog (it does that itself) and nothing behind it.
        if (event.key === 'Escape') event.stopPropagation();
      }}
      onMouseDown={onBackdropMouseDown}
      onClick={onBackdropClick}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-surface p-0 text-fg-muted shadow-2xl backdrop:bg-canvas/70 open:flex open:flex-col sm:mx-auto sm:mt-[12vh] sm:h-fit sm:max-h-[min(34rem,76dvh)] sm:w-[calc(100%-2rem)] sm:max-w-xl sm:rounded-lg sm:border sm:border-line"
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-3.5">
        <span className="text-fg-subtle">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Search"
          aria-expanded={options.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Search pages, flows, components and code…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (listRef.current) listRef.current.scrollTop = 0;
          }}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-fg-subtle focus-visible:outline-none sm:text-sm"
        />
        <kbd aria-hidden="true" className={`hidden sm:inline ${KEY_HINT}`}>
          Esc
        </kbd>
        <button
          type="button"
          onClick={close}
          className="-mr-1.5 shrink-0 rounded-md px-2 py-1 text-sm text-fg-subtle transition-colors hover:bg-hover hover:text-fg sm:hidden"
        >
          Cancel
        </button>
      </div>

      <div
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
      >
        {results.query === '' ? (
          <p className="px-2.5 pt-1.5 pb-1 text-xs text-fg-subtle">
            Type to search pages, flows and their steps, components, functions, types and files.
          </p>
        ) : null}
        <div
          role="listbox"
          id={listboxId}
          aria-label="Results"
          hidden={options.length === 0}
          // Keeps focus in the search box when a result is clicked.
          onMouseDown={(event) => event.preventDefault()}
        >
          {results.groups.map((group, groupIndex) => {
            const labelId = `${baseId}-group-${group.id}`;
            const start = groupStarts[groupIndex] ?? 0;
            return (
              <div key={group.id} role="group" aria-labelledby={labelId} className="pb-1">
                <div
                  role="presentation"
                  id={labelId}
                  className="px-2.5 pt-2 pb-1 text-xs font-medium text-fg-subtle"
                >
                  {group.label}
                </div>
                {group.hits.map((hit, position) => {
                  const index = start + position;
                  return (
                    <SearchOption
                      key={hit.doc.id}
                      hit={hit}
                      id={optionId(index)}
                      active={index === active}
                      onHover={() => setActiveIndex(index)}
                      onChoose={() => choose(hit)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        {results.query !== '' && options.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-subtle">
            No matches for “<span className="text-fg">{results.query}</span>”
          </p>
        ) : null}
      </div>

      {/* Key hints on wider screens; on any screen, a note when the group limits hid results. */}
      <div
        className={`shrink-0 items-center gap-4 border-t border-line px-3.5 py-2 text-xs text-fg-subtle ${
          capped ? 'flex' : 'hidden sm:flex'
        }`}
      >
        <span aria-hidden="true" className="hidden items-center gap-4 sm:flex">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <kbd className={KEY_HINT}>↑</kbd>
            <kbd className={KEY_HINT}>↓</kbd>
            to move
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <kbd className={KEY_HINT}>↵</kbd>
            to open
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <kbd className={KEY_HINT}>Esc</kbd>
            to close
          </span>
        </span>
        {capped ? <span className="min-w-0 truncate sm:ml-auto">{capped}</span> : null}
      </div>

      <p role="status" className="sr-only">
        {announced}
      </p>
    </dialog>
  );
}
