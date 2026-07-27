import { NOINDEX } from '../../../lib/seo';

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to your Mira AI workspace.',
  alternates: { canonical: '/login' },
  ...NOINDEX,
};

export default function LoginLayout({ children }) {
  return children;
}
