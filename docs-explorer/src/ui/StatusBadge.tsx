import { STATUS_INFO, type Status } from '../data/schema.ts';

// Full class names, so Tailwind finds them when it scans the code.
const DOT: Record<Status, string> = {
  verified: 'bg-status-verified',
  partial: 'bg-status-partial',
  inferred: 'bg-status-inferred',
  'not-wired': 'bg-status-not-wired',
  planned: 'border border-status-planned',
  unknown: 'bg-status-unknown',
};

interface StatusBadgeProps {
  status: Status;
  /** For planned items: the roadmap feature that adds it, shown after the label. */
  plannedIn?: string;
}

/** How sure the docs are about something. The label is always written out, not just coloured. */
export function StatusBadge({ status, plannedIn }: StatusBadgeProps) {
  const info = STATUS_INFO[status];
  return (
    <span
      title={info.description}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs whitespace-nowrap text-fg-muted"
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOT[status]}`} />
      {info.label}
      {status === 'planned' && plannedIn ? ` · ${plannedIn}` : null}
    </span>
  );
}
