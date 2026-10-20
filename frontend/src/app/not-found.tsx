import Link from 'next/link';
import { GlassCard } from '@/components/ui/glass-card';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <GlassCard className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2">That page doesn’t exist or you don’t have access to it.</p>
        <Link href="/" className="mt-6 inline-block font-medium text-primary-600 underline">Back to home</Link>
      </GlassCard>
    </main>
  );
}
