// Pure helpers for the source code viewer: splitting a file into lines, finding the lines a
// highlight covers inside a symbol, and picking the highlighting language from the file name.
// Kept free of React and Shiki so they are cheap to test.

/** The languages the highlighter loads. Anything else is shown as plain text. */
export type CodeLanguage = 'typescript' | 'tsx';

/** A 1-based, inclusive range of lines. */
export interface LineRange {
  start: number;
  end: number;
}

/** Turns Windows (CRLF) and old Mac (CR) line endings into LF. */
export function normaliseLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * The file's lines, without their line endings. A final line ending does not start an extra
 * empty line, so the count matches what an editor shows (and the index's `lineCount`).
 */
export function splitLines(code: string): string[] {
  if (code === '') return [];
  return normaliseLineEndings(code).replace(/\n$/, '').split('\n');
}

/**
 * Where `highlight` first appears within lines `startLine`–`endLine` of `code`, as a 1-based
 * line range in the file. Matches the docs checker: the symbol's lines joined with `\n`, then
 * an exact text search, so a highlight may span several lines. Only line endings are
 * normalised. Returns undefined for an empty highlight or one that isn't in those lines.
 */
export function findHighlightLines(
  code: string,
  startLine: number,
  endLine: number,
  highlight: string,
): LineRange | undefined {
  const needle = normaliseLineEndings(highlight);
  if (needle === '') return undefined;

  const lines = splitLines(code);
  const first = Math.max(1, startLine);
  const last = Math.min(lines.length, endLine);
  if (last < first) return undefined;

  const region = lines.slice(first - 1, last).join('\n');
  const offset = region.indexOf(needle);
  if (offset === -1) return undefined;

  const start = first + countNewlines(region, 0, offset);
  // The match's last character decides its last line, so a trailing `\n` stays on its line.
  const end = start + countNewlines(region, offset, offset + needle.length - 1);
  return { start, end };
}

function countNewlines(text: string, from: number, to: number): number {
  let count = 0;
  for (let index = text.indexOf('\n', from); index !== -1 && index < to;) {
    count += 1;
    index = text.indexOf('\n', index + 1);
  }
  return count;
}

/** The highlighting language for a file, from its extension; undefined means plain text. */
export function languageOf(filePath: string): CodeLanguage | undefined {
  const extension = /\.([^./]+)$/.exec(filePath)?.[1]?.toLowerCase();
  switch (extension) {
    case 'tsx':
    case 'jsx':
      return 'tsx';
    case 'ts':
    case 'mts':
    case 'cts':
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'typescript';
    default:
      return undefined;
  }
}

/** Keeps `value` within `min`–`max` (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
