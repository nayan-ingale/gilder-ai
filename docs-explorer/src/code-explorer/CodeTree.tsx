// The code explorer's main area: a filter box above the tree of apps, files and symbols. Files
// open and close to show their symbols; each file and symbol is a link that selects it, so the
// URL says what is open. A selection made anywhere (a deep link, a search, a link in the panel)
// opens its file here and scrolls it into view.
import {
  use,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router';
import { PanelInsetContext } from '../layout/panel-inset.ts';
import { SYMBOL_KIND_LABEL } from '../model/labels.ts';
import { paths } from '../routes.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { CloseIcon } from '../ui/icons.tsx';
import { plural } from '../ui/plural.ts';
import { filterTree, type CodeTree as CodeTreeData, type TreeFile } from './code-tree.ts';

interface CodeTreeProps {
  tree: CodeTreeData;
  /** The open file: the selected one, or the file of the selected symbol. */
  activeFile?: string;
  /** The selected symbol's ID. */
  activeSymbol?: string;
}

type Toggles = Record<string, boolean>;

/** Space kept between a revealed row and the edge of the list. */
const REVEAL_MARGIN = 8;

/** How long typing must pause before the new count is read out. */
const ANNOUNCE_DELAY_MS = 500;

/** The query as the filter reads it, so extra spaces or a change of case keep the same results. */
function filterKeyOf(query: string): string {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

/**
 * Which files are open. With no filter, files start closed; while filtering they start open, so
 * every match shows, and each new filter starts fresh. Selecting a file opens it, here or from
 * elsewhere. A selection never closes anything, so rows don't jump under the pointer.
 */
function useOpenFiles(activeFile: string | undefined, filterKey: string) {
  const [browsing, setBrowsing] = useState<Toggles>(() =>
    activeFile === undefined ? {} : { [activeFile]: true },
  );
  const [filtering, setFiltering] = useState<{ key: string; toggles: Toggles }>({
    key: filterKey,
    toggles: {},
  });
  const filterToggles = filtering.key === filterKey ? filtering.toggles : {};

  const [seenActive, setSeenActive] = useState(activeFile);
  if (seenActive !== activeFile) {
    setSeenActive(activeFile);
    if (activeFile !== undefined) {
      setBrowsing({ ...browsing, [activeFile]: true });
      setFiltering({ key: filterKey, toggles: { ...filterToggles, [activeFile]: true } });
    }
  }

  const isOpen = (path: string): boolean =>
    filterKey === '' ? (browsing[path] ?? false) : (filterToggles[path] ?? true);
  const toggle = (path: string): void => {
    const open = !isOpen(path);
    if (filterKey === '') setBrowsing({ ...browsing, [path]: open });
    else setFiltering({ key: filterKey, toggles: { ...filterToggles, [path]: open } });
  };
  return { isOpen, toggle };
}

/** Scrolls the list just enough to show the row above the part the detail sheet covers. */
function reveal(list: HTMLElement, row: HTMLElement, coveredBottom: number): void {
  const view = list.getBoundingClientRect();
  const box = row.getBoundingClientRect();
  const top = view.top + REVEAL_MARGIN;
  const bottom = Math.max(view.bottom - coveredBottom - REVEAL_MARGIN, top + box.height);
  if (box.top < top) list.scrollTop -= top - box.top;
  else if (box.bottom > bottom) list.scrollTop += box.bottom - bottom;
}

export function CodeTree({ tree, activeFile, activeSymbol }: CodeTreeProps) {
  const inputId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const inset = use(PanelInsetContext);

  const [query, setQuery] = useState('');
  const [typed, setTyped] = useState(false);
  const filterKey = filterKeyOf(query);
  const shown = useMemo(() => filterTree(tree, filterKey), [tree, filterKey]);
  const { isOpen, toggle } = useOpenFiles(activeFile, filterKey);

  const clear = (): void => {
    setQuery('');
    inputRef.current?.focus();
  };
  // Escape empties the box first. Only an empty box lets Escape through to close the sheet.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Escape' || query === '') return;
    event.preventDefault();
    setQuery('');
  };

  // The selected symbol's row, or its file's row when the symbol isn't shown.
  const revealSelection = useEffectEvent(() => {
    const list = listRef.current;
    if (!list) return;
    const row = [activeSymbol, activeFile]
      .filter((id) => id !== undefined)
      .map((id) => list.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`))
      .find((element) => element !== null && element.offsetParent !== null);
    if (row) reveal(list, row, inset.bottom);
  });

  // A selection, or the sheet opening over the list, brings the selected row into view.
  useEffect(() => {
    revealSelection();
  }, [activeSymbol, activeFile, inset.bottom]);

  // A new filter shows its results from the top; clearing it goes back to the selection.
  useEffect(() => {
    if (filterKey === '') revealSelection();
    else if (listRef.current) listRef.current.scrollTop = 0;
  }, [filterKey]);

  const shownCount = `${plural(shown.fileCount, 'file')} and ${plural(shown.symbolCount, 'symbol')}`;
  const noMatch = 'No files or symbols match';
  const status =
    filterKey === ''
      ? `${plural(tree.fileCount, 'file')} · ${plural(tree.symbolCount, 'symbol')}`
      : shown.fileCount === 0
        ? noMatch
        : `Showing ${shownCount}`;

  // The visible count follows every key; screen readers hear it once typing pauses. Nothing is
  // read before the first key, and clearing the filter says so.
  const message =
    filterKey !== '' ? status : typed ? `Filter cleared, showing all ${shownCount}` : '';
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(message), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div className="flex h-full flex-col text-[13px]">
      <div className="relative shrink-0 border-b border-line px-3 py-2 md:px-4">
        <label htmlFor={inputId} className="sr-only">
          Filter files and functions
        </label>
        <div className="relative max-w-xl">
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTyped(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Filter files and functions"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={statusId}
            className="h-8 w-full rounded-md border border-line bg-surface pr-8 pl-2.5 text-fg placeholder:text-fg-subtle hover:border-line-strong [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query === '' ? null : (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear the filter"
              title="Clear the filter"
              className="absolute inset-y-0 right-0 inline-flex w-8 items-center justify-center rounded-md text-fg-subtle hover:text-fg focus-visible:-outline-offset-2"
            >
              <CloseIcon />
            </button>
          )}
        </div>
        <p id={statusId} className="mt-1.5 text-xs text-fg-subtle">
          {status}
        </p>
        <p role="status" className="sr-only">
          {announced}
        </p>
      </div>

      <nav
        ref={listRef}
        aria-label="Code files"
        // `relative` keeps screen-reader-only text inside this scroll box. The bottom padding lets
        // the last rows scroll above the detail sheet on narrow screens.
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4"
        style={inset.bottom > 0 ? { paddingBottom: inset.bottom } : undefined}
      >
        {shown.apps.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            action={
              <button
                type="button"
                onClick={clear}
                className="rounded-sm text-accent hover:underline"
              >
                Clear the filter
              </button>
            }
          >
            <p>
              No file path, name, kind, route or signature matches{' '}
              <span className="font-mono text-fg-muted wrap-anywhere">{query.trim()}</span>.
            </p>
          </EmptyState>
        ) : (
          <ul>
            {shown.apps.map((app) => (
              <li key={app.app}>
                <h2 className="sticky top-0 z-10 flex flex-wrap items-baseline gap-x-2 border-b border-line bg-canvas px-3 pt-3 pb-1.5 md:px-4">
                  <span className="text-xs font-semibold text-fg">{app.title}</span>
                  {app.folder ? (
                    <span className="font-mono text-xs font-normal text-fg-subtle">
                      {app.folder}
                    </span>
                  ) : null}
                </h2>
                <ul className="py-1">
                  {app.files.map((file) => (
                    <FileItem
                      key={file.path}
                      file={file}
                      appTitle={app.title}
                      open={isOpen(file.path)}
                      onToggle={() => toggle(file.path)}
                      activeFile={activeFile}
                      activeSymbol={activeSymbol}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

// Full class names, so Tailwind finds them when it scans the code.
const ROW = 'relative rounded-sm focus-visible:-outline-offset-2';
const ROW_STATE = {
  /** The selected item. */
  current: 'bg-accent-soft font-medium text-fg',
  /** The file of the selected symbol. */
  holds: 'font-medium text-fg hover:bg-raised',
  idle: 'text-fg-muted hover:bg-raised hover:text-fg',
};

/** The bar beside the selected row, so the selection shows by shape as well as colour. */
function SelectedBar() {
  return (
    <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent" />
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`size-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

interface FileItemProps {
  file: TreeFile;
  /** The app group's name. Many apps have a `src/index.ts`, so it is part of each name. */
  appTitle: string;
  open: boolean;
  onToggle: () => void;
  activeFile?: string;
  activeSymbol?: string;
}

/** One file: a button that shows or hides its symbols, its path as a link, and the symbols. */
function FileItem({ file, appTitle, open, onToggle, activeFile, activeSymbol }: FileItemProps) {
  const listId = useId();
  const where = `${file.label}, ${appTitle}`;
  const holdsSelection = file.path === activeFile;
  const fileIsCurrent = holdsSelection && activeSymbol === undefined;
  const hasSymbols = file.symbols.length > 0;

  return (
    <li>
      <div data-tree-id={file.path} className="flex items-center gap-0.5 px-1.5 md:px-2.5">
        {hasSymbols ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={listId}
            aria-label={`Symbols in ${where}`}
            title={open ? 'Hide symbols' : 'Show symbols'}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-subtle hover:bg-hover hover:text-fg focus-visible:-outline-offset-2"
          >
            <Chevron open={open} />
          </button>
        ) : (
          <span aria-hidden="true" className="size-6 shrink-0" />
        )}
        <Link
          to={paths.code({ file: file.path })}
          aria-current={fileIsCurrent ? 'page' : holdsSelection ? 'true' : undefined}
          title={file.path}
          className={`${ROW} min-w-0 flex-1 px-1.5 py-1 font-mono wrap-anywhere ${
            fileIsCurrent ? ROW_STATE.current : holdsSelection ? ROW_STATE.holds : ROW_STATE.idle
          }`}
        >
          {fileIsCurrent ? <SelectedBar /> : null}
          {file.label}
          <span className="sr-only">, {appTitle}</span>
        </Link>
      </div>

      {hasSymbols ? (
        <ul
          id={listId}
          hidden={!open}
          aria-label={`Symbols in ${where}`}
          className="mb-1 ml-4.5 border-l border-line pl-1 md:ml-5.5"
        >
          {file.symbols.map((symbol) => {
            const current = symbol.id === activeSymbol;
            return (
              <li key={symbol.id}>
                <Link
                  data-tree-id={symbol.id}
                  to={paths.code({ file: file.path, symbol: symbol.id })}
                  aria-current={current ? 'page' : undefined}
                  className={`${ROW} mr-1.5 flex flex-wrap items-baseline gap-x-2 px-2 py-0.5 md:mr-2.5 ${
                    current ? ROW_STATE.current : ROW_STATE.idle
                  }`}
                >
                  {current ? <SelectedBar /> : null}
                  <span className="min-w-0 font-mono wrap-anywhere">{symbol.name}</span>
                  <span className="flex items-baseline gap-x-1.5 text-xs font-normal text-fg-subtle">
                    <span>{SYMBOL_KIND_LABEL[symbol.kind]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">line {symbol.line}</span>
                  </span>
                  {symbol.routes.length > 0 ? (
                    <span className="basis-full font-mono text-xs font-normal text-fg-subtle">
                      {symbol.routes.join(', ')}
                    </span>
                  ) : null}
                  {/* Names like `env` repeat across apps, so the name read out says where. */}
                  <span className="sr-only">, in {where}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}
