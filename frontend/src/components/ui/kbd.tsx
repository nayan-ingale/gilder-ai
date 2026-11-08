import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** A keyboard key, such as ⌘K in a hint. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface px-1 font-mono text-[11px] text-fg-muted',
        className,
      )}
      {...props}
    />
  );
}
