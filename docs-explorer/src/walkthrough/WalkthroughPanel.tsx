// The walkthrough panel: one step of a flow at a time, like a debugger paused on a line. It
// shows where the reader is, the function at this step, what happens inside, what goes in and
// comes out, where the path can go next and the real source, with Previous / Next controls and
// keyboard shortcuts. Everything comes from the docs and the code index; nothing is run.
import { useEffect, useEffectEvent, useId, useMemo, useRef, type RefObject } from 'react';
import { SourceCode } from '../code/SourceCode.tsx';
import type { Flow } from '../data/schema.ts';
import { CODE, LOCATION, TEXT } from '../details/classes.ts';
import { DetailHeader, MetaDot } from '../details/DetailHeader.tsx';
import { DetailSection } from '../details/DetailSection.tsx';
import { Fact, FactList } from '../details/FactList.tsx';
import { keyedStrings, stepLocation } from '../details/format.ts';
import { RichText } from '../details/RichText.tsx';
import { SymbolLink } from '../details/SymbolLink.tsx';
import { docs } from '../model/index.ts';
import { EDGE_KIND_LABEL, STEP_KIND_LABEL } from '../model/labels.ts';
import { EmptyState } from '../ui/EmptyState.tsx';
import { CloseIcon } from '../ui/icons.tsx';
import { StatusBadge } from '../ui/StatusBadge.tsx';
import {
  arrivedBy,
  nextMoves,
  openParallel,
  startTrail,
  type ParallelPart,
  type ParallelWork,
  type WalkMove,
  type WalkNext,
  type WalkPosition,
} from './walk.ts';

/** The controls a move can come from. After the move, focus goes back to the same one. */
export type WalkControl = 'previous' | 'next' | 'choice' | 'start';

interface WalkthroughPanelProps {
  flow: Flow;
  /** The steps visited so far, from parseTrail; the last is the current step. */
  trail: string[];
  /** Where the current step sits on the path (walkPosition of `trail`). */
  position: WalkPosition;
  /**
   * The trail as of the latest move. Right after a move it is ahead of `trail` until the page
   * shows the new step, so keys pressed in quick succession build on each other. Null once the
   * walkthrough is ending.
   */
  trailRef: RefObject<string[] | null>;
  /** Goes to another trail: one step on, one step back, or back to the start. */
  onMove: (trail: string[]) => void;
  /** Ends the walkthrough, keeping the current step selected. */
  onExit: () => void;
  /**
   * Each move replaces this panel with a new one (the layout starts it at the top). Before a
   * move, the panel notes here which control had focus; the new panel focuses the same one.
   */
  focusRef: RefObject<WalkControl | null>;
}

const BUTTON =
  'inline-flex min-h-7 items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY = `${BUTTON} bg-accent font-medium text-canvas hover:bg-accent/85 disabled:hover:bg-accent`;
const SECONDARY = `${BUTTON} border border-line text-fg-muted hover:bg-hover hover:text-fg disabled:hover:bg-transparent disabled:hover:text-fg-muted`;
const CHIP = 'rounded border border-line px-1 text-xs text-fg-muted';

/** A step title inside a sentence. Titles can hold commas, so they are quoted. */
const quote = (text: string): string => `“${text}”`;

