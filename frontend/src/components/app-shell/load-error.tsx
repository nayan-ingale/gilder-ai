'use client';

/**
 * Shown in place of a page that failed to render on the server: say the gateway refused a burst
 * of requests (429), or a service was restarting. Try again renders the page again on the server.
 * The reference is the error's digest, which matches the server's log line.
 */
export function LoadError({ digest, retry }: { digest?: string | undefined; retry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl text-fg">This page didn’t load</h1>
      <p className="max-w-sm text-sm text-fg-muted">
        There were too many requests in a short time, or a service is restarting. Wait a few
        seconds, then try again.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-2 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        Try again
      </button>
      {digest ? (
        <p className="text-xs text-fg-subtle">
          Reference: <code>{digest}</code>
        </p>
      ) : null}
    </div>
  );
}
