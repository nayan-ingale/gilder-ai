import { describe, expect, it } from 'vitest';
import { clamp, findHighlightLines, languageOf, splitLines } from './code-lines.ts';

const code = [
  'import express from "express";', // 1
  '', // 2
  'export function createApp() {', // 3
  '  const app = express();', // 4
  '  app.use(express.json());', // 5
  '  app.use(', // 6
  '    errorHandler(logger),', // 7
  '  );', // 8
  '  return app;', // 9
  '}', // 10
  '', // 11
  'app.use(express.json());', // 12
].join('\n');

describe('splitLines', () => {
  it('splits on LF without adding a line for the final line ending', () => {
    expect(splitLines('a\nb\n')).toEqual(['a', 'b']);
    expect(splitLines('a\nb')).toEqual(['a', 'b']);
  });

  it('keeps blank lines, including a blank last line before the final line ending', () => {
    expect(splitLines('a\n\nb\n\n')).toEqual(['a', '', 'b', '']);
  });

  it('handles CRLF and lone CR line endings', () => {
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b']);
    expect(splitLines('a\rb')).toEqual(['a', 'b']);
  });

  it('returns no lines for an empty file', () => {
    expect(splitLines('')).toEqual([]);
  });
});

describe('findHighlightLines', () => {
  it('finds a one-line highlight inside the symbol', () => {
    expect(findHighlightLines(code, 3, 10, 'app.use(express.json());')).toEqual({
      start: 5,
      end: 5,
    });
  });

  it('finds a highlight that spans several lines', () => {
    expect(findHighlightLines(code, 3, 10, 'app.use(\n    errorHandler(logger),\n  );')).toEqual({
      start: 6,
      end: 8,
    });
  });

  it('keeps a trailing line ending on the line it ends', () => {
    expect(findHighlightLines(code, 3, 10, '  app.use(\n')).toEqual({ start: 6, end: 6 });
  });

  it('ignores text outside the symbol lines', () => {
    // Only line 12 matches once the symbol (lines 3-10) is left out.
    expect(findHighlightLines(code, 11, 12, 'app.use(express.json());')).toEqual({
      start: 12,
      end: 12,
    });
    expect(findHighlightLines(code, 3, 10, 'import express')).toBeUndefined();
  });

  it('does not match across the edge of the symbol', () => {
    expect(
      findHighlightLines(code, 3, 7, 'app.use(\n    errorHandler(logger),\n  );'),
    ).toBeUndefined();
  });

  it('returns the first occurrence when the text appears more than once', () => {
    expect(findHighlightLines(code, 1, 12, 'app.use(express.json());')).toEqual({
      start: 5,
      end: 5,
    });
  });

  it('returns undefined when the text is not there, or the highlight is empty', () => {
    expect(findHighlightLines(code, 3, 10, 'app.listen(3000);')).toBeUndefined();
    expect(findHighlightLines(code, 3, 10, '')).toBeUndefined();
  });

  it('normalises CRLF in both the code and the highlight', () => {
    const crlf = code.replaceAll('\n', '\r\n');
    expect(findHighlightLines(crlf, 3, 10, 'app.use(\r\n    errorHandler(logger),')).toEqual({
      start: 6,
      end: 7,
    });
    expect(findHighlightLines(code, 3, 10, 'app.use(\r\n    errorHandler(logger),')).toEqual({
      start: 6,
      end: 7,
    });
  });

  it('copes with a range outside the file', () => {
    expect(findHighlightLines(code, 9, 400, '}')).toEqual({ start: 10, end: 10 });
    expect(findHighlightLines(code, 50, 60, '}')).toBeUndefined();
  });
});

describe('languageOf', () => {
  it('picks the language from the extension', () => {
    expect(languageOf('backend/shared/src/errors.ts')).toBe('typescript');
    expect(languageOf('frontend/src/app/page.tsx')).toBe('tsx');
    expect(languageOf('scripts/build.mjs')).toBe('typescript');
    expect(languageOf('src/App.JSX')).toBe('tsx');
  });

  it('returns undefined for other files', () => {
    expect(languageOf('package.json')).toBeUndefined();
    expect(languageOf('Dockerfile')).toBeUndefined();
    expect(languageOf('backend/.env')).toBeUndefined();
  });
});

describe('clamp', () => {
  it('keeps a value within bounds', () => {
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(11, 1, 10)).toBe(10);
  });
});