export function WalkthroughPanel({
  flow,
  trail,
  position,
  trailRef,
  onMove,
  onExit,
  focusRef,
}: WalkthroughPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const next = useMemo(() => nextMoves(flow, trail), [flow, trail]);
  const arrived = useMemo(() => arrivedBy(flow, trail), [flow, trail]);
  const parallel = useMemo(() => openParallel(flow, trail), [flow, trail]);
  const currentId = trail.at(-1);
  const step = currentId === undefined ? undefined : docs.getStep(flow.id, currentId);
  const titleOf = (id: string): string => docs.getStep(flow.id, id)?.title ?? id;

  // Moves build on the latest trail, which a key pressed a moment ago may already have changed.
  const latest = (): string[] => trailRef.current ?? trail;
  const go = (to: string[], control: WalkControl) => {
    if (rootRef.current?.contains(document.activeElement)) focusRef.current = control;
    onMove(to);
  };
  /** Each returns whether it moved. */
  const goBack = (): boolean => {
    const from = latest();
    if (from.length < 2) return false;
    go(from.slice(0, -1), 'previous');
    return true;
  };
  const goNext = (): boolean => {
    const from = latest();
    const moves = nextMoves(flow, from);
    if (moves.type !== 'move') return false;
    go([...from, moves.move.to], 'next');
    return true;
  };
  // An option belongs to the step on screen: it is ignored if a key has already moved on.
  const take = (move: WalkMove, control: WalkControl) => {
    const from = latest();
    if (from.join(',') === trail.join(',')) go([...from, move.to], control);
  };

  // A new panel puts focus back on the control the move came from. After a choice it goes to
  // Next. If that control is disabled here (a choice waits, or the path ended), the layout
  // focuses the panel itself instead.
  useEffect(() => {
    const control = focusRef.current;
    focusRef.current = null;
    if (control === null) return;
    const wanted = control === 'choice' || control === 'start' ? 'next' : control;
    const button = rootRef.current?.querySelector<HTMLButtonElement>(
      `[data-walk-control="${wanted}"]`,
    );
    if (button && !button.disabled) button.focus({ preventScroll: true });
  }, [focusRef]);

  // ← previous, → next (only when there is one way on), Escape exits. Listening in the capture
  // phase runs this before the graph and the layout: Escape is marked handled
  // (preventDefault) and stopped there, so the layout doesn't also close the panel and the
  // graph doesn't also clear the selection.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || trailRef.current === null) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (modalIsOpen() || takesKeys(event.target)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onExit();
    } else if (event.key === 'ArrowLeft' && !scrollsSideways(event.target)) {
      if (goBack()) event.preventDefault();
    } else if (event.key === 'ArrowRight' && !scrollsSideways(event.target)) {
      if (goNext()) event.preventDefault();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, []);

  if (!step) {
    return (
      <EmptyState title="This step isn't in the docs">
        The flow <code className={CODE}>{flow.id}</code> has no step{' '}
        <code className={CODE}>{currentId ?? ''}</code>.
      </EmptyState>
    );
  }

  const located = step.symbol ? docs.getSymbol(step.symbol) : undefined;
  const sideEffects = step.sideEffects ?? [];
  const previousId = trail.at(-2);

  return (
    <div ref={rootRef}>
      <div
        role="group"
        aria-label="Walkthrough controls"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2"
      >
        <button
          type="button"
          data-walk-control="previous"
          disabled={trail.length < 2}
          onClick={() => goBack()}
          aria-keyshortcuts="ArrowLeft"
          className={SECONDARY}
        >
          <span aria-hidden="true">←</span>
          Previous
        </button>
        <button
          type="button"
          data-walk-control="next"
          disabled={next.type !== 'move'}
          onClick={() => goNext()}
          aria-keyshortcuts="ArrowRight"
          aria-describedby={next.type === 'move' ? undefined : hintId}
          className={PRIMARY}
        >
          Next
          <span aria-hidden="true">→</span>
        </button>
        {next.type === 'move' ? null : (
          <span id={hintId} className="text-xs text-fg-subtle">
            {next.type === 'choice' ? 'Pick a path below' : 'End of this path'}
          </span>
        )}
        <button
          type="button"
          onClick={onExit}
          aria-keyshortcuts="Escape"
          className="ml-auto inline-flex min-h-7 items-center gap-1 rounded-md px-2 py-1 text-xs text-fg-subtle transition-colors hover:bg-hover hover:text-fg"
        >
          <CloseIcon />
          Exit walkthrough
        </button>
      </div>

      {/* 1. Where the reader is. */}
      <DetailHeader
        title={step.title}
        meta={
          <>
            <span>
              Step {position.number} of {position.total} on this path
            </span>
            <MetaDot />
            <span>{STEP_KIND_LABEL[step.kind]}</span>
            <MetaDot />
            <StatusBadge status={step.status} />
          </>
        }
      >
        <div className="flex flex-col gap-1.5 text-xs text-fg-subtle">
          <p>
            {arrived && previousId !== undefined
              ? arrival(arrived, step.title, titleOf(previousId), titleOf)
              : 'The first step of this flow.'}
          </p>
          {parallel ? <p>{partLine(parallel, titleOf)}</p> : null}
          {position.choicesAhead ? (
            <p>The count takes the first option at each split ahead.</p>
          ) : null}
        </div>
      </DetailHeader>
      <div className="mx-4 mb-3 rounded-md border border-line bg-raised px-3 py-2 text-xs text-fg-muted">
        <p>
          This follows the documented flow through the source code, step by step. Nothing is sent or
          run.
        </p>
        <p className="mt-1 hidden text-fg-subtle pointer-fine:block">
          Keys: <kbd className="font-mono">←</kbd> previous · <kbd className="font-mono">→</kbd>{' '}
          next · <kbd className="font-mono">Esc</kbd> exit
        </p>
      </div>

      {/* 2. The function at this step. */}
      <DetailSection title="Function at this step">
        {located ? (
          <div className="flex flex-col gap-1.5">
            <SymbolLink id={located.symbol.id} location="none" />
            <p className={LOCATION}>
              {stepLocation(located.symbol, located.file.path, step.highlight !== undefined)}
            </p>
            {step.highlight ? (
              <div className="mt-1">
                <p className={TEXT}>This step is one line of it:</p>
                <pre
                  className={`mt-1 rounded border border-line bg-raised px-2 py-1.5 whitespace-pre-wrap ${CODE}`}
                >
                  {step.highlight}
                </pre>
              </div>
            ) : null}
          </div>
        ) : step.symbol ? (
          <p className={TEXT}>
            This step points at <SymbolLink id={step.symbol} />, which isn&apos;t in the code index.
          </p>
        ) : (
          <p className={TEXT}>This step is outside our code, so there is no function to show.</p>
        )}
      </DetailSection>

      {/* 3. What happens inside. */}
      <DetailSection title="What happens inside">
        <FactList>
          <Fact label="What happens">
            <p className={TEXT}>
              <RichText text={step.what} />
            </p>
          </Fact>
          <Fact label="Why it exists">
            <p className={TEXT}>
              <RichText text={step.why} />
            </p>
          </Fact>
        </FactList>
      </DetailSection>

      {/* 4 and 5. What goes in and what comes out. */}
      <DetailSection title="Input and output">
        <FactList>
          <Fact label="Input received">
            <OptionalText text={step.input} />
          </Fact>
          <Fact label="Output produced">
            <OptionalText text={step.output} />
          </Fact>
          {sideEffects.length > 0 ? (
            <Fact label="Side effects">
              <ul className={`list-disc space-y-1 pl-4 marker:text-fg-subtle ${TEXT}`}>
                {keyedStrings(sideEffects).map(({ key, value }) => (
                  <li key={key}>
                    <RichText text={value} />
                  </li>
                ))}
              </ul>
            </Fact>
          ) : null}
        </FactList>
      </DetailSection>

      {/* 6. Where the path goes next. */}
      <DetailSection title="What comes next">
        <NextStep
          next={next}
          stepTitle={step.title}
          titleOf={titleOf}
          onMove={(move) => take(move, next.type === 'choice' ? 'choice' : 'next')}
          onRestart={() => go(startTrail(flow), 'start')}
        />
      </DetailSection>

      {/* 7. The code itself. */}
      {located ? (
        <DetailSection title="Source">
          <SourceCode
            filePath={located.file.path}
            startLine={located.symbol.startLine}
            endLine={located.symbol.endLine}
            highlight={step.highlight}
          />
        </DetailSection>
      ) : null}
    </div>
  );
}

