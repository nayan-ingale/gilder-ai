import { RouterProvider } from 'react-router';
import { router } from './router.tsx';

// The whole explorer: the router picks the page, and every page sits inside AppShell.
export function App() {
  return <RouterProvider router={router} />;
}
