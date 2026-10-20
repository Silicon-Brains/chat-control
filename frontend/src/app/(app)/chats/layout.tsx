'use client';
import { usePathname } from 'next/navigation';
import { ConversationList } from '@/components/chat/conversation-list';
import { cn } from '@/lib/utils';

export default function ChatsLayout({ children }: { children: React.ReactNode }) {
  const activeId = usePathname().split('/')[2];
  return (
    <div className="grid h-[calc(100dvh-7.5rem)] gap-5 md:h-[calc(100dvh-2.5rem)] lg:grid-cols-[340px_1fr]">
      <div className={cn('min-h-0', activeId && 'hidden lg:block')}><ConversationList activeId={activeId} /></div>
      <div className={cn('min-h-0', !activeId && 'hidden lg:block')}>{children}</div>
    </div>
  );
}
