import './globals.css';
import { Inter } from 'next/font/google';
import { ToastProvider } from '../components/ui';
import AppShell from '../components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: { default: 'Mira AI', template: '%s · Mira AI' },
  description: 'Automatically discover, monitor, and analyze competitor pricing.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
