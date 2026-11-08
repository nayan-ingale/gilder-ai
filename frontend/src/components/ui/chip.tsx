import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** A chip is a toggle: screen readers hear whether it is on. */
  selected: boolean;
}

/** A small pill toggle, such as an agent choice in the composer. */
export function Chip({ selected, type = 'button', className, ...props }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
        selected
          ? 'border-accent bg-accent-soft text-accent-text'
          : 'border-line text-fg-muted hover:bg-surface hover:text-fg',
        className,
      )}
      {...props}
    />
  );
}
