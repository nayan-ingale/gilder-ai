/**
 * View choices a reader makes on the graphs (legend open, mini-map shown), remembered in this
 * browser. Storage can be missing or throw (private windows, blocked site data), so every read
 * and write is guarded: a choice that can't be stored is simply not remembered.
 */

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const LEGEND_OPEN_KEY = 'gilder-docs.graph.legend-open';
export const MINIMAP_SHOWN_KEY = 'gilder-docs.graph.minimap-shown';

function browserStorage(): FlagStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** The remembered choice, or undefined when there is none (or no storage). */
export function readFlag(
  key: string,
  storage: FlagStorage | undefined = browserStorage(),
): boolean | undefined {
  try {
    const value = storage?.getItem(key);
    return value === 'true' ? true : value === 'false' ? false : undefined;
  } catch {
    return undefined;
  }
}

export function writeFlag(
  key: string,
  value: boolean,
  storage: FlagStorage | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // Not remembered; the choice still holds until the page is left.
  }
}
