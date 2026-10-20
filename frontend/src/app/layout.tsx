import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import { ClerkShell } from '@/components/auth/clerk-shell';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'VaultChat', template: '%s · VaultChat' },
  description: 'End-to-end encrypted chat with admin-approved access. Messages disappear after 10 hours.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const viewport: Viewport = { themeColor: '#CFE3E1', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-tile focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <ClerkShell><Providers>{children}</Providers></ClerkShell>
        <Toaster />
      </body>
    </html>
  );
}
