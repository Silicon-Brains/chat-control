import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Admin sign up' };

export default function AdminSignupPage() {
  if (env.mock) redirect('/admin/login');
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <SignUp path="/admin/signup" routing="path" signInUrl="/admin/login" fallbackRedirectUrl="/admin" />
    </main>
  );
}
