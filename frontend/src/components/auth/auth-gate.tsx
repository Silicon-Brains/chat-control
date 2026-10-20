'use client';
import { useAuth, useClerk } from '@clerk/nextjs';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { ApiError, setTokenProvider } from '@/lib/api/client';
import { usersApi } from '@/lib/api/endpoints';
import { env } from '@/lib/env';
import type { Role } from '@/types';
import { useSession } from '@/stores/session';

function Spinner() {
  return (
    <div role="status" className="grid min-h-dvh place-items-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-label="Loading" />
    </div>
  );
}

/** Mock-only session guard. Production authorization is checked by the API. */
function MockAuthGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const { user, status, hydrate } = useSession();

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    if (status === 'anonymous') router.replace(role === 'admin' ? '/admin/login' : '/login');
    else if (status === 'authenticated' && user && user.role !== role) {
      router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [status, user, role, router]);

  if (status !== 'authenticated' || user?.role !== role) return <Spinner />;
  return <>{children}</>;
}

type AccessState = 'checking' | 'active' | 'pending' | 'disabled' | 'error';

function ClerkUserGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [access, setAccess] = useState<AccessState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/login');
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let current = true;
    setAccess('checking');
    setTokenProvider(() => getToken());
    void usersApi.me().then(async (me) => {
      if (!current) return;
      if (me.role === 'admin') router.replace('/admin');
      else {
        await useSession.getState().acceptClerkUser(me);
        if (current) setAccess('active');
      }
    }).catch((error: unknown) => {
      if (!current) return;
      if (error instanceof ApiError && error.code === 'APPROVAL_PENDING') setAccess('pending');
      else if (error instanceof ApiError && error.code === 'ACCOUNT_DISABLED') setAccess('disabled');
      else setAccess('error');
    });
    return () => {
      current = false;
      setTokenProvider(null);
    };
  }, [attempt, getToken, isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn || access === 'checking' || access === 'active') {
    if (access === 'active') return <>{children}</>;
    return <Spinner />;
  }

  const pending = access === 'pending';
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <GlassCard role="alert" className="w-full max-w-md text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-warning" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold">
          {pending ? 'Approval pending' : access === 'disabled' ? 'Account disabled' : 'Unable to check access'}
        </h1>
        <p className="mt-2 text-sm">
          {pending
            ? 'Your account is created. An administrator must approve it before you can use VaultChat.'
            : access === 'disabled'
              ? 'This account is disabled. Contact an administrator if you believe this is a mistake.'
              : 'We could not verify your account with VaultChat. Check your connection and try again.'}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {pending || access === 'error' ? (
            <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Check again</Button>
          ) : null}
          <Button variant="ghost" onClick={() => {
            useSession.getState().clearLocal();
            void signOut({ redirectUrl: '/login' });
          }}>Sign out</Button>
        </div>
      </GlassCard>
    </main>
  );
}

/** Clerk session plus server-side approval; the backend remains the authorization authority. */
export function AuthGate({ role, children }: { role: Role; children: React.ReactNode }) {
  if (env.mock) return <MockAuthGate role={role}>{children}</MockAuthGate>;
  return <ClerkUserGate>{children}</ClerkUserGate>;
}
