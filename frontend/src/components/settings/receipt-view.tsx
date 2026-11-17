'use client';

import { ArrowLeft, FlaskConical, Printer } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Logo, Wordmark } from '@/components/app-shell/brand';
import { CONTACT_EMAIL } from '@/components/legal/legal-page';
import { formatAmount, type Receipt } from '@/lib/billing';
import { TickIcon } from './icons';

// Receipts are dated in India's time (Razorpay India, prices in rupees), the same on the server
// and in the browser, so the page renders the same text in both.
const receiptTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Kolkata',
});

/**
 * Printing shows only the receipt: everything else is hidden, and the sheet is placed at the top
 * of the page, outside the app's scrolling frame.
 */
const PRINT_CSS = `
@media print {
  @page { margin: 16mm; }
  body * { visibility: hidden; }
  [data-receipt-sheet], [data-receipt-sheet] * { visibility: visible; }
  [data-receipt-sheet] { position: fixed; top: 0; left: 0; width: 100%; }
}
`;

/** Prints in the light theme whatever the screen uses, then puts the screen's theme back. */
function usePrintInLight() {
  useEffect(() => {
    const root = document.documentElement;
    let previous: string | undefined;
    const before = () => {
      previous = root.dataset.theme;
      root.dataset.theme = 'light';
    };
    const after = () => {
      if (previous === undefined) {
        delete root.dataset.theme;
      } else {
        root.dataset.theme = previous;
      }
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
}

export interface ReceiptViewProps {
  receipt: Receipt;
  billedTo: { name: string | null; email: string };
}

/** One paid payment as a receipt, with a button to print it or save it as a PDF. */
export function ReceiptView({ receipt, billedTo }: ReceiptViewProps) {
  usePrintInLight();
  const paidAt = receiptTime.format(new Date(receipt.paidAt ?? receipt.createdAt));
  const amount = formatAmount(receipt.amountPaise);
  const details: { label: string; value: React.ReactNode }[] = [
    { label: 'Receipt number', value: <span className="tabular-nums">{receipt.number}</span> },
    { label: 'Date paid', value: `${paidAt} IST` },
    { label: 'Order placed', value: `${receiptTime.format(new Date(receipt.createdAt))} IST` },
    { label: 'Paid with', value: 'Razorpay' },
    {
      label: 'Razorpay order',
      value: <span className="font-mono text-[13px] break-all">{receipt.orderId}</span>,
    },
    {
      label: 'Razorpay payment',
      value: <span className="font-mono text-[13px] break-all">{receipt.paymentId || '—'}</span>,
    },
    {
      label: 'Status',
      value: (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft py-0.5 pr-2.5 pl-2 text-[13px] text-success">
          <TickIcon size={12} strokeWidth={3} />
          Paid
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 pt-1">
      <style>{PRINT_CSS}</style>
      <div className="flex w-full max-w-[720px] flex-wrap items-center justify-between gap-3">
        <Link
          href="/settings/billing"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to billing
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-accent bg-accent px-4 text-sm font-semibold text-accent-ink hover:opacity-90"
        >
          <Printer size={16} strokeWidth={1.75} aria-hidden="true" />
          Print or save as PDF
        </button>
      </div>

      <article
        data-receipt-sheet
        aria-labelledby="receipt-title"
        className="flex w-full max-w-[720px] flex-col gap-6 rounded-lg border border-line bg-surface p-6 text-fg sm:p-9 print:max-w-none print:border-0 print:bg-transparent print:p-0"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <span className="flex items-center gap-2">
            <Logo size={26} />
            <Wordmark className="text-lg" />
          </span>
          <span className="flex flex-col items-end gap-0.5">
            <h2 id="receipt-title" className="text-lg">
              Receipt
            </h2>
            <span className="text-sm text-fg-muted tabular-nums">{receipt.number}</span>
          </span>
        </header>

        {receipt.testMode ? (
          <p
            role="note"
            className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm text-warning"
          >
            <FlaskConical size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              <strong className="font-semibold">Test payment — no money was charged.</strong> It was
              made in Razorpay’s test mode.
            </span>
          </p>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-medium text-fg-subtle">Billed to</span>
            {billedTo.name ? <span className="text-sm font-medium">{billedTo.name}</span> : null}
            <span className="text-sm break-all text-fg-muted">{billedTo.email}</span>
          </div>
          <dl className="flex flex-col">
            {details.map(({ label, value }) => (
              <div
                key={label}
                className="flex min-h-9 items-center justify-between gap-4 border-b border-line py-1.5 last:border-b-0"
              >
                <dt className="shrink-0 text-[13px] text-fg-muted">{label}</dt>
                <dd className="min-w-0 text-right text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">What was bought</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-line py-2 text-left text-[12.5px] font-medium text-fg-muted"
              >
                Description
              </th>
              <th
                scope="col"
                className="border-b border-line py-2 text-right text-[12.5px] font-medium text-fg-muted"
              >
                Credits
              </th>
              <th
                scope="col"
                className="border-b border-line py-2 text-right text-[12.5px] font-medium text-fg-muted"
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-b border-line py-3">
                <span className="block font-medium">{receipt.planName} plan</span>
                <span className="block text-[13px] text-fg-muted">Credits that never expire</span>
              </td>
              <td className="border-b border-line py-3 text-right tabular-nums">
                +{receipt.credits.toLocaleString('en-IN')}
              </td>
              <td className="border-b border-line py-3 text-right tabular-nums">{amount}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={2} className="pt-3 text-left font-semibold">
                Total paid ({receipt.currency})
              </th>
              <td className="pt-3 text-right text-base font-semibold tabular-nums">{amount}</td>
            </tr>
          </tfoot>
        </table>

        <p className="border-t border-line pt-4 text-[12.5px] leading-[1.55] text-fg-subtle">
          Payments are processed by Razorpay. GilderAi never sees or stores your card details.
          Questions about this receipt? Email {CONTACT_EMAIL}.
        </p>
      </article>
    </div>
  );
}
