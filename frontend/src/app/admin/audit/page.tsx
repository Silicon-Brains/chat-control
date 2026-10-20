'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Topbar } from '@/components/layout/topbar';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { adminApi } from '@/lib/api/endpoints';
import { formatDateTime } from '@/lib/utils';

export default function AuditPage() {
  const q = useInfiniteQuery({
    queryKey: ['admin', 'audit'],
    queryFn: ({ pageParam }) => adminApi.audit(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <Topbar admin title="Audit log" greeting="Admin actions and security events" />
      <GlassCard>
        {q.isLoading ? <Skeleton className="h-48" /> : q.isError ? <p role="alert" className="text-sm">Couldn’t load the audit log.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead className="text-xs text-ink-400"><tr>{['Time', 'Actor', 'Action', 'IP'].map((h) => <th key={h} scope="col" className="pb-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="h-14 border-t border-black/5">
                    <td>{formatDateTime(r.createdAt)}</td>
                    <td className="text-ink-900">{r.actorName ?? 'System'}</td>
                    <td className="font-mono text-xs">{r.action}</td>
                    <td className="font-mono text-xs">{r.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="py-8 text-center text-sm">No events recorded.</p>}
          </div>
        )}
        {q.hasNextPage && <div className="mt-4 text-center"><Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>Load more</Button></div>}
      </GlassCard>
    </>
  );
}
