import { createHashRouter } from 'react-router';
import { AppShell } from './layout/AppShell.tsx';
import { FlowListPage } from './pages/FlowListPage.tsx';
import { GuidePage } from './pages/GuidePage.tsx';
import { ArchitecturePage, CodePage, FlowPage } from './pages/lazy-pages.ts';
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { PlaceholderPage } from './pages/PlaceholderPage.tsx';

// Every page, inside the shared frame. Hash URLs (/#/flows/health-check) let the site deploy as
// plain files. The paths match the builders in routes.ts.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    // Used only if the frame itself fails; a page that fails is caught below, inside the frame,
    // and search catches its own failures (SearchErrorBoundary).
    errorElement: <RouteErrorPage />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'architecture/:viewId', element: <ArchitecturePage /> },
          { path: 'flows', element: <FlowListPage /> },
          { path: 'flows/:flowId', element: <FlowPage /> },
          { path: 'code', element: <CodePage /> },
          { path: 'errors', element: <FlowListPage category="errors" /> },
          { path: 'docs/:pageId', element: <GuidePage /> },
          { path: 'agents', element: <PlaceholderPage kind="agents" /> },
          { path: 'jobs', element: <PlaceholderPage kind="jobs" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
