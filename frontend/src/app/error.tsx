'use client';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <GlassCard className="max-w-md text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2">The page failed to load. Your messages are safe — try again.</p>
        <Button className="mt-6" onClick={reset}>Reload page</Button>
      </GlassCard>
    </main>
  );
}
