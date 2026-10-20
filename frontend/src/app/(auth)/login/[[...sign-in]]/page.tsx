import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  if (env.mock) return <LoginForm mode="user" />;
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <SignIn path="/login" routing="path" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" />
    </main>
  );
}
