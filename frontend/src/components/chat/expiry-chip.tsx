'use client';
import { Timer } from 'lucide-react';
import { EXPIRY_WARNING_MS } from '@/lib/constants';
import { useNow } from '@/hooks/use-now';
import { cn, formatCountdown } from '@/lib/utils';

export function ExpiryChip({ expiresAt, light }: { expiresAt: string; light?: boolean }) {
  const ms = new Date(expiresAt).getTime() - useNow();
  const soon = ms < EXPIRY_WARNING_MS;
  return (
    <span
      title="This message will be deleted automatically"
      className={cn('inline-flex items-center gap-1 text-[11px]', soon ? 'font-semibold text-warning' : light ? 'text-white/70' : 'text-ink-400')}
    >
      <Timer className="h-3 w-3" aria-hidden />
      {formatCountdown(ms)}
    </span>
  );
}
