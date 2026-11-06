// The page's scrolling area: AppShell's <main>. Pages that scroll it themselves find it by id.

export const MAIN_ID = 'main';

export function mainArea(): HTMLElement | null {
  return document.getElementById(MAIN_ID);
}
