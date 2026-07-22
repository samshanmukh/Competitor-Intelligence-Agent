import './globals.css';
import { Manrope, Newsreader } from 'next/font/google';
import { ToastProvider } from '../components/ui';
import AppShell from '../components/AppShell';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

// Brand wordmark — restrained serif for calm premium feel.
const brand = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-brand',
});

export const metadata = {
  title: { default: 'Mira', template: '%s · Mira' },
  description: 'Competitive and market intelligence for founders, with decision support for what to do next.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${sans.className} ${sans.variable} ${brand.variable}`}>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
