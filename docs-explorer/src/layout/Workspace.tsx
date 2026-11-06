import { useEffect, useEffectEvent, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../details/RichText.tsx';
import { CloseIcon, NarrowIcon, PanelIcon, WidenIcon } from '../ui/icons.tsx';
import { PanelInsetContext, type PanelInset } from './panel-inset.ts';

// Matches Tailwind's `lg` breakpoint: from here up the detail panel sits beside the graph;
// below it, it is a sheet over the bottom of the graph.
const PANEL_BESIDE = '(min-width: 64rem)';

interface WorkspaceProps {
  /** The page heading. */
  title: string;
  summary?: string;
  /** Small facts under the heading, such as a status badge, a route or the apps. */
  meta?: ReactNode;
  /** More about what the page shows, under the summary, such as the docs sections about it. */
  related?: ReactNode;
  /** The main area, usually a graph. It fills the space left beside the panel. */
  children: ReactNode;
  /** Details of the selected item; undefined when nothing is selected. */
  panel?: ReactNode;
  /** Accessible name of the panel: the selected item's name. */
  panelLabel?: string;
  /**
   * What is selected, as a unique key (names can repeat: many files have an `env`). A new key
   * opens a folded panel and starts its content at the top. Defaults to `panelLabel`.
   */
  panelKey?: string;
  /** Clears the selection. */
  onClosePanel?: () => void;
}

const ICON_BUTTON =
  'size-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-hover hover:text-fg';

/** The summary, cut to two lines, with a button beside it to read the rest when it is longer. */
function Summary({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || open) return;
    // The observer reports once right away, then on every resize.
    const observer = new ResizeObserver(() => {
      setCut(element.scrollHeight > element.clientHeight + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, text]);

  return (
    <div className="mt-1 flex max-w-5xl items-end gap-3">
      <p
        ref={ref}
        id={id}
        className={`min-w-0 flex-1 text-sm/5 text-fg-muted ${open ? '' : 'line-clamp-2'}`}
      >
        <RichText text={text} />
      </p>
      {cut || open ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          className="shrink-0 rounded-sm text-xs/5 text-accent hover:underline"
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

const HINT = 'Select a node to see its details.';

/**
 * The frame of the graph pages: a heading, the graph, and a detail panel for what is selected.
 * On wide screens the panel sits beside the graph. With nothing selected it is a thin rail, so
 * the graph gets the room; a selection opens it, and it can be widened (for reading code) or
 * folded back to the rail. On narrow screens it is a sheet over the bottom of the graph, shown
 * only while something is selected; Escape or the close button clears the selection.
 */
export function Workspace({
  title,
  summary,
  meta,
  related,
  children,
  panel,
  panelLabel,
  panelKey = panelLabel,
  onClosePanel,
}: WorkspaceProps) {
  const [wide, setWide] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const hintId = useId();
  const hasPanel = panel !== undefined;

  // Folding is for the item that was open when it was folded: selecting a different one opens
  // the panel again.
  const [userFolded, setUserFolded] = useState(false);
  const [foldedKey, setFoldedKey] = useState(panelKey);
  if (foldedKey !== panelKey) {
    setFoldedKey(panelKey);
    setUserFolded(false);
  }
  const folded = !hasPanel || userFolded;

  // Clearing the selection hides the panel's content. If focus was in there, it moves to the
  // graph area instead of being lost.
  const closePanel = () => {
    const focusWasInside = asideRef.current?.contains(document.activeElement) ?? false;
    onClosePanel?.();
    if (focusWasInside) stageRef.current?.focus({ preventScroll: true });
  };
  const onEscape = useEffectEvent(closePanel);

  // Escape closes the sheet on narrow screens. Beside the graph the panel is part of the page,
  // not an overlay, so Escape leaves it alone there.
  useEffect(() => {
    if (!hasPanel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (window.matchMedia(PANEL_BESIDE).matches) return;
      onEscape();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hasPanel]);

  // A link inside the panel (to a symbol, say) swaps its content and removes the focused link.
  // Focus then moves to the new content instead of falling back to the start of the page.
  const shownKey = useRef(panelKey);
  useEffect(() => {
    if (shownKey.current === panelKey) return;
    shownKey.current = panelKey;
    const active = document.activeElement;
    if (!active || active === document.body) contentRef.current?.focus({ preventScroll: true });
  }, [panelKey]);

  // Below lg the sheet covers the bottom of the graph; the graph reads how much from context.
  const [sheetHeight, setSheetHeight] = useState(0);
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside || !hasPanel) return;
    const beside = window.matchMedia(PANEL_BESIDE);
    const measure = () => {
      setSheetHeight(beside.matches ? 0 : Math.round(aside.getBoundingClientRect().height));
    };
    // The observer reports once right away, then whenever the sheet changes size.
    const observer = new ResizeObserver(measure);
    observer.observe(aside);
    beside.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      beside.removeEventListener('change', measure);
    };
  }, [hasPanel]);
  const insetBottom = hasPanel ? sheetHeight : 0;
  const inset = useMemo<PanelInset>(() => ({ bottom: insetBottom }), [insetBottom]);

  const width = folded ? 'lg:w-10' : wide ? 'lg:w-[min(60vw,900px)]' : 'lg:w-110';
  const hiddenWhenFolded = folded ? 'lg:hidden' : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-line px-4 py-2.5 md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="text-base/6 font-semibold text-fg">{title}</h1>
          {meta ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
              {meta}
            </div>
          ) : null}
        </div>
        {summary ? <Summary key={summary} text={summary} /> : null}
        {related}
      </header>

      <div className="relative flex min-h-72 flex-1">
        <div
          ref={stageRef}
          tabIndex={-1}
          className="relative min-h-0 min-w-0 flex-1 focus-visible:outline-none"
        >
          <PanelInsetContext value={inset}>
            <div className="absolute inset-0">{children}</div>
          </PanelInsetContext>
        </div>

        <aside
          ref={asideRef}
          aria-label={
            hasPanel
              ? panelLabel
                ? `Details: ${panelLabel}`
                : 'Details'
              : 'Details: nothing selected'
          }
          aria-describedby={hasPanel ? undefined : hintId}
          title={hasPanel ? undefined : HINT}
          className={`flex-col bg-surface ${
            hasPanel
              ? 'absolute inset-x-0 bottom-0 z-20 flex h-[70%] rounded-t-lg border-t border-line-strong shadow-lg'
              : 'hidden'
          } lg:static lg:z-auto lg:flex lg:h-auto lg:max-w-[calc(100%-16rem)] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l lg:border-line lg:shadow-none lg:transition-[width] lg:duration-150 lg:ease-out ${width}`}
        >
          <div className="flex h-10 shrink-0 items-center gap-1 border-b border-line px-1.5">
            {hasPanel ? (
              <button
                type="button"
                onClick={() => setUserFolded(!userFolded)}
                aria-expanded={!userFolded}
                aria-controls={contentId}
                aria-label={userFolded ? 'Show the details panel' : 'Hide the details panel'}
                title={userFolded ? 'Show the details panel' : 'Hide the details panel'}
                className={`${ICON_BUTTON} hidden lg:inline-flex`}
              >
                <PanelIcon />
              </button>
            ) : (
              <span
                aria-hidden="true"
                className="hidden size-7 shrink-0 items-center justify-center text-fg-subtle lg:inline-flex"
              >
                <PanelIcon />
              </span>
            )}
            <span
              className={`min-w-0 flex-1 truncate px-1 text-xs font-medium text-fg-subtle ${hiddenWhenFolded}`}
            >
              Details
            </span>
            {hasPanel ? (
              <button
                type="button"
                onClick={() => setWide(!wide)}
                aria-pressed={wide}
                aria-label="Wide panel"
                title={wide ? 'Make the panel narrower' : 'Make the panel wider'}
                className={`${ICON_BUTTON} hidden ${folded ? '' : 'lg:inline-flex'}`}
              >
                {wide ? <NarrowIcon /> : <WidenIcon />}
              </button>
            ) : null}
            {hasPanel && onClosePanel ? (
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close details"
                title="Close details"
                className={`${ICON_BUTTON} inline-flex ${hiddenWhenFolded}`}
              >
                <CloseIcon />
              </button>
            ) : null}
          </div>

          {folded ? (
            <span
              aria-hidden="true"
              className="hidden min-h-0 truncate px-2.5 py-3 text-xs text-fg-subtle [writing-mode:vertical-rl] lg:block"
            >
              {hasPanel ? (panelLabel ?? 'Details') : 'Nothing selected'}
            </span>
          ) : null}

          {hasPanel ? (
            <div
              // A new selection starts at the top of the panel. `relative` keeps screen-reader-only
              // text (position: absolute) inside this scroll box; without it, that text stretched
              // the whole page and made it scroll.
              key={panelKey}
              ref={contentRef}
              id={contentId}
              tabIndex={-1}
              className={`relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain focus-visible:outline-none ${hiddenWhenFolded}`}
            >
              {panel}
            </div>
          ) : (
            <p id={hintId} className="sr-only">
              {HINT}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
