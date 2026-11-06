// Class names the docs page views share, written out in full so Tailwind finds them.

/** A docs section: kept clear of the top edge when scrolled to, and focusable by script only. */
export const SECTION = 'scroll-mt-4 border-t border-line pt-5 focus-visible:outline-none';

/** The row holding a section's title (and status). Marked for a moment when a link opens it. */
export function headingRow(marked: boolean): string {
  return `-mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1 transition-colors duration-700 ${
    marked ? 'bg-accent-soft' : ''
  }`;
}

/** A section's title. */
export const SECTION_TITLE = 'text-base font-semibold text-fg';
