// The keys that open search: ⌘K on Apple devices, Ctrl+K elsewhere, and "/" when no text field
// has focus. Pure helpers, kept out of the hook so they can be tested.

export interface ShortcutInfo {
  /** Shown on the search button, e.g. "⌘K". */
  hint: string;
  /** For `aria-keyshortcuts`, e.g. "Meta+K". */
  keys: string;
}

/** Whether the device names its command key ⌘ (Mac, iPhone, iPad). */
export function isApplePlatform(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent);
}

export function shortcutInfo(apple: boolean): ShortcutInfo {
  return apple ? { hint: '⌘K', keys: 'Meta+K /' } : { hint: 'Ctrl K', keys: 'Control+K /' };
}

export const IS_APPLE = typeof navigator !== 'undefined' && isApplePlatform(navigator.userAgent);

export const SHORTCUT = shortcutInfo(IS_APPLE);

type KeyInfo = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/** Elements where "/" is typing, not a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * What a key press asks of search: `toggle` for ⌘K / Ctrl+K (it also closes an open search),
 * `open` for "/" outside text fields, or nothing. On Apple devices Ctrl+K is left alone, since
 * text fields there use it to delete to the end of the line.
 */
export function searchShortcut(
  event: KeyInfo,
  apple: boolean,
  typing: boolean,
): 'toggle' | 'open' | null {
  const command = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (command && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
    return 'toggle';
  }
  const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
  if (plain && event.key === '/' && !typing) return 'open';
  return null;
}
