import './globals.css';
import { Inter, Unbounded } from 'next/font/google';
import { ToastProvider } from '../components/ui';
import AppShell from '../components/AppShell';

const inter = Inter({ subsets: ['latin'] });
// Brand wordmark font, exposed as --font-brand for the "Mira Vue" logo only.
const brand = Unbounded({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-brand' });

export const metadata = {
  title: { default: 'Mira Vue', template: '%s · Mira Vue' },
  description: 'Competitive and market intelligence for founders, with decision support for what to do next.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} ${brand.variable}`}>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
