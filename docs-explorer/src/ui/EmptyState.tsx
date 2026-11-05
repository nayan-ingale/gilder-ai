import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  /** A sentence or two on why there is nothing here. */
  children?: ReactNode;
  /** Somewhere useful to go instead, usually a link. */
  action?: ReactNode;
}

/** What to show where there is nothing yet: a page with no content, or a panel with no match. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      {children ? <div className="max-w-md text-sm/relaxed text-fg-subtle">{children}</div> : null}
      {action ? <div className="mt-2 text-sm">{action}</div> : null}
    </div>
  );
}
