'use client';
import { Ban, KeyRound, RotateCcw, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/utils';
import type { AdminUser } from '@/types';

export interface UserActions {
  onResetCode: (u: AdminUser) => void;
  onToggle: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
}

export function UsersTable({ users, actions }: { users: AdminUser[]; actions: UserActions }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Users</caption>
        <thead className="text-xs text-ink-400">
          <tr>{['User', 'Status', 'Key', 'Last sign-in', ''].map((h, i) => <th key={i} scope="col" className="pb-2 font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id} className="h-14 border-t border-black/5">
              <td>
                <div className="flex items-center gap-3">
                  <Avatar name={u.displayName} size={34} />
                  <div>
                    <p className={i === 0 ? 'font-bold text-ink-900' : 'font-medium text-ink-900'}>{u.displayName}</p>
                    <p className="text-xs">@{u.username}</p>
                  </div>
                </div>
              </td>
              <td><Badge tone={u.status === 'active' ? 'teal' : 'danger'}>{u.status}</Badge></td>
              <td className="font-mono text-xs">{u.keyFingerprint ? `${u.keyFingerprint.slice(0, 8)}…` : <span className="font-sans">Not set</span>}</td>
              <td>{formatRelative(u.lastLoginAt)}</td>
              <td>
                {u.role === 'user' && (
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => actions.onResetCode(u)} aria-label={`Reset code for ${u.username}`}><KeyRound className="h-4 w-4" aria-hidden /></Button>
                    <Button variant="ghost" size="sm" onClick={() => actions.onToggle(u)} aria-label={`${u.status === 'active' ? 'Disable' : 'Enable'} ${u.username}`}>
                      {u.status === 'active' ? <Ban className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => actions.onDelete(u)} aria-label={`Delete ${u.username}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
