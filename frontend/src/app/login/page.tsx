import { Code, FileText, Globe, Presentation } from 'lucide-react';
import type { Metadata } from 'next';
import { Logo, Wordmark } from '@/components/app-shell/brand';
import { googleSignInConfigured } from '@/lib/firebase-client';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to GilderAi with Google. Chat, search the web with sources, build code with a live preview, and ask questions about your own PDFs. New accounts start with 100 free credits.',
  alternates: { canonical: '/login' },
};

/** What search engines read about the app (schema.org), alongside the visible page. */
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
};

const FEATURES = [
  { label: 'Chat and web search, with sources you can check', Icon: Globe },
  { label: 'Code with a live, sandboxed preview', Icon: Code },
  { label: 'PDFs, slides and images on request', Icon: Presentation },
  { label: 'Answers from your own documents, with page references', Icon: FileText },
] as const;

/** Sign-in: what the app does on the left, the Google button on the right (stacked on phones). */
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-wrap bg-canvas text-fg">
      <script
        type="application/ld+json"
        // Our own constant, serialised: nothing from a visitor goes in it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <section
        aria-label="About GilderAi"
        className="flex min-w-0 flex-[1_1_520px] flex-col gap-8 border-line bg-surface px-6 py-8 max-[959px]:border-b min-[960px]:border-r sm:gap-12 sm:px-14 sm:py-12"
      >
        <div className="flex items-center gap-2.5">
          <Logo />
          <Wordmark className="text-2xl" />
        </div>
        <div className="flex flex-col gap-5 sm:my-auto sm:gap-7">
          <h1 className="max-w-[560px] text-[32px] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[52px]">
            Every agent you need, in one quiet workspace.
          </h1>
          <p className="max-w-[480px] text-base leading-[1.55] text-fg-muted sm:text-[17px]">
            Ask once. GilderAi picks the right specialist and streams the answer back.
          </p>
          {/* On phones the list and footer give way, so the sign-in button shows without scrolling. */}
          <ul className="hidden flex-col gap-3.5 sm:flex">
            {FEATURES.map(({ label, Icon }) => (
              <li key={label} className="flex items-center gap-3 text-[15px]">
                <span
                  aria-hidden="true"
                  className="flex size-[34px] shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent-text"
                >
                  <Icon size={17} strokeWidth={1.75} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <span className="hidden text-[12.5px] text-fg-subtle sm:block">© 2026 GilderAi</span>
      </section>

      <section
        aria-label="Sign in"
        className="flex min-w-0 flex-[1_1_440px] items-center justify-center px-6 py-10 sm:px-8 sm:py-12"
      >
        <div className="flex w-full max-w-[380px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-[30px] font-semibold tracking-[-0.02em]">Sign in</h2>
            <p className="text-[15px] leading-[1.55] text-fg-muted">
              Use your Google account. New accounts start with 100 free credits.
            </p>
          </div>
          {/* Dev sign-in exists only in development builds; production builds don't contain it. */}
          <LoginForm
            googleReady={googleSignInConfigured}
            devLogin={process.env.NODE_ENV === 'development'}
          />
        </div>
      </section>
    </main>
  );
}
