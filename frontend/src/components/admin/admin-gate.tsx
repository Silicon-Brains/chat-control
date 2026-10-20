'use client';
import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { Loader2, ShieldOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { setTokenProvider } from '@/lib/api/client';
import { env } from '@/lib/env';

const Spinner = () => (
  <div role="status" className="grid min-h-dvh place-items-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-label="Loading" />
  </div>
);

/**
 * Admin = Clerk session + `publicMetadata.role === "admin"`.
 * This only controls navigation; the API must verify the Clerk JWT and role itself.
 */
function ClerkAdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [bridged, setBridged] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace('/admin/login');
  }, [isLoaded, isSignedIn, router]);

  // Route every API call's Bearer token through Clerk while the admin area is mounted.
  useEffect(() => {
    if (!isSignedIn) return;
    setTokenProvider(() => getToken());
    setBridged(true);
    return () => {
      setTokenProvider(null);
      setBridged(false);
    };
  }, [isSignedIn, getToken]);

  if (!isLoaded || !isSignedIn || !user || !bridged) return <Spinner />;

  if (user.publicMetadata?.role !== 'admin') {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <GlassCard role="alert" className="max-w-md text-center">
          <ShieldOff className="mx-auto h-10 w-10 text-danger" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold">No admin access</h1>
          <p className="mt-2 text-sm">
            You’re signed in as {user.primaryEmailAddress?.emailAddress}, but this account isn’t an admin. Ask an
            existing admin to grant access, then sign in again.
          </p>
          <Button className="mt-6" onClick={() => signOut({ redirectUrl: '/admin/login' })}>Sign out</Button>
        </GlassCard>
      </main>
    );
  }
  return <>{children}</>;
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  // Mock mode keeps the old in-browser admin session so the app runs without Clerk.
  if (env.mock) return <AuthGate role="admin">{children}</AuthGate>;
  return <ClerkAdminGate>{children}</ClerkAdminGate>;
}
