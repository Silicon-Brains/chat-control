import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Create account' };

export default function SignupPage() {
  if (env.mock) redirect('/login');
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <SignUp path="/signup" routing="path" signInUrl="/login" fallbackRedirectUrl="/dashboard" />
    </main>
  );
}
