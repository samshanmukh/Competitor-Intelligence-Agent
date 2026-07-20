import { redirect } from 'next/navigation';

/** Legacy test route — social buttons live on /login and /signup now. */
export default async function OAuthTestPage({ searchParams }) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  if (params?.oauth_error) qs.set('oauth_error', String(params.oauth_error));
  if (params?.from) qs.set('from', String(params.from));
  redirect(`/login${qs.size ? `?${qs}` : ''}`);
}
