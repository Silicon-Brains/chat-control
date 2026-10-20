'use client';
import { BadgeCheck, Ban, KeyRound, RotateCcw, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerifiedMark } from '@/components/ui/verified-mark';
import { formatRelative } from '@/lib/utils';
import type { AdminUser } from '@/types';

export interface UserActions {
  onApprove: (u: AdminUser) => void;
  onResetKey: (u: AdminUser) => void;
  onToggle: (u: AdminUser) => void;
  onDelete: (u: AdminUser) => void;
  onRoleChange: (u: AdminUser, role: 'admin' | 'user') => void;
  onVerificationChange: (u: AdminUser, verified: boolean) => void;
}

export function UsersTable({ users, actions }: { users: AdminUser[]; actions: UserActions }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <caption className="sr-only">Users</caption>
        <thead className="text-xs text-ink-400">
          <tr>{['User', 'Role', 'Status', 'Key', 'Last sign-in', 'Management Team', ''].map((h, i) => <th key={i} scope="col" className="pb-2 font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={u.id} className="h-14 border-t border-black/5">
              <td>
                <div className="flex items-center gap-3">
                  <Avatar name={u.displayName} size={34} />
                  <div>
                    <p className={`flex items-center gap-1 ${i === 0 ? 'font-bold text-ink-900' : 'font-medium text-ink-900'}`}>
                      {u.displayName}{u.managementVerified && <VerifiedMark />}
                    </p>
                    <p className="text-xs">{u.email || `@${u.username}`}</p>
                  </div>
                </div>
              </td>
              <td>
                <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.username}</label>
                <select
                  id={`role-${u.id}`}
                  value={u.role}
                  onChange={(e) => actions.onRoleChange(u, e.target.value as 'admin' | 'user')}
                  disabled={u.status === 'pending' || (u.status === 'disabled' && u.role === 'user')}
                  className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td><Badge tone={u.status === 'active' ? 'teal' : u.status === 'pending' ? 'orange' : 'danger'}>{u.status}</Badge></td>
              <td className="font-mono text-xs">{u.keyFingerprint ? `${u.keyFingerprint.slice(0, 8)}…` : <span className="font-sans">Not set</span>}</td>
              <td>{formatRelative(u.lastLoginAt)}</td>
              <td>
                <div className="flex justify-center">
                  <Button
                    variant={u.managementVerified ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => actions.onVerificationChange(u, !u.managementVerified)}
                    aria-label={`${u.managementVerified ? 'Remove Management Team verification from' : 'Verify for Management Team'} ${u.username}`}
                    title={u.managementVerified ? 'Remove Management Team verification' : 'Verify for Management Team'}
                  >
                    <VerifiedMark className={u.managementVerified ? '' : 'text-ink-400'} />
                    <span className="sr-only">{u.managementVerified ? 'Verified' : 'Not verified'}</span>
                  </Button>
                </div>
              </td>
              <td>
                <div className="flex justify-end gap-1">
                  {u.role === 'user' && (
                    <>
                      {u.status === 'pending' ? (
                        <Button variant="secondary" size="sm" onClick={() => actions.onApprove(u)} aria-label={`Approve ${u.username}`}>
                          <BadgeCheck className="h-4 w-4" aria-hidden />Approve
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => actions.onResetKey(u)} aria-label={`Reset device key for ${u.username}`}><KeyRound className="h-4 w-4" aria-hidden /></Button>
                          <Button variant="ghost" size="sm" onClick={() => actions.onToggle(u)} aria-label={`${u.status === 'active' ? 'Disable' : 'Enable'} ${u.username}`}>
                            {u.status === 'active' ? <Ban className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                          </Button>
                        </>
                      )}
                      <Button variant="danger" size="sm" onClick={() => actions.onDelete(u)} aria-label={`Delete ${u.username}`}><Trash2 className="h-4 w-4" aria-hidden /></Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
