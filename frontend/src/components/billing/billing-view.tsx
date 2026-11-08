'use client';

import { FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { formatRupees, PLAN_NAMES, type Plan } from '@/lib/billing';
import { openCheckout } from '@/lib/razorpay-checkout';
import {
  errorMessage,
  useCreateOrderMutation,
  useGetAccountQuery,
  useGetPaymentsQuery,
  useGetPlansQuery,
  useVerifyPaymentMutation,
} from '@/store/api';

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Credits: the current plan and balance, the plans to buy, and past payments. */
export function BillingView() {
  const toast = useToast();
  const account = useGetAccountQuery();
  const plans = useGetPlansQuery();
  const payments = useGetPaymentsQuery();
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

  const current = account.data?.account;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <header>
        <h1 className="text-xl text-fg">Billing and credits</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Every answer uses credits. Credits never expire.
        </p>
      </header>

      {plans.data?.testMode !== false ? (
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

      <section
        aria-labelledby="current-plan"
        className="rounded-lg border border-line bg-raised p-4"
      >
        <h2 id="current-plan" className="text-sm text-fg-subtle">
          Current plan
        </h2>
        {current ? (
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <p className="text-2xl font-semibold text-fg tabular-nums">
              {current.balance.toLocaleString('en-IN')}{' '}
              <span className="text-base font-normal text-fg-muted">credits</span>
            </p>
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Badge tone={current.plan === 'free' ? 'neutral' : 'accent'}>
                {PLAN_NAMES[current.plan]}
              </Badge>
              {current.planExpiresAt
                ? `until ${dateFormat.format(new Date(current.planExpiresAt))}`
                : null}
            </p>
          </div>
        ) : (
          <Skeleton className="mt-2 h-8 w-40" />
        )}
      </section>

      <section aria-labelledby="plans">
        <h2 id="plans" className="mb-3 text-base text-fg">
          Get more credits
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(plans.data?.plans ?? []).map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col gap-3 rounded-lg border border-line bg-raised p-4"
            >
              <div>
                <p className="text-sm font-medium text-fg">{plan.name}</p>
                <p className="mt-1 text-2xl font-semibold text-fg tabular-nums">
                  {formatRupees(plan.pricePaise)}
                </p>
                <p className="text-sm text-fg-muted">
                  {plan.credits.toLocaleString('en-IN')} credits · plan badge for{' '}
                  {plan.validityDays} days
                </p>
              </div>
              <Button onClick={() => void buy(plan)} disabled={buying !== null}>
                {buying === plan.id ? 'Opening payment…' : `Buy ${plan.name}`}
              </Button>
            </li>
          ))}
          {plans.isLoading ? (
            <>
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
            </>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="payments">
        <h2 id="payments" className="mb-3 text-base text-fg">
          Payment history
        </h2>
        {payments.data && payments.data.items.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-sunken text-xs text-fg-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Credits</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.items.map((payment) => (
                  <tr key={payment.orderId} className="border-t border-line text-fg">
                    <td className="px-3 py-2">
                      {dateFormat.format(new Date(payment.paidAt ?? payment.createdAt))}
                    </td>
                    <td className="px-3 py-2">{PLAN_NAMES[payment.plan]}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {payment.credits.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{formatRupees(payment.amountPaise)}</td>
                    <td className="px-3 py-2">
                      <Badge tone={payment.status === 'paid' ? 'success' : 'neutral'}>
                        {payment.status === 'paid' ? 'Paid' : 'Not paid'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-fg-subtle">
            {payments.isLoading ? 'Loading…' : 'No payments yet.'}
          </p>
        )}
      </section>
    </div>
  );
}
