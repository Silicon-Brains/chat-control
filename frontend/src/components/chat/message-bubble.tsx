import { AlertCircle, Check, Clock, LockKeyhole, Pencil, Trash2, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { cn, formatTime } from '@/lib/utils';
import { VerifiedMark } from '@/components/ui/verified-mark';
import { MAX_TEXT_PLAINTEXT_BYTES } from '@/lib/constants';
import { plaintextBytes } from '@/lib/crypto';
import { isVoiceMessage, parseVoiceMessage, voicePayloadToBlob } from '@/lib/chat/voice';
import type { ChatMessage } from '@/types';
import { ExpiryChip } from './expiry-chip';
import { VoiceMessagePlayer } from './voice-message-player';

export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  senderName,
  senderVerified = false,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  mine: boolean;
  senderName?: string;
  senderVerified?: boolean;
  onEdit: (text: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(message.text ?? '');
  const broken = message.status === 'undecryptable';
  const voicePayload = useMemo(() => parseVoiceMessage(message.text), [message.text]);
  const voiceBlob = useMemo(
    () => (voicePayload ? voicePayloadToBlob(voicePayload) : null),
    [voicePayload],
  );
  const malformedVoice = !broken && !voicePayload && isVoiceMessage(message.text);
  const canMutate = mine && message.status === 'ok' && !voicePayload && !malformedVoice;
  const editTooLong = plaintextBytes(draft) > MAX_TEXT_PLAINTEXT_BYTES;

  async function saveEdit() {
    const next = draft.trim();
    if (!next || next === message.text || editTooLong || busy) return;
    setBusy(true);
    try {
      if (await onEdit(next)) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function confirmAndDelete() {
    if (busy) return;
    setBusy(true);
    try {
      if (await onDelete()) setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className={cn('flex animate-fade-up', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[min(34rem,85%)]', mine && 'text-right')}>
        {!mine && senderName && (
          <p className="mb-1 flex items-center gap-1 px-2 text-xs font-medium text-ink-600">
            {senderName}{senderVerified && <VerifiedMark />}
          </p>
        )}
        <div
          className={cn(
            'rounded-bubble text-left text-[15px] leading-6',
            voicePayload ? 'p-2' : 'px-4 py-2.5',
            mine && message.status !== 'deleted' ? 'rounded-br-md bg-primary-gradient text-white' : 'glass !rounded-bubble rounded-bl-md text-ink-900',
            message.status === 'failed' && 'ring-2 ring-danger',
          )}
        >
          {message.status === 'deleted' ? (
            <span className="italic opacity-75">Message deleted</span>
          ) : broken ? (
            <span className="inline-flex items-center gap-2 italic opacity-80">
              <LockKeyhole className="h-4 w-4" aria-hidden />Can’t decrypt on this device
            </span>
          ) : voicePayload && voiceBlob ? (
            <VoiceMessagePlayer audioBlob={voiceBlob} durationMs={voicePayload.durationMs} />
          ) : malformedVoice ? (
            <span className="inline-flex items-center gap-2 italic opacity-80">
              <LockKeyhole className="h-4 w-4" aria-hidden />Can’t play this voice message
            </span>
          ) : editing ? (
            <div className="min-w-[min(18rem,70vw)]">
              <textarea
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="Edit message"
                className="min-h-20 w-full resize-y rounded-field border border-white/40 bg-white/15 px-3 py-2 text-current placeholder:text-current/60 focus:outline-none focus:ring-2 focus:ring-white/60"
              />
              {editTooLong && <p role="alert" className="mt-1 text-xs text-white">Message exceeds the text limit.</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setEditing(false); setDraft(message.text ?? ''); }} disabled={busy} className="rounded-full p-2 hover:bg-white/15" aria-label="Cancel edit" title="Cancel edit"><X className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => void saveEdit()} disabled={busy || !draft.trim() || draft.trim() === message.text || editTooLong} className="rounded-full p-2 hover:bg-white/15 disabled:opacity-50" aria-label="Save edited message" title="Save"><Check className="h-4 w-4" aria-hidden /></button>
              </div>
            </div>
          ) : (
            // React escapes text — never use dangerouslySetInnerHTML for messages.
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}
        </div>
        <div className={cn('mt-1 flex items-center gap-2 px-2 text-[11px] text-ink-400', mine && 'justify-end')}>
          {message.status === 'pending' && <Clock className="h-3 w-3" aria-label="Sending" />}
          {message.status === 'failed' && (
            <span className="inline-flex items-center gap-1 text-danger"><AlertCircle className="h-3 w-3" aria-hidden />Not sent</span>
          )}
          {new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime() && message.status === 'ok' && <span>Edited</span>}
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          <ExpiryChip expiresAt={message.expiresAt} />
          {canMutate && !editing && (
            confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <span>Delete?</span>
                <button type="button" onClick={() => void confirmAndDelete()} disabled={busy} className="font-semibold text-danger">Yes</button>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <button type="button" onClick={() => { setDraft(message.text ?? ''); setEditing(true); }} className="rounded p-1 hover:bg-primary-500/10" aria-label="Edit message" title="Edit message"><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                <button type="button" onClick={() => setConfirmDelete(true)} className="rounded p-1 hover:bg-danger/10" aria-label="Delete message" title="Delete message"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
              </span>
            )
          )}
        </div>
      </div>
    </li>
  );
});
