import { describe, expect, it } from 'vitest';
import { isApplePlatform, searchShortcut, shortcutInfo } from './shortcut.ts';

const key = (
  k: string,
  mods: Partial<Record<'meta' | 'ctrl' | 'alt' | 'shift', boolean>> = {},
) => ({
  key: k,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
});

describe('searchShortcut', () => {
  it('toggles search with ⌘K on Apple devices and Ctrl+K elsewhere', () => {
    expect(searchShortcut(key('k', { meta: true }), true, false)).toBe('toggle');
    expect(searchShortcut(key('K', { meta: true }), true, true)).toBe('toggle');
    expect(searchShortcut(key('k', { ctrl: true }), false, true)).toBe('toggle');
  });

  it('leaves the other platform’s combination alone', () => {
    expect(searchShortcut(key('k', { ctrl: true }), true, false)).toBeNull();
    expect(searchShortcut(key('k', { meta: true }), false, false)).toBeNull();
    expect(searchShortcut(key('k', { meta: true, shift: true }), true, false)).toBeNull();
  });

  it('opens search with "/" only outside text fields', () => {
    expect(searchShortcut(key('/'), true, false)).toBe('open');
    expect(searchShortcut(key('/'), true, true)).toBeNull();
    expect(searchShortcut(key('/', { ctrl: true }), false, false)).toBeNull();
  });

  it('ignores other keys', () => {
    expect(searchShortcut(key('k'), true, false)).toBeNull();
    expect(searchShortcut(key('Enter', { meta: true }), true, false)).toBeNull();
  });
});

describe('shortcutInfo', () => {
  it('names the keys the way the platform does', () => {
    expect(isApplePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true);
    expect(isApplePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(shortcutInfo(true).hint).toBe('⌘K');
    expect(shortcutInfo(false).hint).toBe('Ctrl K');
  });
});
