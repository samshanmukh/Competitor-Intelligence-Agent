'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { getToken, switchWorkspace } from '../../../lib/auth';
import { Skeleton } from '../../../components/ui';
import BrandLogo from '../../../components/BrandLogo';

function InviteInner() {
  const { workspaceId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const emailHint = search.get('email') || '';

  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const loggedIn = typeof window !== 'undefined' && !!getToken();

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const data = await api.getInviteInfo(workspaceId);
        setInfo(data.workspace);
      } catch (err) {
        setError(err.message || 'Invite not found');
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  const accept = async () => {
    setAccepting(true);
    setError('');
    try {
      const { workspace } = await api.acceptInvite(workspaceId);
      if (workspace) switchWorkspace(workspace);
      router.push('/app');
    } catch (err) {
      setError(err.message || 'Could not accept invite');
      setAccepting(false);
    }
  };

  if (loading) {
    return <Skeleton className="mx-auto mt-24 h-48 max-w-md" />;
  }

  return (
    <div className="mx-auto max-w-md px-5 py-24">
      <div className="mb-8 flex justify-center">
        <BrandLogo href="/" height={40} />
      </div>
      <div className="card space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold text-white">
          {info ? `Join ${info.name}` : 'Workspace invite'}
        </h1>
        <p className="text-sm text-slate-400">
          {emailHint
            ? <>Sign in as <strong className="text-slate-200">{emailHint}</strong> to accept this invite.</>
            : 'Sign in with the invited email to join this workspace.'}
        </p>
        {error && (
          <p className="rounded-lg border border-rose-800/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">{error}</p>
        )}
        {loggedIn ? (
          <button onClick={accept} disabled={accepting} className="btn-primary w-full">
            {accepting ? 'Joining…' : 'Accept invite'}
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <Link
              href={`/login?from=${encodeURIComponent(`/invite/${workspaceId}?email=${encodeURIComponent(emailHint)}`)}`}
              className="btn-primary w-full text-center"
            >
              Sign in to accept
            </Link>
            <Link
              href={`/signup?from=${encodeURIComponent(`/invite/${workspaceId}?email=${encodeURIComponent(emailHint)}`)}`}
              className="btn-ghost w-full text-center"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-48 max-w-md" />}>
      <InviteInner />
    </Suspense>
  );
}
