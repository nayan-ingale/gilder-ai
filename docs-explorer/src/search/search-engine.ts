// Finds and ranks search entries for a query. Titles count most, then subtitles and kinds,
// then the hidden text. Results come back in groups, in a fixed order, so the list always reads the same
// way; when the single best match is not already first, it gets its own group at the top.
import MiniSearch, { type SearchResult } from 'minisearch';
import type { SearchDocument, SearchType } from './search-documents.ts';

export type GroupId =
  'jump' | 'best' | 'pages' | 'docs' | 'flows' | 'steps' | 'components' | 'symbols' | 'files';

/** The groups results are listed in, in order. */
export const GROUP_ORDER: readonly GroupId[] = [
  'pages',
  'docs',
  'flows',
  'steps',
  'components',
  'symbols',
  'files',
];

export const GROUP_LABEL: Record<GroupId, string> = {
  jump: 'Jump to',
  best: 'Best match',
  pages: 'Pages',
  docs: 'Docs',
  flows: 'Flows & routes',
  steps: 'Steps',
  components: 'Components',
  symbols: 'Functions & types',
  files: 'Files',
};

const GROUP_OF: Record<SearchType, GroupId> = {
  page: 'pages',
  doc: 'docs',
  flow: 'flows',
  route: 'flows',
  step: 'steps',
  component: 'components',
  symbol: 'symbols',
  file: 'files',
};

/**
 * A small lift for the bigger things (pages, flows, components) over the many small ones, so a
 * component and a step with the same words list the component first.
 */
const TYPE_BOOST: Record<SearchType, number> = {
  page: 1.15,
  // Sections hold whole paragraphs, so they match many words; a part or flow with the same
  // name still comes first.
  doc: 1,
  flow: 1.15,
  route: 1.15,
  component: 1.15,
  symbol: 1,
  step: 0.85,
  file: 0.9,
};

/** A title matching the whole query word for word counts this much more. */
const EXACT_TITLE_BOOST = 1.6;

/**
 * A query typed as a path (`src/health.ts`) is after a file, but the symbols in that file
 * match the same words. A file whose path ends with the query counts this much more...
 */
const PATH_END_BOOST = 4;
/** ...and one whose path holds it (`src/heal`, still being typed) this much. */
const PATH_PART_BOOST = 2.5;

/** Titles count most, then where it lives and what kind it is, then the hidden text. */
const FIELD_BOOST = { title: 4, subtitle: 1.5, label: 1.5, text: 1 };

export const GROUP_LIMIT = 5;

/** A piece of a title; `match` marks the part that matched the query, shown in bold. */
export interface TitlePart {
  /** Where the part starts in the title: a stable key. */
  offset: number;
  text: string;
  match: boolean;
}

export interface SearchHit {
  doc: SearchDocument;
  parts: TitlePart[];
}

export interface SearchGroup {
  id: GroupId;
  label: string;
  hits: SearchHit[];
}

export interface SearchResults {
  /** The query as typed, trimmed. Empty means nothing was typed yet. */
  query: string;
  groups: SearchGroup[];
  /** How many entries matched, including the ones over a group's limit. */
  total: number;
}

export interface SearchEngine {
  search(query: string): SearchResults;
}

// Splits on spaces and punctuation, the same rule MiniSearch uses by default.
const SEPARATORS = /[\n\r\p{Z}\p{P}\p{S}]+/u;
const WORD = /[^\n\r\p{Z}\p{P}\p{S}]+/gu;
// Where a camelCase or PascalCase word starts a new part: `healthRouter` → health, Router.
const CAMEL_BOUNDARY = /(?<=[\p{Ll}\d])(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})/u;

/** The words of a query, as typed. */
export function queryTerms(text: string): string[] {
  return text.split(SEPARATORS).filter((term) => term !== '');
}

/**
 * The words of an entry, plus the parts of each camelCase word, so `router` finds
 * `healthRouter` while `healthRouter` still finds it as one word.
 */
export function indexTerms(text: string): string[] {
  return queryTerms(text).flatMap((word) => {
    const parts = word.split(CAMEL_BOUNDARY);
    return parts.length > 1 ? [word, ...parts] : [word];
  });
}

const normalize = (text: string): string => queryTerms(text.toLowerCase()).join(' ');

/** The query as a path, when it looks like one: one word with a `/` or a `.` in it. */
export function pathQuery(query: string): string | undefined {
  const trimmed = query.trim().toLowerCase();
  if (!/[/.]/.test(trimmed) || /\s/.test(trimmed)) return undefined;
  const path = trimmed.replace(/^\.?\/+/, '');
  return path === '' ? undefined : path;
}

