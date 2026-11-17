import Link from 'next/link';

/** A receipt that doesn't exist, isn't paid, or belongs to someone else: all look the same. */
export default function ReceiptNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <h2 className="text-xl text-fg">This receipt isn’t available</h2>
      <p className="max-w-sm text-sm text-fg-muted">
        The link may be wrong, or the payment didn’t go through.
      </p>
      <Link
        href="/settings/billing"
        className="mt-2 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        Back to billing
      </Link>
    </div>
  );
}
