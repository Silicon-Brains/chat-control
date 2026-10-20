'use client';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, UserCheck, UserX, Users } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { CardHeader, GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { adminApi } from '@/lib/api/endpoints';
import { formatRelative } from '@/lib/utils';

export default function AdminDashboard() {
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.users });
  const audit = useQuery({ queryKey: ['admin', 'audit', 'recent'], queryFn: () => adminApi.audit() });

  const list = users.data ?? [];
  const entries = audit.data?.items ?? [];
  const failed = entries.filter((e) => e.action === 'login.fail').length;

  return (
    <>
      <Topbar admin title="Admin dashboard" greeting="Workspace overview" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Users} label="Total users" value={users.isLoading ? '…' : list.length} />
        <StatTile icon={UserCheck} label="Active" value={users.isLoading ? '…' : list.filter((u) => u.status === 'active').length} accent="purple" />
        <StatTile icon={UserX} label="Disabled" value={users.isLoading ? '…' : list.filter((u) => u.status === 'disabled').length} accent="orange" />
        <StatTile icon={ShieldAlert} label="Failed sign-ins (recent)" value={audit.isLoading ? '…' : failed} accent="pink" />
      </div>
      <GlassCard className="mt-5">
        <CardHeader title="Recent activity" href="/admin/audit" />
        {audit.isLoading ? <Skeleton className="h-32" /> : entries.length === 0 ? <p className="text-sm">No activity yet.</p> : (
          <ul className="divide-y divide-black/5">
            {entries.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3 text-sm">
                <span><span className="font-medium text-ink-900">{e.actorName ?? 'System'}</span> · {e.action}</span>
                <time dateTime={e.createdAt}>{formatRelative(e.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
