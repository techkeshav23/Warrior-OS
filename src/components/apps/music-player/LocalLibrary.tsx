// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Music Player :: My Library
// Plays the warrior's own audio files. Files are added with the
// picker or by dropping them in, and are kept on this device in
// IndexedDB (nothing is uploaded). If the browser can't store them
// they stay for this session only — the UI says which. Playback is
// wired into the Web Audio analyser so the visualizer, the audio-
// reactive wallpaper and the Dynamic Island follow the music.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { AudioLines, HardDrive, Info, ListMusic, Music2, Pause, Play, SkipBack, SkipForward, Trash2, TriangleAlert, Upload, Volume1, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, EmptyState, IconButton, ListRow, Skeleton, Slider } from '@/components/ui';
import { BEVEL_PRESSED, BEVEL_SUNK, EMBER_PLATE, ENGRAVED_LABEL, FOCUS_EDGE, SLOT_FILL } from '@/components/ui/armor';
import { useAudioStore } from '@/stores/useAudioStore';
import { connectMediaElement, getFrequencyBands } from '@/lib/audio-engine';
import { isMusicPlaying, isProceduralTrack, stopMusic } from '@/lib/procedural-music/engine';
import { AudioVisualizer } from './AudioVisualizer';
import {
  addLibraryFiles,
  getLibraryBlob,
  isAudioFile,
  listLibraryTracks,
  removeLibraryTrack,
  MAX_TRACK_BYTES,
  type LibraryTrack,
} from './music-library-db';

