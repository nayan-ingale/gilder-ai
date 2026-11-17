import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False on the server and while the page hydrates, true after. The data store is shared, so a
 * query another part of the page already finished (the credits card's account) would otherwise
 * render here during hydration, where the server only had a skeleton.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
