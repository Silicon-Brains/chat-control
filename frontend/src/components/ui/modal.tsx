'use client';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

/** Native <dialog>: focus trap, Esc to close and inert background come for free. */
export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="glass !rounded-modal w-[min(32rem,calc(100vw-2rem))] p-0 backdrop:bg-ink-900/35 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-primary-500/10">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
