import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-500/10 text-primary-500">
        <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="font-semibold text-ink-900">{title}</p>
      {children}
    </div>
  );
}
