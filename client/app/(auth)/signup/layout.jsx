import { NOINDEX, pageMetadata } from '../../../lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'Create account',
    description: 'Create a Mira AI account and workspace.',
    path: '/signup',
  }),
  ...NOINDEX,
};

export default function SignupLayout({ children }) {
  return children;
}
