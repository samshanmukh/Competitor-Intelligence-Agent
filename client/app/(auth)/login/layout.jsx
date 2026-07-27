import { NOINDEX, pageMetadata } from '../../../lib/seo';

export const metadata = {
  ...pageMetadata({
    title: 'Sign in',
    description: 'Sign in to your Mira AI workspace.',
    path: '/login',
  }),
  ...NOINDEX,
};

export default function LoginLayout({ children }) {
  return children;
}
