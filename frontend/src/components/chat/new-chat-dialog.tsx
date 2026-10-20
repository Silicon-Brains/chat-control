'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { CONVERSATIONS_KEY } from '@/hooks/use-conversations';
import { usersApi } from '@/lib/api/endpoints';
import { createConversation } from '@/lib/chat/create';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toast';

export const DIRECTORY_KEY = ['directory'] as const;

export function NewChatDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useSession((s) => s.user)!;
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: DIRECTORY_KEY, queryFn: usersApi.directory, enabled: open });

  async function start(otherId: string) {
    const self = data?.find((u) => u.id === me.id);
    const other = data?.find((u) => u.id === otherId);
    if (!self || !other) return;
    setBusyId(otherId);
    try {
      const { id } = await createConversation({ type: 'direct', self, others: [other] });
      await qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      onClose();
      router.push(`/chats/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t start the chat.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Start a chat">
      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {(data ?? []).filter((u) => u.id !== me.id).map((u) => (
            <li key={u.id}>
              <button
                onClick={() => start(u.id)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-3 rounded-tile p-2.5 text-left hover:bg-primary-500/10 disabled:opacity-50"
              >
                <Avatar name={u.displayName} size={36} />
                <span className="flex-1">
                  <span className="block font-medium text-ink-900">{u.displayName}</span>
                  <span className="block text-xs">@{u.username}{!u.publicKey && ' · hasn’t signed in yet'}</span>
                </span>
                {busyId === u.id && <span className="text-xs">Starting…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 text-right"><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
    </Modal>
  );
}
