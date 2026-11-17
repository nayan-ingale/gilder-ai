import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SIDEBAR_SCRIPT } from '@/components/app-shell/sidebar-state';
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
  title: { default: 'GilderAi', template: '%s · GilderAi' },
  description: 'One workspace for chat, web search, code, documents and images.',
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
