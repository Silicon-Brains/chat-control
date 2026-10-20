import { ConversationGrid } from '@/components/chat/conversation-grid';
import { Topbar } from '@/components/layout/topbar';

export default function BroadcastsPage() {
  return (
    <>
      <Topbar title="Broadcasts" greeting="Announcements from senders" />
      <ConversationGrid type="broadcast" />
    </>
  );
}
