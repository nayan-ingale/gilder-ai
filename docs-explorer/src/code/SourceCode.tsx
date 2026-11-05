// The source code viewer: the real code of a symbol with line numbers and syntax highlighting.
// The file's code is downloaded only when shown. It appears as plain text first and Shiki's
// tokens replace it in the same layout once they are ready, so nothing moves.
import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import type { SourceFileContent } from '../data/source-index.ts';
import {
  clamp,
  findHighlightLines,
  languageOf,
  normaliseLineEndings,
  splitLines,
  type LineRange,
} from './code-lines.ts';
import { highlightCode, type HighlightToken, type HighlightedLines } from './highlighter.ts';
import { loadSource, SourceNotInBuildError } from './load-source.ts';

interface SourceCodeProps {
  filePath: string;
  /** The symbol's first line, 1-based. */
  startLine: number;
  /** The symbol's last line, inclusive. */
  endLine: number;
  /** Exact text inside the symbol to mark, e.g. one call in a bigger function. */
  highlight?: string;
}

type LoadResult =
  { key: string; source: SourceFileContent } | { key: string; error: 'missing' | 'failed' };

/** Lines kept visible above the symbol when the whole file scrolls to it. */
const CONTEXT_LINES = 3;
const MAX_SKELETON_LINES = 8;
const COPY_MESSAGE_MS = 2000;

const BUTTON =
  'rounded border border-line px-2 py-0.5 text-fg-muted hover:bg-hover hover:text-fg ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';

