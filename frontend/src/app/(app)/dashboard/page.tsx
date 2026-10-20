'use client';
import { BellRing, KeyRound, MessageSquare, Timer } from 'lucide-react';
import Link from 'next/link';
import { Topbar } from '@/components/layout/topbar';
import { Badge } from '@/components/ui/badge';
import { CardHeader, GlassCard } from '@/components/ui/glass-card';
import { HeroBanner } from '@/components/ui/hero-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { useNow } from '@/hooks/use-now';
import { useConversations } from '@/hooks/use-conversations';
import { conversationTitle } from '@/lib/chat/helpers';
import { EXPIRY_WARNING_MS } from '@/lib/constants';
import { formatCountdown, formatRelative } from '@/lib/utils';
import { useChatStore } from '@/stores/chat';
import { useSession } from '@/stores/session';

export default function DashboardHomePage() {
  const me = useSession((s) => s.user)!;
  const fingerprint = useSession((s) => s.fingerprint);
  const { data, isLoading } = useConversations();
  const messages = useChatStore((s) => s.messages);
  const now = useNow(30_000);

  const convs = data ?? [];
  const unread = convs.reduce((n, c) => n + c.unreadCount, 0);
  const expiring = convs.filter((c) => c.nextExpiryAt && new Date(c.nextExpiryAt).getTime() - now < EXPIRY_WARNING_MS).length;

  const loaded = Object.values(messages).flat();
  const sent = loaded.filter((m) => m.senderId === me.id).length;
  const received = loaded.length - sent;
  const soon = loaded.filter((m) => new Date(m.expiresAt).getTime() - now < EXPIRY_WARNING_MS).length;
  const total = Math.max(loaded.length, 1);
  const latest = convs[0];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-8"><HeroBanner title="Create a new group" body="Everything is encrypted on your device before it’s sent, and gone after 10 hours." href="/groups/new" cta="New group" /></div>
        <GlassCard className="lg:col-span-4">
          <CardHeader title="Resume chat" href={latest ? `/chats/${latest.id}` : '/chats'} actionLabel="Open" />
          {isLoading ? <Skeleton className="h-16" /> : latest ? (
            <>
              <p className="text-xl font-semibold text-ink-900">{conversationTitle(latest, me.id)}</p>
              <p className="mt-1 text-sm">Last message {formatRelative(latest.lastMessageAt, now)}</p>
            </>
          ) : <p className="text-sm">No conversations yet. Start one from Chats.</p>}
        </GlassCard>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
          <StatTile icon={MessageSquare} label="Active chats" value={convs.length} accent="slate" />
          <StatTile icon={BellRing} label="Unread" value={unread} accent="purple" />
          <StatTile icon={Timer} label="Expiring < 1 h" value={expiring} accent="orange" />
          <StatTile icon={KeyRound} label="Device key" value={fingerprint ? 'Active' : 'Setting up'} accent="pink" />
        </div>

        <GlassCard className="lg:col-span-7">
          <CardHeader title="Recent conversations" href="/chats" />
          {isLoading ? <Skeleton className="h-40" /> : convs.length === 0 ? <p className="text-sm">Nothing here yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead className="text-xs font-medium text-ink-400">
                  <tr><th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Unread</th><th className="pb-2 font-medium">Last activity</th><th className="pb-2 font-medium">Next expiry</th></tr>
                </thead>
                <tbody>
                  {convs.slice(0, 6).map((c, i) => (
                    <tr key={c.id} className="h-14 border-t border-black/5">
                      <td className={i === 0 ? 'font-bold text-ink-900' : 'text-ink-900'}><Link href={`/chats/${c.id}`} className="hover:underline">{conversationTitle(c, me.id)}</Link></td>
                      <td>{c.unreadCount > 0 ? <Badge tone="solid">{c.unreadCount}</Badge> : '—'}</td>
                      <td>{formatRelative(c.lastMessageAt, now)}</td>
                      <td>{c.nextExpiryAt ? formatCountdown(new Date(c.nextExpiryAt).getTime() - now) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-5">
          <CardHeader title="Messages in open chats" />
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Sent', sent], ['Received', received], ['Expiring', soon]].map(([l, v]) => (
              <div key={l}><p className="text-[28px] font-semibold leading-[34px] text-ink-900">{v}</p><p className="text-xs">{l}</p></div>
            ))}
          </div>
          <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/60" role="img" aria-label={`${soon} of ${loaded.length} messages expiring within an hour`}>
            <div className="bg-primary-500" style={{ width: `${((loaded.length - soon) / total) * 100}%` }} />
            <div className="bg-danger" style={{ width: `${(soon / total) * 100}%` }} />
          </div>
        </GlassCard>
      </div>
    </>
  );
}
