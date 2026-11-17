import Link from 'next/link';
import { Logo, Wordmark } from '@/components/app-shell/brand';

/** Where people write about their data or these terms. */
export const CONTACT_EMAIL = 'me.nayan.dev@gmail.com';

/** The contact address as a mail link. */
export function ContactEmail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-text underline underline-offset-2">
      {CONTACT_EMAIL}
    </a>
  );
}

/** The frame of the Terms and Privacy pages: the brand, a title, the date and the sections. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-canvas text-fg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="GilderAi home">
            <Logo size={22} />
            <Wordmark className="text-lg" />
          </Link>
          <nav aria-label="Legal" className="flex gap-4 text-sm">
            <Link href="/terms" className="text-fg-muted hover:text-fg">
              Terms
            </Link>
            <Link href="/privacy" className="text-fg-muted hover:text-fg">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-sm text-fg-muted">Last updated {updated}</p>
        <div className="mt-8 flex flex-col gap-8 text-[15px] leading-relaxed">{children}</div>
      </main>
    </div>
  );
}

/** One titled part of a legal page. */
export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-[-0.01em]">{title}</h2>
      {children}
    </section>
  );
}

/** A plain bulleted list for the legal pages; each item is unique text, so it is its own key. */
export function LegalList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-fg-subtle">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
