import './globals.css';
import { Inter, Unbounded } from 'next/font/google';
import { ToastProvider } from '../components/ui';
import AppShell from '../components/AppShell';

const inter = Inter({ subsets: ['latin'] });
// Kept for any residual brand typography; chrome uses BrandLogo image.
const brand = Unbounded({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-brand' });

export const metadata = {
  title: { default: 'Mira AI', template: '%s · Mira AI' },
  description: 'Competitive and market intelligence for founders, with decision support for what to do next.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png', sizes: '32x32' }, { url: '/mira-icon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
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
