'use client';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
type Confirm = { kind: 'resetKey' | 'delete' | 'disable'; user: AdminUser } | null;

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const {
    data: pages,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: KEY,
    queryFn: ({ pageParam }) => adminApi.users(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (Array.isArray(page) ? undefined : page.nextCursor ?? undefined),
  });
  const data = pages?.pages.flatMap((page) => (Array.isArray(page) ? page : page.items));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });

  const run = useMutation({
    mutationFn: async (c: NonNullable<Confirm>) => {
      if (c.kind === 'resetKey') await adminApi.resetKey(c.user.id);
      else if (c.kind === 'delete') await adminApi.deleteUser(c.user.id);
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
    resetKey: { title: 'Reset device key?', body: 'The user must enrol a new device key. Their direct conversations are removed and group keys may need rotation.', action: 'Reset key' },
    disable: { title: 'Disable this user?', body: 'They are signed out immediately and can’t sign in until re-enabled.', action: 'Disable' },
    delete: { title: 'Delete this user?', body: 'This permanently removes the account and its memberships.', action: 'Delete user' },
  };
  const approve = useMutation({
    mutationFn: (user: AdminUser) => adminApi.approveUser(user.id),
    onSuccess: () => { toast.success('User approved'); void refresh(); },
    onError: () => toast.error('Couldn’t approve this user. Refresh and try again.'),
  });

  return (
    <>
      <Topbar admin title="Users" greeting="Manage who has access" />
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm">{data ? `${data.length} accounts loaded · ${data.filter((u) => u.status === 'pending').length} awaiting approval` : ' '}</p>
        </div>
        {isLoading ? <Skeleton className="h-48" /> : isError ? (
          <p role="alert" className="text-sm">Couldn’t load users. <button className="font-medium text-primary-600 underline" onClick={() => refetch()}>Retry</button></p>
        ) : (
          <UsersTable
            users={data ?? []}
            actions={{
              onApprove: (user) => approve.mutate(user),
              onResetKey: (user) => setConfirm({ kind: 'resetKey', user }),
              onDelete: (user) => setConfirm({ kind: 'delete', user }),
              onToggle: (user) => (user.status === 'active' ? setConfirm({ kind: 'disable', user }) : enable.mutate(user)),
            }}
          />
        )}
        {hasNextPage && (
          <div className="mt-4 text-center">
            <Button variant="secondary" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              Load more users
            </Button>
          </div>
        )}
      </GlassCard>

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm ? copy[confirm.kind].title : ''}>
        {confirm && (
          <>
            <p className="text-sm"><span className="font-medium text-ink-900">{confirm.user.email || `@${confirm.user.username}`}</span> — {copy[confirm.kind].body}</p>
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
