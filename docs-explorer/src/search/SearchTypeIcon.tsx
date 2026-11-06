import type { SearchType } from './search-documents.ts';

// A small line icon for each kind of search result. Decorative: the result's label says the
// same thing in words.

const PATHS: Record<SearchType, string> = {
  // A window with a title bar.
  page: 'M2.5 3.5h11v9h-11zM2.5 6h11',
  // An open book.
  doc: 'M8 4.5C6.75 3.5 4.75 3 2.5 3v9.5c2.25 0 4.25.5 5.5 1.5 1.25-1 3.25-1.5 5.5-1.5V3c-2.25 0-4.25.5-5.5 1.5zM8 4.5V14',
  // Two steps joined by a line.
  flow: 'M2.5 2.5h4v4h-4zM9.5 9.5h4v4h-4zM4.5 6.5v5h5',
  // An arrow: a request going in.
  route: 'M2.5 8h8.5M8.5 5l3 3-3 3',
  step: 'M8 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z',
  // A box.
  component: 'M8 2.5l5 2.75v5.5L8 13.5l-5-2.75v-5.5zM3 5.25L8 8l5-2.75M8 8v5.5',
  // Curly braces.
  symbol:
    'M6 2.5h-.5A1.5 1.5 0 0 0 4 4v2.5L2.5 8 4 9.5V12a1.5 1.5 0 0 0 1.5 1.5H6M10 2.5h.5A1.5 1.5 0 0 1 12 4v2.5L13.5 8 12 9.5V12a1.5 1.5 0 0 1-1.5 1.5H10',
  // A page with a folded corner.
  file: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
};

export function SearchTypeIcon({ type }: { type: SearchType }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[type]} />
    </svg>
  );
}
