'use client';

import { LoadError } from '@/components/app-shell/load-error';

/**
 * A signed-in page that failed to render. The sidebar stays, and the page offers to try again.
 * Without this boundary the error would end the render, and in development Next's Fast Refresh
 * would then reload the whole page on its next update.
 */
export default function AppPageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <LoadError digest={error.digest} retry={retry} />;
}
