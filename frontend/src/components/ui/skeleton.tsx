import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** A grey placeholder while content loads. Hidden from screen readers, which hear "loading". */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-sunken', className)}
      {...props}
    />
  );
}
