import { ClerkShell } from '@/components/auth/clerk-shell';

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <ClerkShell>{children}</ClerkShell>;
}
