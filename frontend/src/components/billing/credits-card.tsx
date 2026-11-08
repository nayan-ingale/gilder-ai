'use client';

import { Coins } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LOW_BALANCE, PLAN_NAMES } from '@/lib/billing';
import { useGetAccountQuery } from '@/store/api';

/** The balance and plan, above the account menu. Every answer costs credits, so it stays visible. */
export function CreditsCard() {
  const { data, isLoading, isError } = useGetAccountQuery();

  if (isLoading) {
    return <Skeleton className="mx-2 mb-2 h-12" aria-label="Loading your credits" />;
  }
  if (isError || !data) {
    // The rest of the app works without it; the card simply stays out of the way.
    return null;
  }

  const { balance, plan } = data.account;
  const low = balance < LOW_BALANCE;
  return (
    <section
      aria-label="Credits"
      className="mx-2 mb-2 flex items-center gap-3 rounded-md border border-line bg-raised px-3 py-2"
    >
      <Coins size={16} aria-hidden="true" className={low ? 'text-warning' : 'text-fg-subtle'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-fg">
          <span className="font-semibold tabular-nums">{balance.toLocaleString('en-IN')}</span>{' '}
          {balance === 1 ? 'credit' : 'credits'}
        </p>
        {low ? <p className="text-xs text-warning">Running low</p> : null}
      </div>
      <Badge tone={plan === 'free' ? 'neutral' : 'accent'}>{PLAN_NAMES[plan]}</Badge>
      <Link
        href="/settings/billing"
        className="text-xs font-medium text-accent-text underline-offset-2 hover:underline"
      >
        Get more
      </Link>
    </section>
  );
}