/** How much a file's path matches a query typed as a path. */
function pathBoost(path: string | undefined, wanted: string | undefined): number {
  if (path === undefined || wanted === undefined) return 1;
  const lower = path.toLowerCase();
  if (lower === wanted || lower.endsWith(`/${wanted}`)) return PATH_END_BOOST;
  return lower.includes(wanted) ? PATH_PART_BOOST : 1;
}

/**
 * Splits a title into the parts that matched and the parts that didn't. A word (or a camelCase
 * part of one) that starts with a query word has that start marked; a word that matched with a
 * typo is marked whole.
 */
export function highlightTitle(
  title: string,
  query: readonly string[],
  matched: readonly string[] = [],
): TitlePart[] {
  const terms = query.map((term) => term.toLowerCase()).filter((term) => term !== '');
  const matchedTerms = new Set(matched.map((term) => term.toLowerCase()));
  const marked = new Array<boolean>(title.length).fill(false);

  const mark = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) marked[index] = true;
  };

  for (const word of title.matchAll(WORD)) {
    const pieces = [{ text: word[0], offset: word.index }];
    let offset = word.index;
    const camelParts = word[0].split(CAMEL_BOUNDARY);
    if (camelParts.length > 1) {
      for (const part of camelParts) {
        pieces.push({ text: part, offset });
        offset += part.length;
      }
    }
    for (const piece of pieces) {
      const lower = piece.text.toLowerCase();
      const prefix = terms
        .filter((term) => lower.startsWith(term))
        .reduce((longest, term) => Math.max(longest, term.length), 0);
      if (prefix > 0) mark(piece.offset, piece.offset + prefix);
      else if (matchedTerms.has(lower)) mark(piece.offset, piece.offset + piece.text.length);
    }
  }

  const parts: TitlePart[] = [];
  for (let index = 0; index < title.length; index += 1) {
    const match = marked[index] ?? false;
    const last = parts.at(-1);
    if (last && last.match === match) last.text += title.charAt(index);
    else parts.push({ offset: index, text: title.charAt(index), match });
  }
  return parts;
}

/** Builds the index once; each search then runs against it. */
export function createSearchEngine(documents: readonly SearchDocument[]): SearchEngine {
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const titles = new Map(documents.map((doc) => [doc.id, normalize(doc.title)]));
  const pages = documents.filter((doc) => doc.type === 'page');

  const index = new MiniSearch<SearchDocument>({
    fields: ['title', 'subtitle', 'label', 'text'],
    tokenize: indexTerms,
    searchOptions: {
      tokenize: queryTerms,
      boost: FIELD_BOOST,
      prefix: true,
      // Typos are forgiven only in longer words; in short ones they match too much.
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
  index.addAll(documents);

  const hit = (doc: SearchDocument, query: string[], matched: string[] = []): SearchHit => ({
    doc,
    parts: highlightTitle(doc.title, query, matched),
  });

  return {
    search(rawQuery) {
      const query = rawQuery.trim();
      if (query === '') {
        return {
          query,
          groups: [{ id: 'jump', label: GROUP_LABEL.jump, hits: pages.map((doc) => hit(doc, [])) }],
          total: pages.length,
        };
      }

      const wanted = normalize(query);
      const wantedPath = pathQuery(query);
      const results: SearchResult[] = index.search(query, {
        boostDocument: (id: string) => {
          const doc = byId.get(id);
          if (!doc) return 0;
          const exact = titles.get(id) === wanted ? EXACT_TITLE_BOOST : 1;
          return TYPE_BOOST[doc.type] * exact * pathBoost(doc.path, wantedPath);
        },
      });

      const hits = results.flatMap((result) => {
        const doc = byId.get(result.id as string);
        return doc ? [hit(doc, result.queryTerms, result.terms)] : [];
      });

      const grouped = new Map<GroupId, SearchHit[]>();
      for (const found of hits) {
        const group = GROUP_OF[found.doc.type];
        grouped.set(group, [...(grouped.get(group) ?? []), found]);
      }

      // The best match leads. When its group comes first anyway, it already does.
      const best = hits[0];
      const firstGroup = GROUP_ORDER.find((group) => grouped.has(group));
      const lift = best !== undefined && GROUP_OF[best.doc.type] !== firstGroup;

      const groups: SearchGroup[] = [];
      if (lift) groups.push({ id: 'best', label: GROUP_LABEL.best, hits: [best] });
      for (const id of GROUP_ORDER) {
        const members = (grouped.get(id) ?? []).filter((found) => !lift || found !== best);
        if (members.length > 0) {
          groups.push({ id, label: GROUP_LABEL[id], hits: members.slice(0, GROUP_LIMIT) });
        }
      }

      return { query, groups, total: hits.length };
    },
  };
}
