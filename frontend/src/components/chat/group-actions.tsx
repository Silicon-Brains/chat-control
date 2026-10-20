'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CONVERSATIONS_KEY } from '@/hooks/use-conversations';
import { conversationsApi } from '@/lib/api/endpoints';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Conversation } from '@/types';
import { useChatStore } from '@/stores/chat';
import { toast } from '@/stores/toast';

const GROUP_ICONS = ['💬', '👥', '🚀', '🎮', '🎨', '📚', '🎵', '⚽', '🌿', '⭐'];

export function GroupActions({ conversation }: { conversation: Conversation }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null);
  const [name, setName] = useState(conversation.name ?? '');
  const [groupIcon, setGroupIcon] = useState(conversation.groupIcon);
  const [busy, setBusy] = useState(false);

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Enter a group name.');
      return;
    }
    setBusy(true);
    try {
      const updated = await conversationsApi.updateGroup(conversation.id, {
        name: trimmedName,
        groupIcon,
      });
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_KEY, (current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)),
      );
      queryClient.setQueryData(['conversation', updated.id], updated);
      setMode(null);
      toast.success('Group details updated.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t update the group.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteGroup() {
    setBusy(true);
    try {
      await conversationsApi.deleteGroup(conversation.id);
      queryClient.setQueryData<Conversation[]>(CONVERSATIONS_KEY, (current) =>
        current?.filter((item) => item.id !== conversation.id),
      );
      queryClient.removeQueries({ queryKey: ['conversation', conversation.id] });
      useChatStore.getState().clearConversation(conversation.id);
      setMode(null);
      toast.success('Group deleted for everyone.');
      router.replace('/chats');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Couldn’t delete the group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Edit group"
          title="Edit group"
          onClick={() => {
            setName(conversation.name ?? '');
            setGroupIcon(conversation.groupIcon);
            setMode('edit');
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete group"
          title="Delete group"
          className="text-danger hover:bg-danger/10"
          onClick={() => setMode('delete')}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <Modal
        open={mode !== null}
        onClose={() => {
          if (!busy) setMode(null);
        }}
        title={mode === 'delete' ? 'Delete group?' : 'Edit group'}
      >
        {mode === 'edit' ? (
          <div className="space-y-5">
            <Input
              label="Group name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
            />
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-900">Group icon</legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-label="Use default group icon"
                  aria-pressed={groupIcon === null}
                  onClick={() => setGroupIcon(null)}
                  className={`grid h-11 w-11 place-items-center rounded-full border text-xs ${groupIcon === null ? 'border-primary-500 bg-primary-500/10' : 'border-black/10 hover:bg-primary-500/10'}`}
                >
                  Default
                </button>
                {GROUP_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={`Use ${icon} group icon`}
                    aria-pressed={groupIcon === icon}
                    onClick={() => setGroupIcon(icon)}
                    className={`grid h-11 w-11 place-items-center rounded-full border text-xl ${groupIcon === icon ? 'border-primary-500 bg-primary-500/10' : 'border-black/10 hover:bg-primary-500/10'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={() => void save()}>
                Save changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm">
              This permanently removes{' '}
              <span className="font-semibold text-ink-900">{conversation.name}</span>, its messages,
              and its membership for everyone. This can’t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button variant="danger" loading={busy} onClick={() => void deleteGroup()}>
                Delete for everyone
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
