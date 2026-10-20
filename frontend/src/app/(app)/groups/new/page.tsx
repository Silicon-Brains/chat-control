'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Topbar } from '@/components/layout/topbar';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { VerifiedMark } from '@/components/ui/verified-mark';
import { CONVERSATIONS_KEY } from '@/hooks/use-conversations';
import { usersApi } from '@/lib/api/endpoints';
import { createConversation } from '@/lib/chat/create';
import { fieldErrors, groupSchema } from '@/lib/validation';
import { useSession } from '@/stores/session';
import { toast } from '@/stores/toast';

export default function NewGroupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useSession((s) => s.user)!;
  const { data, isLoading } = useQuery({ queryKey: ['directory'], queryFn: usersApi.directory });
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = groupSchema.safeParse({ name, memberIds: [...selected] });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error) as Record<string, string>);
    setErrors({});
    const self = data?.find((u) => u.id === me.id);
    if (!self) return;
    setBusy(true);
    try {
      const { id } = await createConversation({
        type: 'group', name: parsed.data.name, self,
        others: (data ?? []).filter((u) => selected.has(u.id)),
      });
      await qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      router.push(`/chats/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t create the group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Topbar title="New group" greeting="Create an encrypted group" />
      <GlassCard className="max-w-2xl">
        <form onSubmit={submit} noValidate className="space-y-6">
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={60} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-900">Members</legend>
            {isLoading ? <Skeleton className="h-32" /> : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {(data ?? []).filter((u) => u.id !== me.id).map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-tile p-2.5 hover:bg-primary-500/10">
                      <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 accent-primary-500" />
                      <Avatar name={u.displayName} size={32} />
                      <span className="flex flex-1 items-center gap-1 font-medium text-ink-900">
                        {u.displayName}{u.managementVerified && <VerifiedMark />}
                      </span>
                      {!u.publicKey && <span className="text-xs">hasn’t signed in yet</span>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {errors.memberIds && <p role="alert" className="mt-2 text-sm text-danger">{errors.memberIds}</p>}
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={busy}>Create group</Button>
          </div>
        </form>
      </GlassCard>
    </>
  );
}
