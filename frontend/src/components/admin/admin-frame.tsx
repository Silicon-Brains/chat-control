'use client';
import { AppShell } from '@/components/layout/app-shell';
import { adminNav } from '@/components/layout/nav-config';
import { AdminGate } from './admin-gate';

export function AdminFrame({ children }: { children: React.ReactNode }) {
  return (
    <AdminGate>
      <AppShell nav={adminNav}>{children}</AppShell>
    </AdminGate>
  );
}
