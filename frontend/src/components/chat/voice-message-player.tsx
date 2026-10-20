'use client';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const WAVEFORM = [
  8, 13, 10, 18, 23, 12, 27, 16, 32, 21, 14, 28, 37, 18, 25, 34, 20, 13, 29, 38, 22, 31, 16, 25,
  12, 20, 32, 18, 10, 24, 15, 8,
];

function formatAudioTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function VoiceMessagePlayer({ audioBlob, durationMs }: { audioBlob: Blob; durationMs: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationMs / 1000);
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    const url = URL.createObjectURL(audioBlob);
    setSrc(url);
    return () => {
      audio?.pause();
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaybackError(false);
      } catch {
        setPlaying(false);
        setPlaybackError(true);
      }
    } else {
      audio.pause();
    }
  }

  const progress = actualDuration > 0 ? Math.min(currentTime / actualDuration, 1) : 0;
  const elapsedLabel = playing || currentTime > 0 ? formatAudioTime(currentTime) : formatAudioTime(actualDuration);

  return (
    <div className="flex w-full min-w-0 max-w-[22rem] items-center gap-3 rounded-full border border-white/20 bg-black/10 px-3 py-2.5 sm:gap-4 sm:px-4">
      <audio
        ref={audioRef}
        src={src ?? undefined}
        preload="metadata"
        className="sr-only"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const duration = event.currentTarget.duration;
          if (Number.isFinite(duration) && duration > 0) setActualDuration(duration);
        }}
      />
      <button
        type="button"
        onClick={() => void togglePlayback()}
        disabled={!src}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-current transition hover:bg-white/30 disabled:opacity-50"
      >
        {playing ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden />}
      </button>
      <div
        className="flex min-w-0 flex-1 items-center justify-between gap-[2px]"
        role="img"
        aria-label={`Audio waveform, ${formatAudioTime(actualDuration)} total`}
      >
        {WAVEFORM.map((height, index) => (
          <span
            key={index}
            className={cn(
              'w-[3px] shrink-0 rounded-full transition-colors duration-150 sm:w-1',
              index / WAVEFORM.length < progress ? 'bg-current' : 'bg-current/35',
              playing && 'motion-safe:animate-pulse',
            )}
            style={{ height }}
            aria-hidden
          />
        ))}
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums" aria-live="off">
        {elapsedLabel}
      </span>
      {playbackError && <span className="sr-only" role="status">Unable to play this voice message.</span>}
    </div>
  );
}
