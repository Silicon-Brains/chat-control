import { Check } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { CardHeader, GlassCard } from '@/components/ui/glass-card';

const POSTURE = [
  ['Admin sign-in uses Clerk MFA', 'Clerk manages admin sessions and multifactor authentication.'],
  ['New accounts need approval', 'Clerk sign-ups are pending and cannot access chats until approved by an admin.'],
  ['Messages are end-to-end encrypted', 'The server stores ciphertext only and cannot read content.'],
  ['Messages delete after 10 hours', 'Expired rows are removed within a minute and never returned.'],
];

const LIMITS = [
  'The server can see who talks to whom, when, and message sizes.',
  'Resetting a user’s device key requires re-enrolment; contacts see a changed fingerprint.',
  'Keys are static per device (no forward secrecy); the 10-hour expiry limits exposure.',
];

export default function SecurityPage() {
  return (
    <>
      <Topbar admin title="Security" greeting="What protects this workspace" />
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <CardHeader title="Protections" />
          <ul className="space-y-4">
            {POSTURE.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-500/15 text-primary-600"><Check className="h-4 w-4" aria-hidden /></span>
                <div><p className="font-medium text-ink-900">{t}</p><p className="text-sm">{d}</p></div>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard>
          <CardHeader title="Known limits" />
          <ul className="list-disc space-y-3 pl-5 text-sm">{LIMITS.map((l) => <li key={l}>{l}</li>)}</ul>
        </GlassCard>
      </div>
    </>
  );
}
