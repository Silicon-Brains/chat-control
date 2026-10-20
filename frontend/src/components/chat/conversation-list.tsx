'use client';
import { MessagesSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerifiedMark } from '@/components/ui/verified-mark';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversations } from '@/hooks/use-conversations';
import { conversationTitle } from '@/lib/chat/helpers';
import { cn, formatRelative } from '@/lib/utils';
import { useSession } from '@/stores/session';
import type { ConversationType } from '@/types';
import { NewChatDialog } from './new-chat-dialog';

const FILTERS: { value: ConversationType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'direct', label: 'Direct' },
  { value: 'group', label: 'Groups' },
  { value: 'broadcast', label: 'Broadcasts' },
];

export function ConversationList({ activeId, initialFilter = 'all' }: { activeId?: string; initialFilter?: ConversationType | 'all' }) {
  const me = useSession((s) => s.user)!;
  const { data, isLoading, isError, refetch } = useConversations();
  const [filter, setFilter] = useState(initialFilter);
  const [open, setOpen] = useState(false);
  const list = (data ?? []).filter((c) => filter === 'all' || c.type === filter);

  return (
    <section className="glass flex h-full min-h-0 flex-col" aria-label="Conversations">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="text-[15px] font-medium">Chats</h2>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden />New chat</Button>
      </div>
      <div role="tablist" aria-label="Filter conversations" className="flex gap-1 px-4 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium', filter === f.value ? 'bg-primary-500 text-white' : 'hover:bg-primary-500/10')}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="space-y-3 p-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : isError ? (
          <EmptyState icon={MessagesSquare} title="Couldn’t load chats">
            <Button variant="secondary" size="sm" onClick={() => refetch()}>Try again</Button>
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="No conversations yet">
            <Button size="sm" onClick={() => setOpen(true)}>Start a chat</Button>
          </EmptyState>
        ) : (
          <ul>
            {list.map((c) => {
              const peer = c.type === 'direct' ? c.members.find((m) => m.userId !== me.id) : undefined;
              const title = conversationTitle(c, me.id);
              return (
                <li key={c.id}>
                  <Link
                    href={`/chats/${c.id}`}
                    aria-current={c.id === activeId ? 'page' : undefined}
                    className={cn('flex items-center gap-3 rounded-tile p-3 transition', c.id === activeId ? 'bg-primary-500/15' : 'hover:bg-primary-500/10')}
                  >
                    <Avatar name={title} icon={c.type === 'group' ? c.groupIcon : null} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate font-medium text-ink-900">
                        {title}{peer?.managementVerified && <VerifiedMark />}
                      </span>
                      <span className="block text-xs">{formatRelative(c.lastMessageAt)}</span>
                    </span>
                    {c.unreadCount > 0 && <Badge tone="solid" aria-label={`${c.unreadCount} unread`}>{c.unreadCount}</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <NewChatDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
