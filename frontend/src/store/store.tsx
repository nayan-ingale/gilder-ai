'use client';

import { configureStore, type UnknownAction } from '@reduxjs/toolkit';
import { type ReactNode, useState } from 'react';
import { Provider } from 'react-redux';
import { api } from './api';

type ApiState = ReturnType<typeof api.reducer>;
export interface RootState {
  [api.reducerPath]: ApiState;
}

/**
 * The root reducer, written out instead of passing an object to configureStore. That object
 * would go through combineReducers, which calls Math.random() to probe each reducer, and Next.js
 * refuses random values while it prerenders the static shell.
 */
function rootReducer(state: RootState | undefined, action: UnknownAction): RootState {
  const previous = state?.[api.reducerPath];
  const next = api.reducer(previous, action);
  return state && next === previous ? state : { [api.reducerPath]: next };
}

export function makeStore() {
  // Redux Toolkit's development checks time every dispatch with Date.now(), and RTK Query
  // dispatches while rendering, which Next.js refuses in the prerendered shell. The server's
  // store never holds data (queries only run in the browser), so the checks run in the browser.
  const inBrowser = typeof window !== 'undefined';
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ immutableCheck: inBrowser, serializableCheck: inBrowser }).concat(
        api.middleware,
      ),
  });
}

export type AppStore = ReturnType<typeof makeStore>;

/** One store per browser tab, made on first render, so server renders never share one. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
