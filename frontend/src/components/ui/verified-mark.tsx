import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VerifiedMark({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Verified Management Team member" title="Verified Management Team member">
      <BadgeCheck className={cn('inline h-4 w-4 shrink-0 fill-sky-500 text-white', className)} aria-hidden />
    </span>
  );
}
