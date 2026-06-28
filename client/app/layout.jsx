import './globals.css';
import { Inter } from 'next/font/google';
import Sidebar from '../components/Sidebar';
import { ToastProvider } from '../components/ui';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: { default: 'Competitor Pricing Intelligence', template: '%s · Pricing Intel' },
  description: 'Automatically discover, monitor, and analyze competitor pricing.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 mx-auto max-w-6xl px-5 py-8 md:px-8">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
