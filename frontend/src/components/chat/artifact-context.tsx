'use client';

import { createContext, useSyncExternalStore } from 'react';
import type { CodeFile } from '@/lib/code-files';

export interface ArtifactControls {
  /** The files open in the panel now, if any. */
  shown: readonly CodeFile[] | null;
  /** Opens these files in the panel, or closes it if they are already open. */
  toggle: (files: readonly CodeFile[]) => void;
  /** What the card and the panel call the code: the chat's title. */
  title: string;
}

/**
 * Lets a code answer's files card open its files in the chat page's panel. Without it (a message
 * shown on its own), the card opens the files in a sheet of its own.
 */
export const ArtifactContext = createContext<ArtifactControls | null>(null);

/** Whether a media query matches; false on the server. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia !== 'function') {
        return () => {};
      }
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
    () => false,
  );
}