function OptionalText({ text }: { text?: string }) {
  return text ? (
    <p className={TEXT}>
      <RichText text={text} />
    </p>
  ) : (
    <p className="text-sm text-fg-subtle">Not written down for this step.</p>
  );
}

interface NextStepProps {
  next: WalkNext;
  /** The current step's title. */
  stepTitle: string;
  titleOf: (id: string) => string;
  onMove: (move: WalkMove) => void;
  onRestart: () => void;
}

/** The one way on, the labelled options of a split, or the end of the path. */
function NextStep({ next, stepTitle, titleOf, onMove, onRestart }: NextStepProps) {
  if (next.type === 'end') {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm font-medium text-fg">End of this path</p>
        <p className={TEXT}>
          Nothing follows {quote(stepTitle)} in the docs. Go back to take another option, or start
          again.
        </p>
        <button type="button" onClick={onRestart} className={SECONDARY}>
          Start again
        </button>
      </div>
    );
  }

  const later =
    next.later.length > 0 ? (
      <LaterList moves={next.later} titleOf={titleOf} onMove={onMove} />
    ) : null;

  if (next.type === 'move') {
    const note = moveNote(next.move, stepTitle, titleOf);
    return (
      <div className="flex flex-col gap-2">
        <MoveButton move={next.move} titleOf={titleOf} onMove={onMove} />
        {note ? <p className="text-xs text-fg-subtle">{note}</p> : null}
        {later}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className={TEXT}>The path splits after {quote(stepTitle)}. Pick the one to follow:</p>
      <ul className="flex flex-col gap-2">
        {next.options.map((move) => (
          <li key={move.to}>
            <MoveButton move={move} titleOf={titleOf} onMove={onMove} />
          </li>
        ))}
      </ul>
      {later}
    </div>
  );
}

