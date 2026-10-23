'use client';
import { useState } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { DatabaseSyncProvider } from '@/components/chat/database-sync-provider';
import { AppShell } from '@/components/layout/app-shell';
import { userNav } from '@/components/layout/nav-config';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Modal } from '@/components/ui/modal';
import { useSession } from '@/stores/session';

function KeyGuard({ children }: { children: React.ReactNode }) {
  const keyError = useSession((s) => s.keyError);
  const keyResetRequired = useSession((s) => s.keyResetRequired);
  const keyResetting = useSession((s) => s.keyResetting);
  const retryKeySetup = useSession((s) => s.retryKeySetup);
  const recoverDeviceKey = useSession((s) => s.recoverDeviceKey);
  const [confirmReset, setConfirmReset] = useState(false);

  if (keyError) {
    return (
      <>
        <GlassCard role="alert" className="mx-auto mt-24 max-w-md text-center">
          <h1 className="text-xl font-bold">Encryption setup failed</h1>
          <p className="mt-2">{keyError}</p>
          {keyResetRequired ? (
            <>
              <p className="mt-3 text-sm">
                Resetting replaces the registered key, deletes your direct conversations, and removes your old wrapped
                keys from group chats. Old encrypted messages cannot be recovered, and group chats will need key rotation.
              </p>
              <Button className="mt-6" onClick={() => setConfirmReset(true)}>Reset key and continue</Button>
            </>
          ) : (
            <Button className="mt-6" onClick={() => void retryKeySetup()}>Try again</Button>
          )}
        </GlassCard>
        <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset encryption key?">
          <p className="text-sm">
            This is permanent. Your direct conversations will be deleted, group chats will require key rotation, and
            messages encrypted for the old key cannot be recovered.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmReset(false)} disabled={keyResetting}>Cancel</Button>
            <Button
              variant="danger"
              loading={keyResetting}
              onClick={async () => {
                if (await recoverDeviceKey()) setConfirmReset(false);
              }}
            >
              Reset key
            </Button>
          </div>
        </Modal>
      </>
    );
  }
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate role="user">
      <DatabaseSyncProvider>
        <AppShell nav={userNav}><KeyGuard>{children}</KeyGuard></AppShell>
      </DatabaseSyncProvider>
    </AuthGate>
  );
}
