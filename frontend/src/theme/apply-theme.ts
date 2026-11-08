'use client';

import { THEME_COOKIE, type Theme } from './theme-names';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** The cookie that remembers a theme choice: readable by the head script, sent on every page. */
export function themeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/**
 * Applies a theme at once and remembers it on this device. The account keeps it too
 * (PATCH /api/me), so it follows the user to other devices after they sign in; when no one is
 * signed in, that call fails quietly and the cookie alone remembers it.
 */
export async function chooseTheme(theme: Theme): Promise<void> {
  document.cookie = themeCookie(theme);
  if (theme === 'system') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  try {
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ themePreference: theme }),
    });
  } catch {
    // Offline: the choice still applies on this device.
  }
}
