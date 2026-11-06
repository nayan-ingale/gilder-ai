import { useEffect, useEffectEvent } from 'react';
import { IS_APPLE, isTypingTarget, searchShortcut } from './shortcut.ts';

interface SearchShortcutHandlers {
  /** "/" outside a text field. */
  open: () => void;
  /** ⌘K or Ctrl+K, anywhere, even in a text field. */
  toggle: () => void;
}

/** Opens search from the keyboard, from anywhere on the page. */
export function useSearchShortcut(handlers: SearchShortcutHandlers): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.repeat) return;
    const action = searchShortcut(event, IS_APPLE, isTypingTarget(event.target));
    if (!action) return;
    // Stops the browser's own ⌘K / Ctrl+K and keeps "/" out of the search box.
    event.preventDefault();
    handlers[action]();
  });

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
