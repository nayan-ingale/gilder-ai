// How much of the graph area the detail panel covers. On narrow screens the panel is a sheet
// over the bottom of the graph, so the graph keeps its buttons and fitted view above it.
import { createContext } from 'react';

export interface PanelInset {
  bottom: number;
}

export const PanelInsetContext = createContext<PanelInset>({ bottom: 0 });
