'use client';

import { LoadError } from '@/components/app-shell/load-error';

/**
 * Anything below the root layout that failed to render, including the signed-in layout itself
 * (its account check calls the gateway). Pages inside the app have their own boundary, which
 * keeps the sidebar.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main id="main" className="flex min-h-dvh flex-col bg-canvas">
      <LoadError digest={error.digest} retry={retry} />
    </main>
  );
}
