'use client';
import { Loader2, Pause, Play } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationMs / 1000);
  const [playbackError, setPlaybackError] = useState(false);
  const playRequestRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    const url = URL.createObjectURL(audioBlob);
    if (audio) {
      audio.src = url;
      audio.load();
    }
    setSrc(url);
    setCurrentTime(0);
    setActualDuration(durationMs / 1000);
    setPlaybackError(false);
    setLoading(false);
    return () => {
      audio?.pause();
      if (audio) audio.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (audio.paused) {
      if (playRequestRef.current) return;
      playRequestRef.current = true;
      setLoading(true);
      try {
        await audio.play();
        setPlaybackError(false);
      } catch {
        setPlaying(false);
        setLoading(false);
        setPlaybackError(true);
      } finally {
        playRequestRef.current = false;
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
        preload="auto"
        className="sr-only"
        onPlay={() => { setPlaying(true); setLoading(false); }}
        onPlaying={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onPause={() => { setPlaying(false); setLoading(false); }}
        onEnded={() => { setPlaying(false); setLoading(false); setCurrentTime(0); }}
        onError={() => { setPlaying(false); setLoading(false); setPlaybackError(true); }}
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
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : playing ? <Pause className="h-4 w-4" fill="currentColor" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden />}
      </button>
      <div
        className="relative flex min-w-0 flex-1 items-center justify-between gap-[2px]"
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
        <input
          type="range"
          min={0}
          max={Math.max(actualDuration, 0.01)}
          step={0.05}
          value={Math.min(currentTime, actualDuration)}
          aria-label="Seek voice message"
          aria-valuetext={`${formatAudioTime(currentTime)} of ${formatAudioTime(actualDuration)}`}
          onChange={(event) => {
            const audio = audioRef.current;
            if (!audio) return;
            const time = Number(event.currentTarget.value);
            audio.currentTime = time;
            setCurrentTime(time);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <span className="w-[4.25rem] shrink-0 text-right text-xs font-medium tabular-nums" aria-live="off">
        {elapsedLabel} / {formatAudioTime(actualDuration)}
      </span>
      {playbackError && <span className="sr-only" role="status">Unable to play this voice message. The audio format may not be supported.</span>}
    </div>
  );
}
