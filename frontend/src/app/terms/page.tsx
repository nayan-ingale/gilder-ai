import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactEmail, LegalList, LegalPage, LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = { title: 'Terms of Use' };

/** The rules for using the app, in plain words. */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="17 November 2026">
      <p>
        GilderAi is a personal project, run as a working demo of an AI workspace. By signing in you
        agree to these terms.
      </p>

      <LegalSection title="The service">
        <p>
          GilderAi is offered as it is. It may change, pause or stop at any time, and features may
          come and go while it grows.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You sign in with your Google account and are responsible for what is done with it. One
          person per account.
        </p>
      </LegalSection>

      <LegalSection title="Credits and payments">
        <LegalList
          items={[
            'New accounts start with 100 free credits. Each answer uses credits, depending on the agent that answers.',
            'Payments currently run in test mode: no real money is charged.',
            'Credits you buy do not expire. They have no cash value and cannot be transferred.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Using it fairly">
        <p>Please don’t use GilderAi to:</p>
        <LegalList
          items={[
            'break the law, or harm, harass or deceive anyone;',
            'write malware or get around security or limits, here or elsewhere;',
            'overload the service or copy it with automated tools.',
          ]}
        />
        <p>Accounts that do may be suspended.</p>
      </LegalSection>

      <LegalSection title="AI answers">
        <p>
          Answers can be wrong, incomplete or out of date. Check anything important, and don’t treat
          an answer as medical, legal or financial advice.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          What you write and upload stays yours. You let GilderAi store and process it, and send it
          to the services named in the{' '}
          <Link href="/privacy" className="text-accent-text underline underline-offset-2">
            Privacy Policy
          </Link>
          , only to provide the service. Only upload what you have the right to share.
        </p>
      </LegalSection>

      <LegalSection title="Limits">
        <p>
          GilderAi comes without warranties. As far as the law allows, it is not liable for indirect
          losses, such as lost data or lost work.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If these terms change, this page and its date change with it. Questions: <ContactEmail />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
