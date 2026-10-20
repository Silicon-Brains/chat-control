'use client';
import { AuthGate } from '@/components/auth/auth-gate';
import { RealtimeProvider } from '@/components/chat/realtime-provider';
import { AppShell } from '@/components/layout/app-shell';
import { userNav } from '@/components/layout/nav-config';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { useSession } from '@/stores/session';

function KeyGuard({ children }: { children: React.ReactNode }) {
  const keyError = useSession((s) => s.keyError);
  if (keyError) {
    return (
      <GlassCard role="alert" className="mx-auto mt-24 max-w-md text-center">
        <h1 className="text-xl font-bold">Encryption setup failed</h1>
        <p className="mt-2">{keyError} Use a current browser and make sure site storage isn’t blocked.</p>
        <Button className="mt-6" onClick={() => location.reload()}>Try again</Button>
      </GlassCard>
    );
  }
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="user">
      <RealtimeProvider>
        <AppShell nav={userNav}><KeyGuard>{children}</KeyGuard></AppShell>
      </RealtimeProvider>
    </AuthGate>
  );
}
