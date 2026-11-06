import { lazy } from 'react';

// Search (the dialog, the index and MiniSearch) is left out of the first page load. It
// downloads once the page is idle, or sooner when a search button is pointed at or focused.

const load = () => import('./SearchDialog.tsx');

/**
 * Starts the download early. A failure is ignored here: opening search imports it again, and
 * if that fails too, AppShell shows a message with a Try again button.
 */
export function preloadSearch(): void {
  load().catch(() => undefined);
}

/**
 * A new lazy search dialog. React.lazy keeps the result of its first load, even a failed one,
 * so each try at loading search needs a new one.
 */
export function createSearchDialog() {
  return lazy(() => load().then((module) => ({ default: module.SearchDialog })));
}
