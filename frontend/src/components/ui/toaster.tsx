'use client';
import { cn } from '@/lib/utils';
import { useToasts } from '@/stores/toast';

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'glass w-full max-w-lg pointer-events-auto animate-fade-up !rounded-tile whitespace-normal break-words px-4 py-3 text-left text-sm font-medium text-ink-900',
            t.tone === 'error' && 'border-danger/50 text-[#B8434D]',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
