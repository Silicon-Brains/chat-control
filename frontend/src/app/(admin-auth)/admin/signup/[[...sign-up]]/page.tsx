import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Admin sign up' };

export default function AdminSignupPage() {
  redirect('/admin/login');
}
