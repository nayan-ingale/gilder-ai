import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ReceiptView } from '@/components/settings/receipt-view';
import { Skeleton } from '@/components/ui/skeleton';
import { getCurrentUser } from '@/server/session';
import { loadReceipt } from './load-receipt';

export const metadata: Metadata = { title: 'Receipt' };

/** A printable receipt for one of the user's paid payments. */
export default function ReceiptPage({ params }: PageProps<'/settings/billing/receipts/[orderId]'>) {
  return (
    <Suspense fallback={<ReceiptSkeleton />}>
      <Receipt params={params} />
    </Suspense>
  );
}

async function Receipt({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [receipt, user] = await Promise.all([loadReceipt(orderId), getCurrentUser()]);
  if (!user) {
    redirect('/login');
  }
  if (!receipt) {
    notFound();
  }
  return <ReceiptView receipt={receipt} billedTo={{ name: user.name, email: user.email }} />;
}

function ReceiptSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-1">
      <span className="sr-only">Loading the receipt</span>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[520px] w-full max-w-[720px] rounded-lg" />
    </div>
  );
}
