import { lazy } from 'react';

// The graph pages bring the graph library, and they and the code explorer bring the detail panel,
// so they load only when first opened. The frame (AppShell) shows a short loading line meanwhile.

export const ArchitecturePage = lazy(() =>
  import('./ArchitecturePage.tsx').then((page) => ({ default: page.ArchitecturePage })),
);

export const FlowPage = lazy(() =>
  import('./FlowPage.tsx').then((page) => ({ default: page.FlowPage })),
);

export const CodePage = lazy(() =>
  import('./CodePage.tsx').then((page) => ({ default: page.CodePage })),
);
