import type {Metadata, Viewport} from 'next';

import './globals.css';
import {AppShell} from '@/components/shell/app-shell';
import {Providers} from '@/components/providers';

export const metadata: Metadata = {
  title: {default: 'TImx — Global Trade. Onchain Trust.', template: '%s · TImx'},
  description:
    'Programmable financing for cross-border trade, settled on Creditcoin and advanced by cryptographically verified cross-chain events.',
};

export const viewport: Viewport = {
  themeColor: '#f5f6fb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
