'use client';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CODE_REVEAL_SECONDS } from '@/lib/constants';

/** Shows a one-time login code, copies it, then hides it automatically. Never persisted. */
export function CodeRevealDialog({ code, username, onClose }: { code: string | null; username: string; onClose: () => void }) {
  const [left, setLeft] = useState(CODE_REVEAL_SECONDS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLeft(CODE_REVEAL_SECONDS);
    setCopied(false);
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [code]);

  useEffect(() => { if (code && left <= 0) onClose(); }, [left, code, onClose]);

  return (
    <Modal open={code !== null} onClose={onClose} title={`Login code for @${username}`}>
      <div className="flex gap-2 rounded-tile bg-warning/15 p-3 text-sm text-[#8A5416]">
        <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
        <p>This code is shown once and can’t be retrieved later. Share it with the user over a secure channel.</p>
      </div>
      <p className="my-5 select-all text-center font-mono text-3xl font-semibold tracking-[0.2em] text-ink-900">{code}</p>
      <div className="flex items-center justify-between">
        <p className="text-sm" aria-live="off">Hides in {Math.max(left, 0)}s</p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => { if (code) { await navigator.clipboard.writeText(code); setCopied(true); } }}
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}
