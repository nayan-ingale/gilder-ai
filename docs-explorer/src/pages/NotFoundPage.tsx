import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { paths } from '../routes.ts';

// What to show when an address leads nowhere, and when a page fails to render.

const LINK = 'rounded-sm text-sm text-accent hover:underline';

/** An address with no page behind it, or a page whose flow or view doesn't exist. */
export function NotFoundPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <title>Page not found · GilderAi Docs</title>
      <h1 className="text-lg font-semibold text-fg">Page not found</h1>
      <p className="mt-2 text-sm text-fg-subtle">
        Nothing lives at this address. The link may be out of date or mistyped.
      </p>
      <p className="mt-6">
        <Link to={paths.overview()} className={LINK}>
          Go to the project overview
        </Link>
      </p>
    </div>
  );
}

/** Shown by the router when a page throws while rendering. */
export function RouteErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined;

  return (
    <div role="alert" className="mx-auto w-full max-w-xl px-4 py-16 text-center">
      <title>Something went wrong · GilderAi Docs</title>
      <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
      <p className="mt-2 text-sm text-fg-subtle">This page could not be shown.</p>
      {detail ? (
        <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-surface p-3 text-left font-mono text-xs whitespace-pre-wrap text-fg-muted">
          {detail}
        </pre>
      ) : null}
      <p className="mt-6 flex justify-center gap-4">
        <Link to={paths.overview()} className={LINK}>
          Go to the project overview
        </Link>
        <button type="button" onClick={() => window.location.reload()} className={LINK}>
          Reload the page
        </button>
      </p>
    </div>
  );
}
