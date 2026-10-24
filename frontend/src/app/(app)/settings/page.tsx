'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { CardHeader, GlassCard } from '@/components/ui/glass-card';
import { Modal } from '@/components/ui/modal';
import { removeIdentity } from '@/lib/crypto';
import { groupFingerprint } from '@/lib/utils';
import { useSession } from '@/stores/session';

export default function SettingsPage() {
  const router = useRouter();
  const { user, fingerprint, signOut } = useSession();
  const [confirm, setConfirm] = useState(false);

  async function resetDeviceKey() {
    if (!user) return;
    await removeIdentity(user.id);
    await signOut();
    router.replace('/login');
  }

  return (
    <>
      <Topbar title="Settings" greeting="Your account and device" />
      <div className="grid max-w-3xl gap-5">
        <GlassCard>
          <CardHeader title="Appearance" />
          <p className="mb-4 text-sm">Choose a theme for this device. Your preference is saved in this browser.</p>
          <ThemeToggle />
        </GlassCard>
        <GlassCard>
          <CardHeader title="Profile" />
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt>Name</dt><dd className="text-ink-900">{user?.displayName}</dd>
            <dt>Username</dt><dd className="text-ink-900">@{user?.username}</dd>
          </dl>
        </GlassCard>
        <GlassCard>
          <CardHeader title="Device key" />
          <p className="text-sm">Compare this fingerprint with your contact out-of-band to verify you’re talking to the right person.</p>
          <p className="mt-3 break-all rounded-tile bg-white/50 p-3 font-mono text-sm text-ink-900">{fingerprint ? groupFingerprint(fingerprint) : 'Not set up'}</p>
          <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirm(true)}>Reset this device’s key</Button>
        </GlassCard>
        <GlassCard>
          <CardHeader title="Session" />
          <Button variant="secondary" onClick={async () => { await signOut(); router.replace('/login'); }}>Sign out</Button>
        </GlassCard>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset device key?">
        <p className="text-sm">A new key is created at your next sign-in. Messages encrypted for the old key can’t be read afterwards, and your contacts will see a changed fingerprint.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={resetDeviceKey}>Reset key and sign out</Button>
        </div>
      </Modal>
    </>
  );
}
