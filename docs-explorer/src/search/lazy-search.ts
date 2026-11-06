import { lazy } from 'react';

// Search (the dialog, the index and MiniSearch) loads the first time it is opened, so the first
// page load stays the same size. Pointing at or focusing a search button starts the download.

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
