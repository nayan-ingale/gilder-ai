'use client';

import { FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ChartIcon, LockIcon, TickIcon } from '@/components/settings/icons';
import { useHydrated } from '@/components/settings/use-hydrated';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import {
  type Account,
  agentName,
  formatAmount,
  formatRupees,
  longDate,
  PLAN_NAMES,
  type Plan,
  type PaymentsResponse,
} from '@/lib/billing';
import { openCheckout } from '@/lib/razorpay-checkout';
import {
  errorMessage,
  useCreateOrderMutation,
  useGetAccountQuery,
  useGetPaymentsQuery,
  useGetPlansQuery,
  useGetUsageSummaryQuery,
  useVerifyPaymentMutation,
} from '@/store/api';

/** The window the current-plan card counts usage over. */
const USAGE_DAYS = 30;

const CARD = 'rounded-lg border border-line bg-surface p-[22px]';
const PILL =
  'rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-text';

/**
 * Billing: the current plan and balance, what one answer costs, the plans to buy, and past
 * payments with a receipt for each.
 */
export function BillingView() {
  const toast = useToast();
  const account = useGetAccountQuery();
  const plans = useGetPlansQuery();
  const payments = useGetPaymentsQuery();
  // The same query the Usage tab opens with, so the two share one request.
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const usage = useGetUsageSummaryQuery({ days: USAGE_DAYS, timeZone });
  const [createOrder] = useCreateOrderMutation();
  const [verifyPayment] = useVerifyPaymentMutation();
  const [buying, setBuying] = useState<Plan['id'] | null>(null);

  async function buy(plan: Plan) {
    setBuying(plan.id);
    try {
      const { order, keyId } = await createOrder({ planId: plan.id }).unwrap();
      const result = await openCheckout({
        keyId,
        orderId: order.id,
        amountPaise: order.amountPaise,
        currency: order.currency,
        description: `${plan.name}: ${plan.credits.toLocaleString('en-IN')} credits`,
      });
      if (!result) {
        return;
      }
      const { granted } = await verifyPayment({ orderId: order.id, ...result }).unwrap();
      toast({
        title: granted
          ? `${plan.credits.toLocaleString('en-IN')} credits added`
          : 'Payment already added',
        description: `${plan.name} is active for ${plan.validityDays} days.`,
      });
    } catch (error) {
      const { message, requestId } =
        error instanceof Error && !('status' in error)
          ? { message: error.message, requestId: undefined }
          : errorMessage(error);
      toast({
        title: 'The payment did not go through',
        description: message,
        tone: 'danger',
        ...(requestId ? { requestId } : {}),
      });
    } finally {
      setBuying(null);
    }
  }

  // Nothing from the store until the page has hydrated, so the first render matches the server's.
  const ready = useHydrated();
  const current = ready ? account.data?.account : undefined;
  const used = ready ? usage.data?.totalCredits : undefined;
  const plansData = ready ? plans.data : undefined;
  return (
    <div className="flex flex-col gap-7 pt-1">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
        <section aria-label="Current plan" className={`${CARD} flex flex-col gap-3.5`}>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-fg-muted">Current plan</span>
            {current ? <span className={PILL}>{PLAN_NAMES[current.plan]}</span> : null}
          </div>
          {current ? (
            <div className="flex items-baseline gap-2.5">
              <span className="text-5xl leading-none font-semibold tracking-[-0.02em] text-fg">
                {current.balance.toLocaleString('en-IN')}
              </span>
              <span className="text-[15px] text-fg-muted">
                {current.balance === 1 ? 'credit' : 'credits'} available
              </span>
            </div>
          ) : (
            <Skeleton className="h-12 w-48" />
          )}
          {current && used !== undefined ? (
            <p className="text-sm leading-[1.55] text-fg-muted">
              {used.toLocaleString('en-IN')} used in the last {USAGE_DAYS} days. {planNote(current)}
            </p>
          ) : (
            <Skeleton className="h-5 w-full max-w-sm" />
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            <Link
              href="/settings/usage"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-line-strong bg-raised px-4 text-sm font-medium text-fg hover:bg-sunken"
            >
              <ChartIcon />
              View usage
            </Link>
          </div>
        </section>

        <section aria-label="Credit costs" className={`${CARD} flex flex-col gap-3`}>
          <span className="text-[13px] text-fg-muted">What one request costs</span>
          {plansData ? (
            <dl className="grid grid-cols-2 gap-x-6">
              {plansData.costs.map((cost) => (
                <div
                  key={cost.agent}
                  className="flex min-h-[38px] items-center justify-between gap-3 border-b border-line"
                >
                  <dt className="text-sm text-fg">{agentName(cost.agent)}</dt>
                  <dd className="text-sm text-fg-muted tabular-nums">{cost.credits}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Skeleton className="h-[152px]" />
          )}
          <span className="text-[12.5px] text-fg-subtle">
            You are only charged when an answer is delivered. Failed requests are refunded
            automatically.
          </span>
        </section>
      </div>

      <section aria-labelledby="plans-title" className="flex flex-col gap-3.5">
        <h2 id="plans-title" className="text-lg text-fg">
          Plans
        </h2>
        {plansData?.testMode !== false ? (
          <p
            role="note"
            className="flex items-start gap-2 rounded-md border border-line bg-sunken px-3 py-2 text-sm text-fg-muted"
          >
            <FlaskConical size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
            <span>
              <strong className="font-medium text-fg">Test payments only.</strong> No real money
              moves. Pay with a Razorpay test card or the test UPI ID success@razorpay.
            </span>
          </p>
        ) : null}
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
          {plansData ? (
            <>
              <PlanCard
                name={plansData.freePlan.name}
                price={formatRupees(0)}
                credits={plansData.freePlan.credits}
                points={['Every agent included', 'One-time sign-up grant']}
                current={current?.plan === 'free'}
              >
                <button
                  type="button"
                  disabled
                  className="mt-auto min-h-11 rounded-md border border-line bg-transparent px-4 text-sm font-semibold text-fg-subtle"
                >
                  Included at sign-up
                </button>
              </PlanCard>
              {plansData.plans.map((plan) => {
                const kind = buttonKind(plan, current, plansData?.plans ?? []);
                return (
                  <PlanCard
                    key={plan.id}
                    name={plan.name}
                    price={formatRupees(plan.pricePaise)}
                    credits={plan.credits}
                    points={[
                      'Every agent included',
                      'Credits never expire',
                      `${plan.name} badge for ${plan.validityDays} days`,
                    ]}
                    current={current?.plan === plan.id}
                  >
                    <button
                      type="button"
                      onClick={() => void buy(plan)}
                      disabled={buying !== null}
                      className={cn(
                        'mt-auto min-h-11 rounded-md border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                        kind === 'upgrade'
                          ? 'border-accent bg-accent text-accent-ink hover:opacity-90'
                          : 'border-line bg-raised text-fg hover:bg-sunken',
                      )}
                    >
                      {buying === plan.id
                        ? 'Opening payment…'
                        : kind === 'again'
                          ? 'Buy again'
                          : kind === 'upgrade'
                            ? `Upgrade to ${plan.name}`
                            : `Buy ${plan.name}`}
                    </button>
                  </PlanCard>
                );
              })}
            </>
          ) : (
            ['free', 'starter', 'pro'].map((id) => (
              <li key={id}>
                <Skeleton className="h-[230px] rounded-lg" />
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="history-title" className="flex flex-col gap-3.5">
        <h2 id="history-title" className="text-lg text-fg">
          Payment history
        </h2>
        <PaymentHistory
          data={ready ? payments.data : undefined}
          loading={!ready || payments.isLoading}
        />
        <p className="flex items-center gap-2 text-[13px] text-fg-muted">
          <LockIcon size={15} />
          Payments are processed by Razorpay. GilderAi never sees or stores your card details.
        </p>
      </section>
    </div>
  );
}

/** The plan's dates in words, after the credits used. */
function planNote(account: Account): string {
  if (account.plan === 'free') {
    return 'Credits never expire.';
  }
  if (!account.planExpiresAt) {
    return 'Purchased credits never expire.';
  }
  const ends = new Date(account.planExpiresAt);
  const when = longDate.format(ends);
  return ends.getTime() > Date.now()
    ? `Plan active until ${when}. Purchased credits never expire.`
    : `Plan badge ended on ${when}. Purchased credits never expire.`;
}

/**
 * Which button a paid plan gets: "Buy again" for the current plan, "Upgrade to …" for a dearer
 * one, and "Buy …" for a cheaper one.
 */
function buttonKind(
  plan: Plan,
  current: Account | undefined,
  plans: readonly Plan[],
): 'again' | 'upgrade' | 'buy' {
  if (current?.plan === plan.id) {
    return 'again';
  }
  const currentPrice = plans.find((other) => other.id === current?.plan)?.pricePaise ?? 0;
  return plan.pricePaise > currentPrice ? 'upgrade' : 'buy';
}

function PlanCard({
  name,
  price,
  credits,
  points,
  current,
  children,
}: {
  name: string;
  price: string;
  credits: number;
  points: string[];
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-3.5 rounded-lg border bg-surface p-[22px]',
        current ? 'border-accent-border' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-fg">{name}</span>
        {current ? <span className={PILL}>Current plan</span> : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[34px] leading-none font-semibold tracking-[-0.02em] text-fg">
          {price}
        </span>
        <span className="text-sm text-fg-muted">{credits.toLocaleString('en-IN')} credits</span>
      </div>
      <ul className="flex flex-col gap-2 text-sm text-fg-muted">
        {points.map((point) => (
          <li key={point} className="flex items-center gap-2">
            <TickIcon size={15} className="shrink-0 text-success" />
            {point}
          </li>
        ))}
      </ul>
      {children}
    </li>
  );
}

interface HistoryRow {
  key: string;
  at: string;
  description: string;
  amount: string;
  credits: number;
  status: 'Paid' | 'Granted';
  /** Paid payments have a receipt, found by their order. */
  orderId?: string;
}

const TH = 'border-b border-line px-[18px] py-3 text-[12.5px] font-medium text-fg-muted';
const TD = 'border-b border-line px-[18px] py-3';

/** Paid payments and the sign-up grant, newest first, each paid one with a receipt. */
function PaymentHistory({
  data,
  loading,
}: {
  data: PaymentsResponse | undefined;
  loading: boolean;
}) {
  const rows: HistoryRow[] = [
    ...(data?.items ?? []).map((payment) => ({
      key: payment.orderId,
      at: payment.paidAt ?? payment.createdAt,
      description: `${PLAN_NAMES[payment.plan]} plan`,
      amount: formatAmount(payment.amountPaise),
      credits: payment.credits,
      status: 'Paid' as const,
      orderId: payment.orderId,
    })),
    ...(data?.signupGrant
      ? [
          {
            key: 'signup',
            at: data.signupGrant.grantedAt,
            description: 'Sign-up credits',
            amount: formatAmount(0),
            credits: data.signupGrant.credits,
            status: 'Granted' as const,
          },
        ]
      : []),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  if (rows.length === 0) {
    return <p className="text-sm text-fg-subtle">{loading ? 'Loading…' : 'No payments yet.'}</p>;
  }
  return (
    // Focusable, so keyboard users can scroll the table sideways on a narrow screen.
    <div
      role="region"
      aria-label="Payment history table"
      tabIndex={0}
      className="overflow-x-auto rounded-lg border border-line bg-surface"
    >
      <table className="w-full min-w-[640px] border-collapse text-sm text-fg">
        <thead>
          <tr>
            <th scope="col" className={`${TH} text-left`}>
              Date
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Description
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Amount
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Credits
            </th>
            <th scope="col" className={`${TH} text-left`}>
              Status
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Receipt
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {rows.map((row) => {
            const date = longDate.format(new Date(row.at));
            return (
              <tr key={row.key}>
                <td className={`${TD} whitespace-nowrap`}>{date}</td>
                <td className={TD}>{row.description}</td>
                <td className={`${TD} text-right tabular-nums`}>{row.amount}</td>
                <td className={`${TD} text-right tabular-nums`}>
                  +{row.credits.toLocaleString('en-IN')}
                </td>
                <td className={TD}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft py-0.5 pr-2.5 pl-2 text-[13px] text-success">
                    <TickIcon size={12} strokeWidth={3} />
                    {row.status}
                  </span>
                </td>
                <td className={`${TD} text-right`}>
                  {row.orderId ? (
                    <Link
                      href={`/settings/billing/receipts/${encodeURIComponent(row.orderId)}`}
                      aria-label={`Download receipt for ${row.description}, ${date}`}
                      className="text-accent-text underline-offset-2 hover:underline"
                    >
                      Download
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
