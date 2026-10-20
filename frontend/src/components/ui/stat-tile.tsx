import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from './glass-card';

const accents = {
  slate: 'from-[#5E9CA6] to-[#3E8C8F]',
  purple: 'from-[#A99BF0] to-[#8E7CE6]',
  pink: 'from-[#F68DBE] to-[#F06AA8]',
  orange: 'from-[#F8BC82] to-[#F4A55B]',
} as const;

export function StatTile({ icon: Icon, label, value, unit, accent = 'slate' }: {
  icon: LucideIcon; label: string; value: React.ReactNode; unit?: string; accent?: keyof typeof accents;
}) {
  return (
    <GlassCard className="flex items-center gap-4 p-5">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-icon bg-gradient-to-br text-white', accents[accent])}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{label}</p>
        <p className="text-[28px] font-semibold leading-[34px] text-ink-900">
          {value}
          {unit && <span className="ml-1 text-lg font-medium">{unit}</span>}
        </p>
      </div>
    </GlassCard>
  );
}
