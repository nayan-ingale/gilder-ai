import Link from 'next/link';

/** A chat that doesn't exist, was deleted, or belongs to someone else: all look the same. */
export default function ChatNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl text-fg">This chat isn’t available</h1>
      <p className="max-w-sm text-sm text-fg-muted">
        It may have been deleted, or the link is wrong.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
      >
        Start a new chat
      </Link>
    </div>
  );
}
