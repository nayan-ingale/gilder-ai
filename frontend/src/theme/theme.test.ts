import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { themeCookie } from './apply-theme';
import { THEME_SCRIPT } from './theme';
import { isTheme } from './theme-names';

/** Runs the head script against a fake document with the given cookies. */
function themeAfterScript(cookie: string): string | undefined {
  const document = { cookie, documentElement: { dataset: {} as Record<string, string> } };
  runInNewContext(THEME_SCRIPT, { document });
  return document.documentElement.dataset.theme;
}

describe('the theme script', () => {
  it('applies a light or dark choice from the cookie', () => {
    expect(themeAfterScript('gilder_theme=dark')).toBe('dark');
    expect(themeAfterScript('a=1; gilder_theme=light; b=2')).toBe('light');
  });

  it('leaves the theme to the system for "system", no cookie or any other value', () => {
    for (const cookie of [
      'gilder_theme=system',
      '',
      'other_gilder_theme=dark',
      'gilder_theme=dark<script>',
    ]) {
      expect(themeAfterScript(cookie)).toBeUndefined();
    }
  });
});

describe('theme choices', () => {
  it('writes a cookie the script can read, for a year, on every page', () => {
    expect(themeCookie('dark')).toBe('gilder_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax');
  });

  it('accepts only the three themes', () => {
    expect(['system', 'light', 'dark'].every(isTheme)).toBe(true);
    expect(isTheme('neon')).toBe(false);
  });
});
