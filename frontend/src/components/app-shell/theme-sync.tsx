'use client';

import { useEffect } from 'react';
import { themeCookie } from '@/theme/apply-theme';
import { THEME_COOKIE, type Theme } from '@/theme/theme-names';

/**
 * Brings this device in line with the account's saved theme after sign-in, so a choice made on
 * one device follows the user to another.
 */
export function ThemeSync({ theme }: { theme: Theme }) {
  useEffect(() => {
    const current = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(\\w+)`))?.[1];
    if (current === theme) {
      return;
    }
    document.cookie = themeCookie(theme);
    if (theme === 'system') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);
  return null;
}
