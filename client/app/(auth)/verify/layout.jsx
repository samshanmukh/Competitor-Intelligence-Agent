import { NOINDEX, pageMetadata } from '../../../lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'Verify email',
    description: 'Verify your email address to continue to Mira AI.',
    path: '/verify',
  }),
  ...NOINDEX,
};

export default function VerifyLayout({ children }) {
  return children;
}
