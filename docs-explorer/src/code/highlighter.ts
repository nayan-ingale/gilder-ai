// Syntax highlighting for the source code viewer, with Shiki. Shiki, its regex engine, the
// theme and each grammar are imported dynamically, so none of it is in the main bundle: the
// highlighter is created the first time code is highlighted, and a grammar is downloaded the
// first time a file in that language is shown. The JavaScript regex engine avoids loading WASM.
import type { HighlighterCore, LanguageRegistration } from 'shiki/core';
import type { CodeLanguage } from './code-lines.ts';

/** Reads well on a near-black background. Its own background colour is not used. */
const THEME = 'github-dark-default';

/** Bits of a token's font style, as Shiki reports them. */
const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;
const STRIKETHROUGH = 8;

/** One coloured piece of a line. */
export interface HighlightToken {
  content: string;
  /** Where the token starts in the code; unique, so it doubles as a React key. */
  offset: number;
  /** A colour from the theme, as a hex string. */
  color?: string;
  italic: boolean;
  bold: boolean;
  underline: boolean;
  strikethrough: boolean;
}

/** One entry per line of the code, each a list of tokens. */
export type HighlightedLines = HighlightToken[][];

type GrammarModule = { default: LanguageRegistration[] };

const GRAMMARS: Record<CodeLanguage, () => Promise<GrammarModule>> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
};

let highlighter: Promise<HighlighterCore> | undefined;
/** The highlighter once it has each language's grammar loaded. */
const withLanguage = new Map<CodeLanguage, Promise<HighlighterCore>>();

// Recently highlighted code, so going back to a file doesn't tokenise it again.
const CACHE_SIZE = 12;
const cache = new Map<string, HighlightedLines>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighter().catch((error: unknown) => {
    highlighter = undefined; // Let a later call try again, e.g. after a failed download.
    throw error;
  });
  return highlighter;
}

async function createHighlighter(): Promise<HighlighterCore> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }] = await Promise.all([
    import('shiki/core'),
    import('shiki/engine/javascript'),
  ]);
  return createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [import('shiki/themes/github-dark-default.mjs')],
    langs: [],
  });
}

function highlighterFor(language: CodeLanguage): Promise<HighlighterCore> {
  let ready = withLanguage.get(language);
  if (!ready) {
    // Download the grammar alongside Shiki itself rather than after it. The no-op handler
    // only stops an early failure being reported as unhandled; loadLanguage still sees it.
    const grammar = GRAMMARS[language]();
    grammar.catch(() => undefined);
    ready = getHighlighter()
      .then(async (core) => {
        await core.loadLanguage(grammar);
        return core;
      })
      .catch((error: unknown) => {
        withLanguage.delete(language);
        throw error;
      });
    withLanguage.set(language, ready);
  }
  return ready;
}

/**
 * Highlights `code` (with `\n` line endings) and returns its tokens, one entry per line.
 * Rejects if Shiki or the grammar can't be loaded; callers then keep showing plain text.
 */
export async function highlightCode(
  code: string,
  language: CodeLanguage,
): Promise<HighlightedLines> {
  const key = `${language}\n${code}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const core = await highlighterFor(language);
  const lines = core.codeToTokensBase(code, { lang: language, theme: THEME }).map((line) =>
    line.map((token): HighlightToken => {
      const style = Math.max(token.fontStyle ?? 0, 0); // -1 means "not set"
      return {
        content: token.content,
        offset: token.offset,
        color: token.color,
        italic: (style & ITALIC) !== 0,
        bold: (style & BOLD) !== 0,
        underline: (style & UNDERLINE) !== 0,
        strikethrough: (style & STRIKETHROUGH) !== 0,
      };
    }),
  );

  cache.set(key, lines);
  if (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return lines;
}
