'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CodeRevealDialog } from '@/components/admin/code-reveal-dialog';
import { CreateUserDialog } from '@/components/admin/create-user-dialog';
import { UsersTable } from '@/components/admin/users-table';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/lib/api/endpoints';
import { toast } from '@/stores/toast';
import type { AdminUser } from '@/types';

const KEY = ['admin', 'users'] as const;
type Confirm = { kind: 'reset' | 'delete' | 'disable'; user: AdminUser } | null;

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: KEY, queryFn: adminApi.users });
  const [creating, setCreating] = useState(false);
  const [reveal, setReveal] = useState<{ code: string; username: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const run = useMutation({
    mutationFn: async (c: NonNullable<Confirm>) => {
      if (c.kind === 'reset') {
        const { loginCode } = await adminApi.resetCode(c.user.id);
        setReveal({ code: loginCode, username: c.user.username });
      } else if (c.kind === 'delete') await adminApi.deleteUser(c.user.id);
      else await adminApi.setStatus(c.user.id, 'disabled');
    },
    onSuccess: () => { setConfirm(null); void refresh(); },
    onError: () => toast.error('That action failed. Try again.'),
  });

  const enable = useMutation({
    mutationFn: (u: AdminUser) => adminApi.setStatus(u.id, 'active'),
    onSuccess: () => { toast.success('User enabled'); void refresh(); },
    onError: () => toast.error('Couldn’t enable the user.'),
  });

  const copy: Record<NonNullable<Confirm>['kind'], { title: string; body: string; action: string }> = {
    reset: { title: 'Reset login code?', body: 'The old code stops working, all sessions are signed out and the user’s device key is cleared.', action: 'Reset code' },
    disable: { title: 'Disable this user?', body: 'They are signed out immediately and can’t sign in until re-enabled.', action: 'Disable' },
    delete: { title: 'Delete this user?', body: 'This permanently removes the account and its memberships.', action: 'Delete user' },
  };

  return (
    <>
      <Topbar admin title="Users" greeting="Manage who has access" />
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">{data ? `${data.length} accounts` : ' '}</p>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New user</Button>
        </div>
        {isLoading ? <Skeleton className="h-48" /> : isError ? (
          <p role="alert" className="text-sm">Couldn’t load users. <button className="font-medium text-primary-600 underline" onClick={() => refetch()}>Retry</button></p>
        ) : (
          <UsersTable
            users={data ?? []}
            actions={{
              onResetCode: (user) => setConfirm({ kind: 'reset', user }),
              onDelete: (user) => setConfirm({ kind: 'delete', user }),
              onToggle: (user) => (user.status === 'active' ? setConfirm({ kind: 'disable', user }) : enable.mutate(user)),
            }}
          />
        )}
      </GlassCard>

      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(u) => { setReveal({ code: u.loginCode, username: u.username }); void refresh(); }}
      />
      <CodeRevealDialog code={reveal?.code ?? null} username={reveal?.username ?? ''} onClose={() => setReveal(null)} />

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? copy[confirm.kind].title : ''}>
        {confirm && (
          <>
            <p className="text-sm"><span className="font-medium text-ink-900">@{confirm.user.username}</span> — {copy[confirm.kind].body}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="danger" loading={run.isPending} onClick={() => run.mutate(confirm)}>{copy[confirm.kind].action}</Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
