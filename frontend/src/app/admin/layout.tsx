import { AdminFrame } from '@/components/admin/admin-frame';
import { ClerkShell } from '@/components/auth/clerk-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkShell>
      <AdminFrame>{children}</AdminFrame>
    </ClerkShell>
  );
}
