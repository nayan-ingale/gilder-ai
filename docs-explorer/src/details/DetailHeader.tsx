// The top of a detail view: the title (h2), a row of short facts such as its kind and status,
// and optional extra lines below (file location, folder, port...).
import type { ReactNode } from 'react';

interface DetailHeaderProps {
  title: string;
  /** Code names (functions, constants) are shown in the code font. */
  mono?: boolean;
  /** Short items shown in one row under the title: kind, status, position. */
  meta: ReactNode;
  children?: ReactNode;
}

export function DetailHeader({ title, mono = false, meta, children }: DetailHeaderProps) {
  return (
    <header className="px-4 pt-4 pb-3">
      <h2
        className={`font-semibold text-fg wrap-anywhere ${mono ? 'font-mono text-sm' : 'text-base'}`}
      >
        {title}
      </h2>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
        {meta}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </header>
  );
}

/** A dot between items in the header row. Hidden from screen readers, which pause anyway. */
export function MetaDot() {
  return (
    <span aria-hidden="true" className="text-fg-subtle">
      ·
    </span>
  );
}
