'use client';
import { SendHorizonal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_PLAINTEXT_BYTES } from '@/lib/constants';
import { plaintextBytes } from '@/lib/crypto';

export function Composer({ onSend, disabled, readOnlyReason }: {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  readOnlyReason?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bytes = plaintextBytes(text);
  const tooLong = bytes > MAX_PLAINTEXT_BYTES;

  if (readOnlyReason) {
    return <p className="border-t border-black/5 px-6 py-4 text-center text-sm">{readOnlyReason}</p>;
  }

  async function submit() {
    const value = text.trim();
    if (!value || tooLong || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(value);
      setText('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className="flex items-end gap-2 border-t border-black/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex-1">
        <label htmlFor="composer" className="sr-only">Message</label>
        <textarea
          id="composer"
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
          }}
          placeholder="Write a message…"
          className="max-h-40 min-h-11 w-full resize-none rounded-field border border-white/70 bg-white/60 px-4 py-2.5 text-ink-900 placeholder:text-ink-400 focus:border-primary-500"
        />
        {tooLong && <p role="alert" className="mt-1 text-xs text-danger">Message is too long ({bytes} / {MAX_PLAINTEXT_BYTES} bytes).</p>}
      </div>
      <Button type="submit" size="icon" aria-label="Send message" loading={busy} disabled={!text.trim() || tooLong || disabled}>
        <SendHorizonal className="h-5 w-5" aria-hidden />
      </Button>
    </form>
  );
}
