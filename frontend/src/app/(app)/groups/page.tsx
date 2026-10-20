import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ConversationGrid } from '@/components/chat/conversation-grid';
import { Topbar } from '@/components/layout/topbar';

export default function GroupsPage() {
  return (
    <>
      <Topbar title="Groups" greeting="Talk with several people" />
      <Link href="/groups/new" className="mb-5 inline-flex h-11 items-center gap-2 rounded-tile bg-primary-gradient px-5 font-medium text-white shadow-glass">
        <Plus className="h-4 w-4" aria-hidden />New group
      </Link>
      <ConversationGrid type="group" />
    </>
  );
}
