import { cn } from '@/components/ui/cn';

/** The diamond mark, in the accent colour; decoration only, since the name sits beside it. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path d="M12 2l9 10-9 10-9-10z" className="fill-accent" />
      <path d="M12 2l9 10-9 10z" className="fill-accent-ink" opacity={0.18} />
    </svg>
  );
}

/** The name as the brand writes it: "Gilder", then "Ai" in the accent colour. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-semibold tracking-[-0.02em] text-fg', className)}>
      Gilder<span className="text-accent-text">Ai</span>
    </span>
  );
}
