import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SELECT, type SelectKey } from '../routes.ts';

export type SelectionChange = Partial<Record<SelectKey, string | undefined>>;

export interface Selection {
  node?: string;
  step?: string;
  symbol?: string;
  /** The `?query` for the current page with these changes; undefined removes a key. */
  searchWith(changes: SelectionChange): string;
  /** Changes the selection with a normal navigation, so Back undoes it. */
  select(changes: SelectionChange): void;
}

/**
 * What is selected on the current page, read from and written to the URL. Picking a node or a
 * step drops any open symbol, because the symbol view sits on top of them in the detail panel.
 */
export function useSelection(): Selection {
  const [params, setParams] = useSearchParams();

  const searchWith = useCallback(
    (changes: SelectionChange): string => {
      const next = new URLSearchParams(params);
      if (('node' in changes || 'step' in changes) && !('symbol' in changes)) {
        next.delete(SELECT.symbol);
      }
      for (const [key, value] of Object.entries(changes) as [SelectKey, string | undefined][]) {
        if (value === undefined) next.delete(SELECT[key]);
        else next.set(SELECT[key], value);
      }
      const search = next.toString();
      return search ? `?${search}` : '';
    },
    [params],
  );

  // A change that leaves the URL as it is adds no history entry, so Back never seems stuck.
  const select = useCallback(
    (changes: SelectionChange) => {
      const next = searchWith(changes);
      const current = params.toString();
      if (next !== (current ? `?${current}` : '')) setParams(new URLSearchParams(next));
    },
    [params, searchWith, setParams],
  );

  return useMemo(
    () => ({
      node: params.get(SELECT.node) ?? undefined,
      step: params.get(SELECT.step) ?? undefined,
      symbol: params.get(SELECT.symbol) ?? undefined,
      searchWith,
      select,
    }),
    [params, searchWith, select],
  );
}
