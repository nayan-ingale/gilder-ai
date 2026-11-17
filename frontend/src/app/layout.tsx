import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SIDEBAR_SCRIPT } from '@/components/app-shell/sidebar-state';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';
import { THEME_SCRIPT } from '@/theme/theme';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: every AI agent in one workspace`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'AI assistant',
    'AI chat',
    'web search with sources',
    'AI code generator',
    'PDF question answering',
    'AI slides',
    'AI image generator',
  ],
  authors: [{ name: 'Nayan Ingale' }],
  creator: 'Nayan Ingale',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: '/',
    title: `${SITE_NAME}: every AI agent in one workspace`,
    description: SITE_DESCRIPTION,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME}: every AI agent in one workspace`,
    description: SITE_DESCRIPTION,
  },
  formatDetection: { telephone: false },
};

/** The browser bar follows the page's light or dark background. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0d' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The theme script may set data-theme before React loads, so the attribute can differ.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
