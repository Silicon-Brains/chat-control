import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Admin sign in' };

export default function AdminLoginPage() {
  if (env.mock) return <LoginForm mode="admin" />; // dev-only fake backend
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <SignIn path="/admin/login" routing="path" signUpUrl="/admin/signup" fallbackRedirectUrl="/admin" />
    </main>
  );
}
