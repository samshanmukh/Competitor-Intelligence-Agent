import { NOINDEX } from '../../../lib/seo';

export const metadata = {
  title: 'Create account',
  description: 'Create a Mira AI account and workspace.',
  alternates: { canonical: '/signup' },
  ...NOINDEX,
};

export default function SignupLayout({ children }) {
  return children;
}
