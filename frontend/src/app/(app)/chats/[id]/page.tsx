'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ChatThread } from '@/components/chat/chat-thread';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { conversationsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { ensureKeys } from '@/lib/crypto';
import { SearchX } from 'lucide-react';
import { useSession } from '@/stores/session';
import type { Conversation } from '@/types';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const userId = useSession((s) => s.user?.id);
  const keyReady = useSession((s) => s.keyReady);
  const queryClient = useQueryClient();
  const cachedConversation = queryClient
    .getQueryData<Conversation[]>(['conversations'])
    ?.find((item) => item.id === id);
  const { data: conversation, isPending, isError, error, refetch } = useQuery({
    queryKey: ['conversation', id],
    enabled: Boolean(id && userId && keyReady),
    initialData: cachedConversation,
    initialDataUpdatedAt: queryClient.getQueryState(['conversations'])?.dataUpdatedAt,
    queryFn: async () => {
      if (!userId) throw new Error('Your session is not ready.');
      const result = await conversationsApi.get(id);
      await ensureKeys(userId, result);
      return result;
    },
  });

  if (!keyReady || isPending) return <div className="glass h-full p-6"><Skeleton className="h-full" /></div>;
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="glass grid h-full place-items-center">
        <EmptyState
          icon={SearchX}
          title={notFound ? 'Conversation not found' : 'Couldn’t load conversation'}
        >
          <p className="text-sm">
            {notFound
              ? 'It may have been removed, or you’re not a member.'
              : error instanceof Error ? error.message : 'Check your connection and try again.'}
          </p>
          {!notFound && <Button variant="secondary" size="sm" onClick={() => void refetch()}>Try again</Button>}
        </EmptyState>
      </div>
    );
  }
  if (!conversation) return <div className="glass h-full p-6"><Skeleton className="h-full" /></div>;
  return <ChatThread key={conversation.id} conversation={conversation} />;
}
