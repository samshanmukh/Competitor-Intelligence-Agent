import './globals.css';
import { Inter, Unbounded } from 'next/font/google';
import { ToastProvider } from '../components/ui';
import AppShell from '../components/AppShell';

const inter = Inter({ subsets: ['latin'] });
// Brand wordmark font, exposed as --font-brand for the "Mira Vue" logo only.
const brand = Unbounded({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-brand' });

export const metadata = {
  title: { default: 'Mira Vue', template: '%s · Mira Vue' },
  description: 'Automatically discover, monitor, and analyze competitor pricing.',
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
