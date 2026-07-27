import { NOINDEX } from '../../../lib/seo';

export const metadata = {
  title: 'Verify email',
  description: 'Verify your email address to continue to Mira AI.',
  alternates: { canonical: '/verify' },
  ...NOINDEX,
};

export default function VerifyLayout({ children }) {
  return children;
}
