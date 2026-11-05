// Class names the detail views share, so links, code and small labels look the same everywhere
// in the panel. Written out in full so Tailwind finds them when it scans the code.

/** A text link inside the panel. */
export const LINK = 'rounded-sm text-accent hover:underline';

/** Inline code: names, types, paths. Breaks anywhere so long types never widen the panel. */
export const CODE = 'font-mono text-xs text-fg wrap-anywhere';

/** A file path or line number next to a name. */
export const LOCATION = 'font-mono text-xs text-fg-subtle wrap-anywhere';

/** A plain bullet-free list with a little space between items. */
export const LIST = 'flex flex-col gap-1';

/** A paragraph of body text. */
export const TEXT = 'text-sm leading-relaxed text-fg-muted';