type LibraryStatus = 'loading' | 'ready' | 'session';

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Timestamp for session-only track ids (only ever called from event handlers). */
function sessionStamp(): number {
  return Date.now();
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function LocalLibrary() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const sessionBlobsRef = useRef(new Map<string, Blob>());

  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const volume = useAudioStore((s) => s.volume);
  const setVolume = useAudioStore((s) => s.setVolume);

  const currentIndex = tracks.findIndex((t) => t.id === currentId);
  const current = currentIndex >= 0 ? tracks[currentIndex] : null;

  // Load the saved library.
  useEffect(() => {
    let cancelled = false;
    listLibraryTracks()
      .then((list) => {
        if (cancelled) return;
        setTracks(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('session');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Volume → element.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Feed levels to the OS (Dynamic Island / audio-reactive visuals) while playing.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 50) {
        last = t;
        const { bass, mids, highs } = getFrequencyBands();
        useAudioStore.getState().setFrequencyData(bass, mids, highs);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // If procedural music takes over, pause the file.
  useEffect(() => {
    return useAudioStore.subscribe((s, prev) => {
      if (s.currentTrack !== prev.currentTrack && isProceduralTrack(s.currentTrack)) {
        audioRef.current?.pause();
      }
    });
  }, []);

  // Unmount: stop, release the object URL and our "now playing".
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      const url = objectUrlRef.current;
      objectUrlRef.current = null;
      if (url) {
        const a = useAudioStore.getState();
        if (a.currentTrack === url) a.clearTrack();
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const releaseCurrentUrl = () => {
    const url = objectUrlRef.current;
    objectUrlRef.current = null;
    if (!url) return;
    const a = useAudioStore.getState();
    if (a.currentTrack === url) a.clearTrack();
    URL.revokeObjectURL(url);
  };

  const playTrack = async (id: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    setNotice(null);
    let blob: Blob | null = sessionBlobsRef.current.get(id) ?? null;
    if (!blob && status === 'ready') {
      try {
        blob = await getLibraryBlob(id);
      } catch {
        blob = null;
      }
    }
    if (!blob) {
      setNotice('That file is no longer in your library.');
      return;
    }
    const url = URL.createObjectURL(blob);
    releaseCurrentUrl();
    objectUrlRef.current = url;
    audio.src = url;
    setCurrentId(id);
    setProgress(0);
    try {
      connectMediaElement(audio); // analyser for visuals (no-op if already wired)
    } catch {
      /* Web Audio unavailable — plain playback still works */
    }
    try {
      await audio.play();
    } catch {
      setNotice('The browser blocked playback — press play again.');
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!current) {
      if (tracks[0]) void playTrack(tracks[0].id);
      return;
    }
    if (audio.paused) {
      void audio.play().catch(() => setNotice('The browser blocked playback — press play again.'));
    } else {
      audio.pause();
    }
  };

  const step = (dir: 1 | -1) => {
    if (tracks.length === 0) return;
    const base = currentIndex < 0 ? 0 : currentIndex;
    const next = (base + dir + tracks.length) % tracks.length;
    void playTrack(tracks[next].id);
  };

  const addSessionFiles = (files: File[]) => {
    const now = sessionStamp();
    const added = files.map((file, i) => {
      const id = `session-${now}-${i}`;
      sessionBlobsRef.current.set(id, file);
      return {
        id,
        name: file.name.replace(/\.[^.]+$/, ''),
        type: file.type || 'audio/mpeg',
        size: file.size,
        addedAt: now + i,
      };
    });
    setTracks((t) => [...t, ...added]);
  };

  const addFiles = async (list: FileList | File[]) => {
    setNotice(null);
    const files = Array.from(list).filter(isAudioFile);
    if (files.length === 0) {
      setNotice('Those files are not audio.');
      return;
    }
    const fitting = files.filter((f) => f.size <= MAX_TRACK_BYTES);
    if (fitting.length < files.length) setNotice('Files over 200 MB were skipped.');
    if (status !== 'ready') {
      addSessionFiles(fitting);
      return;
    }
    try {
      const added = await addLibraryFiles(fitting);
      setTracks((t) => [...t, ...added]);
    } catch {
      setStatus('session');
      addSessionFiles(fitting);
      setNotice('Could not save to this device (storage full?) — kept for this session.');
    }
  };

  const removeTrack = async (id: string) => {
    if (id === currentId) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      releaseCurrentUrl();
      setCurrentId(null);
      setPlaying(false);
      setProgress(0);
      setDuration(0);
    }
    const wasSession = sessionBlobsRef.current.delete(id);
    if (!wasSession && status === 'ready') {
      try {
        await removeLibraryTrack(id);
      } catch {
        setNotice('Could not delete that file.');
        return;
      }
    }
    setTracks((t) => t.filter((x) => x.id !== id));
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) void addFiles(e.dataTransfer.files);
  };

  const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
  const VolumeIcon = volume <= 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const footerNote =
    notice ??
    (status === 'session'
      ? 'This browser can’t store files. They stay until you close this window.'
      : 'Stored on this device only. Nothing is uploaded.');

  return (
    <div
      className="relative flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          if (isMusicPlaying()) stopMusic();
          const url = objectUrlRef.current;
          if (url && current) useAudioStore.getState().setTrack(url, current.name);
        }}
        onPause={() => {
          setPlaying(false);
          const a = useAudioStore.getState();
          if (a.currentTrack && a.currentTrack === objectUrlRef.current) a.setPlaying(false);
        }}
        onEnded={() => (tracks.length > 1 ? step(1) : setPlaying(false))}
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      {/* ── Now playing + transport ── */}
      <section aria-label="Now playing" className="brushed relative shrink-0 bg-steel-850 px-4 pb-3 pt-4 shadow-[inset_0_-1px_0_rgb(0_0_0/0.75),0_1px_0_rgb(255_255_255/0.05)]">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'armor-plate flex size-11 shrink-0 items-center justify-center [--cut:8px]',
              playing ? 'ember-edge text-accent' : 'text-fg-subtle'
            )}
          >
            {playing ? <AudioLines size={20} strokeWidth={1.75} aria-hidden /> : <Music2 size={20} strokeWidth={1.75} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <div className={ENGRAVED_LABEL}>{playing ? 'Now playing' : current ? 'Paused' : 'Nothing playing'}</div>
            <p className="truncate text-sm font-semibold text-fg" title={current?.name}>
              {current?.name ?? 'Pick a track below'}
            </p>
            <p className="tabular truncate font-mono text-2xs text-fg-subtle">
              {current ? formatSize(current.size) : `${tracks.length} track${tracks.length === 1 ? '' : 's'} in your library`}
            </p>
          </div>
        </div>

        <div className={cn('chamfer-sm relative mt-3 h-14 overflow-hidden', SLOT_FILL, BEVEL_SUNK)}>
          <AudioVisualizer active={playing} source="element" />
        </div>

        {/* Seek */}
        <div className="mt-3">
          <div
            className={cn(
              'group relative h-4 w-full cursor-pointer',
              duration <= 0 && 'pointer-events-none opacity-45'
            )}
            onClick={(e) => {
              const audio = audioRef.current;
              if (!audio || duration <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
            }}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(progress)}
            aria-valuetext={`${formatTime(progress)} of ${formatTime(duration)}`}
          >
            <div className={cn('absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 transition-[height] duration-120 group-hover:h-2', SLOT_FILL, BEVEL_SUNK)}>
              <div className="forge-heat h-full" style={{ width: `${pct}%` }} />
            </div>
            <div
              aria-hidden
              className="absolute top-1/2 h-3.5 w-2 -translate-x-1/2 -translate-y-1/2 bg-linear-to-b from-steel-200 to-steel-400 opacity-0 shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(0_0_0/0.6)] transition-opacity duration-120 group-hover:opacity-100"
              style={{ left: `${pct}%` }}
            />
          </div>
          <div className="tabular mt-0.5 flex justify-between font-mono text-2xs text-fg-subtle">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <IconButton icon={SkipBack} aria-label="Previous track" tooltip onClick={() => step(-1)} disabled={tracks.length === 0} />
          <button
            type="button"
            onClick={togglePlay}
            disabled={tracks.length === 0}
            aria-label={playing ? 'Pause' : 'Play'}
            className={cn(
              'chamfer flex size-11 shrink-0 items-center justify-center [--cut:11px]',
              'transition-[filter,box-shadow,transform] duration-120 ease-out-quint active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
              FOCUS_EDGE,
              EMBER_PLATE,
              'hover:brightness-115 hover:saturate-125 active:brightness-95',
              BEVEL_PRESSED
            )}
          >
            {playing ? (
              <Pause size={18} strokeWidth={2} className="fill-current" aria-hidden />
            ) : (
              <Play size={18} strokeWidth={2} className="ml-0.5 fill-current" aria-hidden />
            )}
          </button>
          <IconButton icon={SkipForward} aria-label="Next track" tooltip onClick={() => step(1)} disabled={tracks.length === 0} />
          <div className="ml-auto flex min-w-0 max-w-36 flex-1 items-center gap-2">
            <IconButton
              icon={VolumeIcon}
              size="sm"
              aria-label={volume > 0 ? 'Mute' : 'Unmute'}
              onClick={() => setVolume(volume > 0 ? 0 : 0.7)}
            />
            <Slider
              value={volume}
              onValueChange={setVolume}
              min={0}
              max={1}
              step={0.01}
              aria-label="Volume"
              aria-valuetext={`${Math.round(volume * 100)}%`}
            />
          </div>
        </div>
      </section>

      {/* ── Track list ── */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {status === 'loading' ? (
          <div className="flex flex-col gap-3 px-3 py-2" aria-label="Opening your library" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton shape="block" className="size-6 shrink-0" />
                <Skeleton lines={2} className="flex-1" />
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <EmptyState
            className="h-full"
            size="sm"
            icon={ListMusic}
            title="Add your music"
            description="Drop audio files here or choose them. MP3, M4A, OGG, WAV, FLAC and more."
            actions={
              <Button variant="primary" size="sm" leadingIcon={Upload} onClick={() => fileInputRef.current?.click()}>
                Choose files
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-0.5" role="list" aria-label="Library">
            {tracks.map((track, idx) => {
              const isCurrent = track.id === currentId;
              return (
                <div key={track.id} role="listitem">
                  <ListRow
                    selected={isCurrent}
                    onClick={() => void playTrack(track.id)}
                    leading={
                      <span className="tabular flex w-5 justify-center font-mono text-2xs">
                        {isCurrent && playing ? (
                          <AudioLines size={14} strokeWidth={1.75} className="text-accent" aria-label="Playing" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                    }
                    title={<span title={track.name}>{track.name}</span>}
                    meta={formatSize(track.size)}
                    revealTrailing
                    trailing={
                      <IconButton
                        icon={Trash2}
                        size="xs"
                        variant="ghost-danger"
                        aria-label={`Remove ${track.name} from library`}
                        onClick={() => void removeTrack(track.id)}
                      />
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="brushed flex min-h-11 shrink-0 items-center justify-between gap-2 bg-steel-850 px-4 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_-1px_0_rgb(0_0_0/0.7)]">
        <span
          className={cn('flex min-w-0 items-center gap-1.5 text-xs', notice ? 'text-warning' : 'text-fg-subtle')}
          role={notice ? 'status' : undefined}
        >
          {notice ? (
            <TriangleAlert size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
          ) : status === 'session' ? (
            <Info size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
          ) : (
            <HardDrive size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
          )}
          <span className="truncate" title={footerNote}>
            {footerNote}
          </span>
        </span>
        {tracks.length > 0 && (
          <Button size="sm" variant="secondary" leadingIcon={Upload} onClick={() => fileInputRef.current?.click()}>
            Add files
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Drop target */}
      {dragOver && (
        <div className="chamfer-lg pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 bg-steel-950/85 text-center outline-2 -outline-offset-[10px] outline-dashed outline-ember-500/60 animate-fade-in">
          <Upload size={22} strokeWidth={1.75} className="text-accent" aria-hidden />
          <span className="text-sm font-medium text-fg">Drop to add to your library</span>
          <span className="text-xs text-fg-subtle">Audio files only · up to 200 MB each</span>
        </div>
      )}
    </div>
  );
}
