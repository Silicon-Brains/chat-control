import { Lock } from 'lucide-react';

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-lg font-bold text-ink-900">
      <span className="grid h-9 w-9 place-items-center rounded-icon bg-primary-gradient text-white shadow-glass">
        <Lock className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </span>
      <span className="hidden lg:inline">VaultChat</span>
    </span>
  );
}
