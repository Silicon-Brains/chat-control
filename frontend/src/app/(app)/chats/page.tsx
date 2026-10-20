import { MessagesSquare } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export default function ChatsIndexPage() {
  return (
    <div className="glass grid h-full place-items-center">
      <EmptyState icon={MessagesSquare} title="Select a conversation">
        <p className="text-sm">Messages are encrypted on your device and expire after 10 hours.</p>
      </EmptyState>
    </div>
  );
}
