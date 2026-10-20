'use client';
import { useParams } from 'next/navigation';
import { ChatThread } from '@/components/chat/chat-thread';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversations } from '@/hooks/use-conversations';
import { SearchX } from 'lucide-react';

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useConversations();
  const conversation = data?.find((c) => c.id === id);

  if (isLoading) return <div className="glass h-full p-6"><Skeleton className="h-full" /></div>;
  if (!conversation) {
    return (
      <div className="glass grid h-full place-items-center">
        <EmptyState icon={SearchX} title="Conversation not found"><p className="text-sm">It may have been removed, or you’re not a member.</p></EmptyState>
      </div>
    );
  }
  return <ChatThread key={conversation.id} conversation={conversation} />;
}
