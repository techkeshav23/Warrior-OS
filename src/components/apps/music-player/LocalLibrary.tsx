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
import { Upload, Play, Pause, SkipBack, SkipForward, Trash2, Music2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    const now = Date.now();
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

  return (
    <div
      className={cn('relative flex h-full flex-col', dragOver && 'ring-2 ring-inset ring-cyan-400/50')}
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

      {/* Visualizer + now playing */}
      <div className="relative h-24 shrink-0 overflow-hidden bg-black/50">
        <AudioVisualizer active={playing} source="element" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="max-w-[260px] truncate text-sm font-semibold text-text-primary">
              {current?.name ?? 'Nothing playing'}
            </p>
            <p className="text-[10px] text-text-muted">{current ? formatSize(current.size) : 'Your own audio files'}</p>
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="shrink-0 border-b border-white/5 px-3 py-2">
        <div
          className="group mb-1.5 h-1 w-full cursor-pointer rounded-full bg-white/10"
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
        >
          <div
            className="h-full rounded-full bg-accent-primary"
            style={{ width: duration > 0 ? `${Math.min(100, (progress / duration) * 100)}%` : '0%' }}
          />
        </div>
        <div className="mb-1 flex justify-between font-mono text-[10px] text-text-muted">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={tracks.length === 0}
            className="rounded p-1 text-text-secondary hover:text-text-primary disabled:opacity-30"
            aria-label="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={tracks.length === 0}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-primary/40 bg-accent-primary/15 text-accent-primary hover:bg-accent-primary/25 disabled:opacity-30"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={tracks.length === 0}
            className="rounded p-1 text-text-secondary hover:text-text-primary disabled:opacity-30"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </button>
          <label className="ml-auto flex items-center gap-2 text-xs text-text-secondary">
            <Volume2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 accent-cyan-400"
            />
          </label>
        </div>
      </div>

      {/* Track list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === 'loading' ? (
          <p className="px-3 py-6 text-center text-xs text-text-muted">Opening your library…</p>
        ) : tracks.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="m-3 flex w-[calc(100%-1.5rem)] flex-col items-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-8 text-center hover:bg-white/5"
          >
            <Music2 className="h-6 w-6 text-text-muted" aria-hidden />
            <span className="text-sm text-text-primary">Add your music</span>
            <span className="text-xs text-text-muted">Drop audio files here or click to choose (MP3, M4A, OGG, WAV, FLAC…)</span>
          </button>
        ) : (
          tracks.map((track, idx) => (
            <div
              key={track.id}
              className={cn(
                'group flex items-center gap-2 border-b border-white/[0.03] px-3 py-2 hover:bg-white/5',
                track.id === currentId && 'bg-accent-primary/5'
              )}
            >
              <button
                type="button"
                onClick={() => void playTrack(track.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="w-5 font-mono text-[10px] text-text-muted">
                  {track.id === currentId && playing ? '▶' : idx + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-text-primary">{track.name}</span>
                  <span className="block text-[10px] text-text-muted">{formatSize(track.size)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void removeTrack(track.id)}
                className="rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-accent-danger group-hover:opacity-100 focus:opacity-100"
                aria-label={`Remove ${track.name} from library`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/5 px-3 py-2">
        <span className="truncate text-[10px] text-text-muted">
          {notice ??
            (status === 'session'
              ? 'This browser can’t store files — they’re kept until you close this window.'
              : 'Stored on this device only. Nothing is uploaded.')}
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-text-primary hover:bg-white/10"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          Add files
        </button>
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
    </div>
  );
}