/** Shows the code of `filePath` from `startLine` to `endLine`, or the whole file on request. */
export function SourceCode({ filePath, startLine, endLine, highlight }: SourceCodeProps) {
  const pathId = useId();
  const rangeId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Loading. Results are stored with the request they answer, so a result for an older file
  // (or an older attempt) is never shown, and changing file shows the loading state at once.
  const [attempt, setAttempt] = useState(0);
  const loadKey = `${attempt}:${filePath}`;
  const [loaded, setLoaded] = useState<LoadResult>();
  useEffect(() => {
    let active = true;
    loadSource(filePath).then(
      (source) => {
        if (active) setLoaded({ key: loadKey, source });
      },
      (error: unknown) => {
        if (!active) return;
        const missing = error instanceof SourceNotInBuildError;
        if (!missing) console.error(`Couldn't load the code of ${filePath}`, error);
        setLoaded({ key: loadKey, error: missing ? 'missing' : 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [filePath, loadKey]);
  const current = loaded?.key === loadKey ? loaded : undefined;
  const source = current && 'source' in current ? current.source : undefined;
  const loadError = current && 'error' in current ? current.error : undefined;

  // Highlighting, after the plain text is on screen. Plain text stays if it fails.
  const language = languageOf(filePath);
  const [highlighted, setHighlighted] = useState<{
    source: SourceFileContent;
    tokens: HighlightedLines;
  }>();
  useEffect(() => {
    if (!source || !language) return;
    let active = true;
    highlightCode(normaliseLineEndings(source.code), language).then(
      (tokens) => {
        if (active) setHighlighted({ source, tokens });
      },
      (error: unknown) => {
        console.error(`Couldn't highlight the code of ${source.path}`, error);
      },
    );
    return () => {
      active = false;
    };
  }, [source, language]);
  const tokens = highlighted && highlighted.source === source ? highlighted.tokens : undefined;

  const lines = useMemo(() => (source ? splitLines(source.code) : []), [source]);
  const highlightRange = useMemo(
    () =>
      source && highlight
        ? findHighlightLines(source.code, startLine, endLine, highlight)
        : undefined,
    [source, startLine, endLine, highlight],
  );

  // The symbol's lines, kept inside the file in case the index and the code disagree.
  const lineCount = lines.length;
  const first = clamp(startLine, 1, Math.max(lineCount, 1));
  const last = clamp(endLine, first, Math.max(lineCount, 1));
  const coversFile = first === 1 && last >= lineCount;

  // "Show whole file" applies to this symbol only; opening another one starts on its lines.
  const viewKey = `${filePath}:${startLine}-${endLine}`;
  const [wholeFileFor, setWholeFileFor] = useState<string>();
  const wholeFile = wholeFileFor === viewKey && !coversFile;
  const from = wholeFile ? 1 : first;
  const to = wholeFile ? lineCount : last;
  // Memoised so CodeRows (memo) skips re-rendering the whole file when only the header changes.
  const symbolRange = useMemo<LineRange | undefined>(
    () => (wholeFile ? { start: first, end: last } : undefined),
    [wholeFile, first, last],
  );

  // In the whole file, scroll the block (not the page) to the symbol or its highlight.
  const scrollTarget = highlightRange?.start ?? first;
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!wholeFile || !container) return;
    const row = container.querySelector<HTMLElement>(`[data-line="${scrollTarget}"]`);
    if (!row) return;
    const top =
      row.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTop = Math.max(0, top - CONTEXT_LINES * row.offsetHeight);
  }, [wholeFile, scrollTarget]);

  // Copying, announced politely to screen readers by the status element in the header.
  const [copyMessage, setCopyMessage] = useState('');
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const timer = copyTimer;
    return () => window.clearTimeout(timer.current);
  }, []);
  const announce = (message: string): void => {
    setCopyMessage(message);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopyMessage(''), COPY_MESSAGE_MS);
  };
  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(lines.slice(from - 1, to).join('\n'));
      announce('Copied');
    } catch {
      announce("Couldn't copy");
    }
  };

  const rangeLabel = startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}–${endLine}`;
  const slash = filePath.lastIndexOf('/');
  const directory = filePath.slice(0, slash + 1);
  const fileName = filePath.slice(slash + 1);

  return (
    <figure
      aria-labelledby={`${pathId} ${rangeId}`}
      className="overflow-hidden rounded-md border border-line bg-canvas"
    >
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-3 py-1.5 text-xs">
        {/* The directory gives way first, so the file name stays readable. */}
        <span id={pathId} title={filePath} className="flex min-w-0 flex-1 basis-48 font-mono">
          {directory ? <span className="truncate text-fg-subtle">{directory}</span> : null}
          <span className="shrink-0 text-fg">{fileName}</span>
        </span>
        <span id={rangeId} className="shrink-0 whitespace-nowrap text-fg-subtle tabular-nums">
          {rangeLabel}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span role="status" className="text-fg-subtle">
            {copyMessage}
          </span>
          {coversFile && source ? null : (
            <button
              type="button"
              disabled={!source}
              onClick={() => setWholeFileFor(wholeFile ? undefined : viewKey)}
              className={BUTTON}
            >
              {wholeFile ? 'Show only these lines' : 'Show whole file'}
            </button>
          )}
          <button type="button" disabled={!source} onClick={() => void copy()} className={BUTTON}>
            Copy
          </button>
        </span>
      </figcaption>

      {loadError ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm text-fg-muted">
          {loadError === 'missing' ? (
            <p>The code for this file isn&apos;t in the build.</p>
          ) : (
            <>
              <p>The code for this file couldn&apos;t be loaded.</p>
              <button
                type="button"
                onClick={() => setAttempt((count) => count + 1)}
                className={`${BUTTON} text-xs`}
              >
                Try again
              </button>
            </>
          )}
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="region"
          tabIndex={0}
          aria-label={
            wholeFile ? `Code of ${filePath}` : `Code of ${filePath}, ${rangeLabel.toLowerCase()}`
          }
          aria-busy={!source}
          className={`relative overflow-auto focus-visible:-outline-offset-2 ${wholeFile ? 'max-h-[min(36rem,70vh)]' : ''}`}
        >
          {source ? (
            <pre className="py-2 font-mono text-[13px] leading-5 text-fg">
              <code className="block w-max min-w-full">
                <CodeRows
                  lines={lines}
                  tokens={tokens}
                  from={from}
                  to={to}
                  highlight={highlightRange}
                  symbol={symbolRange}
                />
              </code>
            </pre>
          ) : (
            <SkeletonLines
              count={clamp(endLine - startLine + 1, 1, MAX_SKELETON_LINES)}
              firstLine={startLine}
            />
          )}
        </div>
      )}
    </figure>
  );
}

interface CodeRowsProps {
  lines: string[];
  tokens: HighlightedLines | undefined;
  /** First and last line to show, 1-based and inclusive. */
  from: number;
  to: number;
  /** Lines of the `highlight` text: strongest mark. */
  highlight: LineRange | undefined;
  /** The symbol's lines, marked lightly when the whole file is shown. */
  symbol: LineRange | undefined;
}

type RowMark = 'highlight' | 'symbol' | 'none';

// Full class names, so Tailwind finds them when it scans the code.
const ROW: Record<RowMark, string> = {
  highlight: 'bg-accent-soft',
  symbol: 'bg-surface',
  none: '',
};
// The number cell is sticky, so it needs an opaque background (bg-canvas) under the mark.
const NUMBER: Record<RowMark, string> = {
  highlight: 'border-accent bg-accent-soft text-fg-muted',
  symbol: 'border-line-strong bg-surface text-fg-subtle',
  none: 'border-transparent text-fg-subtle',
};

function within(line: number, range: LineRange | undefined): boolean {
  return range !== undefined && line >= range.start && line <= range.end;
}

/** The numbered lines. Memoised: re-rendering a whole file for a header change is wasted work. */
const CodeRows = memo(function CodeRows({
  lines,
  tokens,
  from,
  to,
  highlight,
  symbol,
}: CodeRowsProps) {
  const numberWidth = `${String(to).length}ch`;
  const rows: ReactElement[] = [];
  for (let line = from; line <= to; line += 1) {
    const mark: RowMark = within(line, highlight)
      ? 'highlight'
      : within(line, symbol)
        ? 'symbol'
        : 'none';
    const lineTokens = tokens?.[line - 1];
    rows.push(
      <span key={line} data-line={line} className={`flex ${ROW[mark]}`}>
        <span aria-hidden="true" className="sticky left-0 shrink-0 bg-canvas select-none">
          <span
            style={{ width: numberWidth }}
            className={`box-content block border-l-2 pr-4 pl-3 text-right tabular-nums ${NUMBER[mark]}`}
          >
            {line}
          </span>
        </span>
        <span className="pr-4">
          {lineTokens
            ? lineTokens.map((token) => (
                <span key={token.offset} style={tokenStyle(token)}>
                  {token.content}
                </span>
              ))
            : lines[line - 1]}
        </span>
      </span>,
    );
  }
  return rows;
});

function tokenStyle(token: HighlightToken): CSSProperties {
  const decoration = [token.underline ? 'underline' : '', token.strikethrough ? 'line-through' : '']
    .filter(Boolean)
    .join(' ');
  return {
    color: token.color,
    fontStyle: token.italic ? 'italic' : undefined,
    fontWeight: token.bold ? 600 : undefined,
    textDecorationLine: decoration || undefined,
  };
}

// Widths cycle so the placeholder looks like code rather than a block.
const SKELETON_WIDTHS = ['w-2/3', 'w-1/2', 'w-5/6', 'w-1/3', 'w-3/4', 'w-2/5', 'w-7/12', 'w-1/4'];

/** Placeholder lines while the file's code downloads, about as tall as the code will be. */
function SkeletonLines({ count, firstLine }: { count: number; firstLine: number }) {
  return (
    <div className="py-2">
      <p className="sr-only">Loading the code</p>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={firstLine + index}
          aria-hidden="true"
          className="flex h-5 items-center gap-4 pr-4 pl-3.5"
        >
          <span className="h-2.5 w-5 shrink-0 rounded-sm bg-raised" />
          <span
            className={`h-2.5 rounded-sm bg-raised ${SKELETON_WIDTHS[index % SKELETON_WIDTHS.length] ?? ''}`}
          />
        </div>
      ))}
    </div>
  );
}