interface MoveButtonProps {
  move: WalkMove;
  titleOf: (id: string) => string;
  onMove: (move: WalkMove) => void;
}

/** One way on: the kind of line, its condition, and the step it leads to. */
function MoveButton({ move, titleOf, onMove }: MoveButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onMove(move)}
      className="flex w-full flex-col items-start gap-1 rounded-md border border-line px-3 py-2 text-left transition-colors hover:border-line-strong hover:bg-hover"
    >
      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={CHIP}>{EDGE_KIND_LABEL[move.kind]}</span>
        {move.label ? <span className="text-sm text-fg-muted">{move.label}</span> : null}
      </span>
      <span className="flex items-baseline gap-1.5 text-sm font-medium text-fg">
        <span aria-hidden="true" className="text-fg-subtle">
          →
        </span>
        <span>
          <span className="sr-only">Go to: </span>
          {titleOf(move.to)}
        </span>
      </span>
    </button>
  );
}

interface LaterListProps {
  moves: WalkMove[];
  titleOf: (id: string) => string;
  onMove: (move: WalkMove) => void;
}

/** Async work beside the way on: it happens later, in the background. Each can be opened. */
function LaterList({ moves, titleOf, onMove }: LaterListProps) {
  return (
    <ul className="flex flex-col gap-1 border-t border-line pt-2">
      {moves.map((move) => (
        <li key={move.to} className="text-xs text-fg-subtle">
          <button
            type="button"
            onClick={() => onMove(move)}
            className="group inline-flex min-h-6 items-baseline gap-1 rounded-sm py-0.5 text-left"
          >
            <span>Also, later:</span>
            <span className="text-sm text-accent group-hover:underline">
              {quote(titleOf(move.to))}
            </span>
          </button>
          {move.label ? <span> — {move.label}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** A part of parallel work in words: its line's label, or the title of its first step. */
const partName = (part: ParallelPart | undefined, titleOf: (id: string) => string): string =>
  part ? quote(part.label ?? titleOf(part.step)) : '';

/** A list in words: "A", "A and B", "A, B and C". */
function wordList(items: string[]): string {
  const last = items.at(-1);
  if (last === undefined) return '';
  return items.length === 1 ? last : `${items.slice(0, -1).join(', ')} and ${last}`;
}

/** Which part of parallel work the current step belongs to, for the header. */
function partLine(work: ParallelWork, titleOf: (id: string) => string): string {
  return `Part ${work.index + 1} of ${work.parts.length} in this walkthrough: ${partName(work.parts[work.index], titleOf)}.`;
}

/** Extra words for a move that is more than a plain step on: parallel work, or later. */
function moveNote(
  move: WalkMove,
  stepTitle: string,
  titleOf: (id: string) => string,
): string | undefined {
  const parallel = move.parallel;
  if (parallel?.role === 'start') {
    const parts = wordList(parallel.parts.map((part) => partName(part, titleOf)));
    const meet = parallel.join
      ? ` They meet at ${quote(titleOf(parallel.join))} once every part is done.`
      : '';
    return `${quote(stepTitle)} starts work that runs at the same time: ${parts}. The walkthrough follows each part's own path, one after another.${meet}`;
  }
  if (parallel?.role === 'part') {
    const part = `part ${parallel.index + 1} of ${parallel.parts.length}: ${partName(parallel.parts[parallel.index], titleOf)}`;
    if (parallel.reachedJoin && parallel.join) {
      return `${quote(stepTitle)} leads on to ${quote(titleOf(parallel.join))}, which waits until every part is done. So the walkthrough starts ${part}.`;
    }
    return `Nothing follows ${quote(stepTitle)} in this part, so the walkthrough starts ${part}.`;
  }
  if (parallel?.role === 'join') {
    return `Every part started by ${quote(titleOf(parallel.fork))} has finished, so the flow goes on at ${quote(titleOf(move.to))}.`;
  }
  if (move.later) return `This happens later, not straight after ${quote(stepTitle)}.`;
  return undefined;
}

/** How the walk reached the current step, for the header. */
function arrival(
  move: WalkMove,
  stepTitle: string,
  fromTitle: string,
  titleOf: (id: string) => string,
): string {
  const parallel = move.parallel;
  if (parallel?.role === 'start' || parallel?.role === 'part') {
    const others = parallel.parts
      .filter((part) => part.step !== move.to)
      .map((part) => partName(part, titleOf));
    return `Started by ${quote(titleOf(parallel.fork))}, at the same time as ${wordList(others)}.`;
  }
  if (parallel?.role === 'join') {
    return `Every part started by ${quote(titleOf(parallel.fork))} has finished, so the flow goes on at ${quote(stepTitle)}.`;
  }
  const condition = move.label ? `: ${move.label}` : '';
  if (move.later) return `Runs later, after ${quote(fromTitle)}${condition}.`;
  if (move.kind === 'next') return `Comes after ${quote(fromTitle)}${condition}.`;
  return `Reached from ${quote(fromTitle)} by ${EDGE_KIND_LABEL[move.kind].toLowerCase()}${condition}.`;
}

// ---------------------------------------------------------------------------------------------
// When the walkthrough keys stand aside.

/** A modal dialog (the navigation drawer, a search box) is open. */
function modalIsOpen(): boolean {
  try {
    return document.querySelector('dialog:modal, [aria-modal="true"]') !== null;
  } catch {
    // Browsers without :modal: any open dialog counts.
    return document.querySelector('dialog[open], [aria-modal="true"]') !== null;
  }
}

const KEY_TAKERS = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="tablist"]',
  '[role="radiogroup"]',
  '[role="grid"]',
  '[role="tree"]',
  '[role="treegrid"]',
].join(', ');

/** Focus is in a field, or a widget that uses these keys itself. */
function takesKeys(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(KEY_TAKERS) !== null;
}

/** Focus is in a box that scrolls sideways (wide code): the arrow keys scroll it instead. */
function scrollsSideways(target: EventTarget | null): boolean {
  for (
    let element = target instanceof Element ? target : null;
    element && element !== document.body;
    element = element.parentElement
  ) {
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    const { overflowX } = window.getComputedStyle(element);
    if (overflowX === 'auto' || overflowX === 'scroll') return true;
  }
  return false;
}
