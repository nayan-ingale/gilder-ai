'use client';

import { Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { LOW_BALANCE, PLAN_CREDITS, PLAN_NAMES } from '@/lib/billing';
import { useGetAccountQuery } from '@/store/api';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

/**
 * The balance and plan, above the account. Every answer costs credits, so it stays visible; the
 * whole card opens billing.
 */
export function CreditsCard() {
  const { data, isLoading, isError } = useGetAccountQuery();

  if (isLoading) {
    return <Skeleton className="h-[86px] rounded-md" aria-label="Loading your credits" />;
  }
  if (isError || !data) {
    // The rest of the app works without it; the card simply stays out of the way.
    return null;
  }

  const { balance, plan, planExpiresAt } = data.account;
  const low = balance < LOW_BALANCE;
  // How much of the plan's credits are left; a sliver stays visible even at zero.
  const percent = Math.max(2, Math.min(100, Math.round((balance / PLAN_CREDITS[plan]) * 100)));
  const note = low
    ? 'Running low · get more credits'
    : plan !== 'free' && planExpiresAt
      ? `Plan active until ${dateFormat.format(new Date(planExpiresAt))}`
      : 'Get more credits';

  return (
    <section aria-label="Credits">
      <Link
        href="/settings/billing"
        className="flex flex-col gap-2 rounded-md border border-line bg-raised p-3 text-fg hover:bg-sunken"
      >
        <span className="flex w-full items-center gap-2">
          <Zap
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className={low ? 'text-warning' : 'text-accent-text'}
          />
          <span className="text-sm">
            <strong className="font-semibold tabular-nums">
              {balance.toLocaleString('en-IN')}
            </strong>{' '}
            {balance === 1 ? 'credit' : 'credits'}
          </span>
          <span
            className={cn(
              'ml-auto rounded-full border px-2 py-0.5 text-[11.5px] font-medium',
              plan === 'free'
                ? 'border-line bg-sunken text-fg-muted'
                : 'border-accent-border bg-accent-soft text-accent-text',
            )}
          >
            {PLAN_NAMES[plan]}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="block h-1.5 w-full overflow-hidden rounded-full bg-sunken"
        >
          <span
            className={cn('block h-full rounded-full', low ? 'bg-warning' : 'bg-accent')}
            style={{ width: `${percent}%` }}
          />
        </span>
        <span className={cn('text-xs', low ? 'text-warning' : 'text-fg-muted')}>{note}</span>
      </Link>
    </section>
  );
}
