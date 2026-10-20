'use client';
import { Megaphone, Users } from 'lucide-react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversations } from '@/hooks/use-conversations';
import { conversationTitle } from '@/lib/chat/helpers';
import { formatRelative } from '@/lib/utils';
import { useSession } from '@/stores/session';

export function ConversationGrid({ type }: { type: 'group' | 'broadcast' }) {
  const me = useSession((s) => s.user)!;
  const { data, isLoading } = useConversations();
  const list = (data ?? []).filter((c) => c.type === type);
  const Icon = type === 'group' ? Users : Megaphone;

  if (isLoading) return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 !rounded-card" />)}</div>;
  if (list.length === 0) {
    return (
      <GlassCard>
        <EmptyState icon={Icon} title={type === 'group' ? 'No groups yet' : 'No broadcast channels yet'}>
          <p className="text-sm">{type === 'group' ? 'Create a group to chat with several people at once.' : 'Your admin adds you to broadcast channels.'}</p>
        </EmptyState>
      </GlassCard>
    );
  }
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((c) => {
        const title = conversationTitle(c, me.id);
        return (
          <li key={c.id}>
            <Link href={`/chats/${c.id}`} className="glass block p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-center gap-3">
                <Avatar name={title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink-900">{title}</p>
                  <p className="text-xs">{c.members.length} members · {formatRelative(c.lastMessageAt)}</p>
                </div>
                {c.unreadCount > 0 && <Badge tone="solid">{c.unreadCount}</Badge>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
