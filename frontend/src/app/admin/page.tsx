'use client';
import { useQuery } from '@tanstack/react-query';
import { Clock3, ShieldAlert, UserCheck, UserX, Users } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { CardHeader, GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { adminApi } from '@/lib/api/endpoints';
import { formatRelative } from '@/lib/utils';

export default function AdminDashboard() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  const audit = useQuery({ queryKey: ['admin', 'audit', 'recent'], queryFn: () => adminApi.audit() });

  const entries = audit.data?.items ?? [];
  const failed = entries.filter((e) => e.action === 'login.fail').length;

  return (
    <>
      <Topbar admin title="Admin dashboard" greeting="Workspace overview" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon={Users} label="Total users" value={stats.isLoading ? '…' : stats.data?.usersTotal ?? 0} />
        <StatTile icon={UserCheck} label="Active" value={stats.isLoading ? '…' : stats.data?.usersActive ?? 0} accent="purple" />
        <StatTile icon={Clock3} label="Awaiting approval" value={stats.isLoading ? '…' : stats.data?.usersPending ?? 0} accent="orange" />
        <StatTile icon={UserX} label="Disabled" value={stats.isLoading ? '…' : stats.data?.usersDisabled ?? 0} accent="orange" />
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
