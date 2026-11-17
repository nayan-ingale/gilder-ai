import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactEmail, LegalList, LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What GilderAi collects, why, which services handle it, how long it is kept, and how to have it deleted.',
  alternates: { canonical: '/privacy' },
};

/** What the app collects, why, who else handles it, and how to get it deleted. */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="17 November 2026">
      <p>
        GilderAi is a personal project that runs a small AI workspace. This page says what it
        collects, why, and who else handles it. It is written to be read, not to hide anything.
      </p>

      <LegalSection title="What we collect">
        <LegalList
          items={[
            'Your Google account’s name, email address and profile photo, when you sign in.',
            'What you write and receive in your chats, and the files you upload or ask GilderAi to make.',
            'Your credits and payments: your plan, your balance, what each answer used, and the order and payment references from Razorpay.',
            'Technical details such as your IP address and the requests you make, used for rate limits, security and fixing errors.',
          ]}
        />
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          Only to run the service: to answer you, keep your chats and files, count credits, keep
          accounts secure and fix problems. There are no ads, your data is never sold, and your
          chats are not used to train AI models.
        </p>
      </LegalSection>

      <LegalSection title="Who else handles it">
        <p>To answer you, parts of your data go to these services, each only for its own job:</p>
        <LegalList
          items={[
            'Google Firebase, for signing in.',
            'AI providers (Groq, OpenRouter and the model makers it routes to, and Google Gemini), which receive your messages and the context needed to answer them.',
            'Tavily, which receives your question when an answer searches the web.',
            'Amazon Web Services, which hosts the app and stores files, in its Mumbai region.',
            'Razorpay, which takes payments. Card and UPI details go to Razorpay, never to us.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          One cookie keeps you signed in, for up to 30 days or until you log out. Another remembers
          your light or dark theme. There are no tracking or advertising cookies. Google’s sign-in
          window may set its own.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Your chats and files stay until you delete them or ask us to close your account. Deleting
          a chat removes it and its messages. Backups of the database, when they hold your data, are
          replaced within 30 days.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <LegalList
          items={[
            'See and delete your chats at any time.',
            'Log out to end your session at once.',
            'Ask for a copy of your data, or for your account and everything in it to be deleted, by email.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Children">
        <p>GilderAi is not meant for anyone under 18.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If this policy changes, this page and its date change with it. Questions or requests:{' '}
          <ContactEmail />. See also the{' '}
          <Link href="/terms" className="text-accent-text underline underline-offset-2">
            Terms of Use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
