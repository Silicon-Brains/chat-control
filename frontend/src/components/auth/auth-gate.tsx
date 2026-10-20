'use client';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { Role } from '@/types';
import { useSession } from '@/stores/session';

/** Client guard. The API enforces real authorisation; this only controls navigation. */
export function AuthGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const { user, status, hydrate } = useSession();

  useEffect(() => { void hydrate(); }, [hydrate]);

  useEffect(() => {
    if (status === 'anonymous') router.replace(role === 'admin' ? '/admin/login' : '/login');
    else if (status === 'authenticated' && user && user.role !== role) router.replace(user.role === 'admin' ? '/admin' : '/');
  }, [status, user, role, router]);

  if (status !== 'authenticated' || user?.role !== role) {
    return (
      <div role="status" className="grid min-h-dvh place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
