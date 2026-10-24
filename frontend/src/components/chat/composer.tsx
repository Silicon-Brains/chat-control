'use client';
import { Loader2, Mic, SendHorizonal, Smile, Square, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MAX_TEXT_PLAINTEXT_BYTES, MAX_VOICE_AUDIO_BYTES, MAX_VOICE_DURATION_SECONDS } from '@/lib/constants';
import { plaintextBytes } from '@/lib/crypto';
import { toast } from '@/stores/toast';
import { VoiceMessagePlayer } from './voice-message-player';

interface VoiceDraft {
  blob: Blob;
  durationMs: number;
}

const EMOJI_GROUPS = [
  { label: 'Smileys', items: ['😀', '😄', '😊', '😂', '🥹', '😍', '🥰', '😎', '🤔', '🙃', '😴', '😭'] },
  { label: 'Gestures', items: ['👋', '👍', '👎', '👏', '🙌', '🙏', '🤝', '💪', '✌️', '🫶', '👌', '🤗'] },
  { label: 'Hearts', items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💖', '💯'] },
  { label: 'More', items: ['🎉', '✨', '🔥', '⭐', '☀️', '🌈', '☕', '🍕', '🍰', '🐱', '🐶', '🚀'] },
];

export function Composer({
  onSend,
  onSendVoice,
  disabled,
  readOnlyReason,
}: {
  onSend: (text: string) => Promise<boolean | void>;
  onSendVoice: (blob: Blob, durationMs: number) => Promise<boolean | void>;
  disabled?: boolean;
  readOnlyReason?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [requestingMicrophone, setRequestingMicrophone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const bytes = plaintextBytes(text);
  const tooLong = bytes > MAX_TEXT_PLAINTEXT_BYTES;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (clockRef.current) clearInterval(clockRef.current);
      if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!emojiOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEmojiOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!emojiPickerRef.current?.contains(event.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [emojiOpen]);

  if (readOnlyReason) {
    return <p className="border-t border-black/5 px-6 py-4 text-center text-sm">{readOnlyReason}</p>;
  }

  async function submit() {
    const value = text.trim();
    if (!value || tooLong || busy || disabled || recording || draft) return;
    setBusy(true);
    try {
      const sent = await onSend(value);
      if (sent !== false) setText('');
    } finally {
      setBusy(false);
    }
  }

  function insertEmoji(emoji: string) {
    const input = textareaRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  function stopRecording(discard = false) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    discardRef.current = discard;
    recorder.stop();
  }

  async function startRecording() {
    if (recording || requestingMicrophone || busy || disabled || text.trim()) return;
    if (!window.isSecureContext) {
      toast.error('Microphone access requires a secure HTTPS connection (localhost is allowed).');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice messages are not supported by this browser.');
      return;
    }
    try {
      setRequestingMicrophone(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 },
      );
      chunksRef.current = [];
      discardRef.current = false;
      startedAtRef.current = performance.now();
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        discardRef.current = true;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (clockRef.current) clearInterval(clockRef.current);
        if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
        clockRef.current = null;
        maxDurationRef.current = null;
        setRecording(false);
        chunksRef.current = [];
        toast.error('The voice recording stopped unexpectedly.');
      };
      recorder.onstop = () => {
        if (clockRef.current) clearInterval(clockRef.current);
        if (maxDurationRef.current) clearTimeout(maxDurationRef.current);
        clockRef.current = null;
        maxDurationRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        if (discardRef.current) {
          chunksRef.current = [];
          setElapsedMs(0);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        const durationMs = Math.min(performance.now() - startedAtRef.current, MAX_VOICE_DURATION_SECONDS * 1000);
        if (durationMs < 500 || blob.size === 0) {
          toast.error('Record a little longer before sending.');
          return;
        }
        if (blob.size > MAX_VOICE_AUDIO_BYTES) {
          toast.error('This recording is too large. Try a shorter voice message.');
          setElapsedMs(0);
          return;
        }
        setDraft({ blob, durationMs });
        setElapsedMs(durationMs);
      };
      recorder.start(250);
      setRecording(true);
      setElapsedMs(0);
      clockRef.current = setInterval(
        () => setElapsedMs(Math.min(performance.now() - startedAtRef.current, MAX_VOICE_DURATION_SECONDS * 1000)),
        200,
      );
      maxDurationRef.current = setTimeout(
        () => stopRecording(),
        MAX_VOICE_DURATION_SECONDS * 1000,
      );
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const name = error instanceof Error ? error.name : '';
      const message = name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
        : name === 'NotFoundError'
          ? 'No microphone was found. Connect or enable a microphone, then try again.'
          : name === 'NotReadableError'
            ? 'Your microphone is unavailable. Close other apps using it, then try again.'
            : 'Couldn’t start microphone recording. Check your browser and microphone settings, then try again.';
      toast.error(message);
    } finally {
      if (mountedRef.current) setRequestingMicrophone(false);
    }
  }

  async function sendVoice() {
    if (!draft || busy || disabled) return;
    setBusy(true);
    try {
      const sent = await onSendVoice(draft.blob, draft.durationMs);
      if (sent !== false) {
        setDraft(null);
        setElapsedMs(0);
      }
    } finally {
      setBusy(false);
    }
  }

  const elapsedLabel = `${Math.floor(elapsedMs / 60_000)}:${String(Math.floor(elapsedMs / 1000) % 60).padStart(2, '0')}`;

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); void submit(); }}
      className="flex items-end gap-2 border-t border-black/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {draft ? (
        <>
          <div className="min-w-0 flex-1">
            <VoiceMessagePlayer audioBlob={draft.blob} durationMs={draft.durationMs} />
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Discard voice message" disabled={busy} onClick={() => { setDraft(null); setElapsedMs(0); }}>
            <Trash2 className="h-5 w-5" aria-hidden />
          </Button>
          <Button type="button" size="icon" aria-label="Send voice message" loading={busy} disabled={disabled} onClick={() => void sendVoice()}>
            <SendHorizonal className="h-5 w-5" aria-hidden />
          </Button>
        </>
      ) : recording ? (
        <>
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-field border border-danger/20 bg-danger/5 px-4">
            <span className="relative h-2.5 w-2.5 shrink-0 rounded-full bg-danger">
              <span className="absolute inset-0 animate-ping rounded-full bg-danger/50 motion-reduce:animate-none" />
            </span>
            <span className="text-sm font-medium text-ink-900">Recording · {MAX_VOICE_DURATION_SECONDS}s max</span>
            <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-ink-600" aria-live="off">{elapsedLabel}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Discard recording" onClick={() => stopRecording(true)}>
            <Trash2 className="h-5 w-5" aria-hidden />
          </Button>
          <Button type="button" size="icon" aria-label="Stop recording" onClick={() => stopRecording()}>
            <Square className="h-4 w-4" fill="currentColor" aria-hidden />
          </Button>
        </>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <label htmlFor="composer" className="sr-only">Message</label>
            <textarea
              ref={textareaRef}
              id="composer"
              rows={1}
              value={text}
              disabled={disabled || busy}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="Write a message…"
              className="max-h-40 min-h-11 w-full resize-none rounded-field border border-white/70 bg-white/60 px-4 py-2.5 text-ink-900 placeholder:text-ink-400 focus:border-primary-500"
            />
            {tooLong && <p role="alert" className="mt-1 text-xs text-danger">Message is too long ({bytes} / {MAX_TEXT_PLAINTEXT_BYTES} bytes).</p>}
          </div>
          <div ref={emojiPickerRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
              aria-haspopup="dialog"
              title="Insert emoji"
              disabled={disabled || busy}
              onClick={() => setEmojiOpen((open) => !open)}
            >
              <Smile className="h-5 w-5" aria-hidden />
            </Button>
            {emojiOpen && (
              <div role="dialog" aria-label="Choose an emoji" className="glass absolute bottom-full right-0 z-30 mb-2 w-72 rounded-tile p-3 shadow-lift">
                <div role="tablist" aria-label="Emoji categories" className="mb-2 flex gap-1">
                  {EMOJI_GROUPS.map((group, index) => (
                    <button
                      key={group.label}
                      type="button"
                      role="tab"
                      aria-selected={emojiGroup === index}
                      onClick={() => setEmojiGroup(index)}
                      className="flex-1 rounded-full px-2 py-1 text-xs text-ink-600 aria-selected:bg-primary-500/15 aria-selected:text-primary-600"
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-6 gap-1" role="grid" aria-label={EMOJI_GROUPS[emojiGroup]!.label}>
                  {EMOJI_GROUPS[emojiGroup]!.items.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="grid h-10 w-10 place-items-center rounded-icon text-xl hover:bg-primary-500/10 focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={requestingMicrophone ? 'Requesting microphone access' : 'Record voice message (your browser may ask for microphone access)'} title={requestingMicrophone ? 'Requesting microphone access' : 'Record a voice message'} disabled={disabled || busy || requestingMicrophone || Boolean(text.trim())} onClick={() => void startRecording()}>
            {requestingMicrophone ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
          </Button>
          <Button type="submit" size="icon" aria-label="Send message" loading={busy} disabled={!text.trim() || tooLong || disabled}>
            <SendHorizonal className="h-5 w-5" aria-hidden />
          </Button>
        </>
      )}
    </form>
  );
}
