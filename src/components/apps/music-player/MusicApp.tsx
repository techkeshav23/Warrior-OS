// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Music Player App (WarBeats)
// Embedded audio player with playlists, play/pause, progress, volume
// Connects to audio analyzer for audio-reactive wallpapers
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioStore } from '@/stores/useAudioStore';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { cn } from '@/lib/utils';
import { AudioVisualizer } from './AudioVisualizer';

// ─── Playlist Data ───
interface Track {
  id: string;
  title: string;
  artist: string;
  src: string; // URL or local path
  duration?: number;
}

interface Playlist {
  id: string;
  name: string;
  emoji: string;
  tracks: Track[];
}

// Free lo-fi / ambient tracks (placeholders — can be replaced with actual URLs)
const PLAYLISTS: Playlist[] = [
  {
    id: 'deep-focus',
    name: 'Deep Focus',
    emoji: '🧠',
    tracks: [
      { id: 'df1', title: 'Midnight Study', artist: 'WarBeats', src: '' },
      { id: 'df2', title: 'Binary Dreams', artist: 'WarBeats', src: '' },
      { id: 'df3', title: 'Algorithm Flow', artist: 'WarBeats', src: '' },
    ],
  },
  {
    id: 'chill-study',
    name: 'Chill Study',
    emoji: '📖',
    tracks: [
      { id: 'cs1', title: 'Coffee & Code', artist: 'WarBeats', src: '' },
      { id: 'cs2', title: 'Rain on Console', artist: 'WarBeats', src: '' },
      { id: 'cs3', title: 'Soft Keystrokes', artist: 'WarBeats', src: '' },
    ],
  },
  {
    id: 'high-energy',
    name: 'High Energy',
    emoji: '⚡',
    tracks: [
      { id: 'he1', title: 'Battle Rhythm', artist: 'WarBeats', src: '' },
      { id: 'he2', title: 'Sprint Mode', artist: 'WarBeats', src: '' },
      { id: 'he3', title: 'Overclock', artist: 'WarBeats', src: '' },
    ],
  },
  {
    id: 'late-night',
    name: 'Late Night',
    emoji: '🌙',
    tracks: [
      { id: 'ln1', title: 'Void Ambient', artist: 'WarBeats', src: '' },
      { id: 'ln2', title: 'Dark Matter', artist: 'WarBeats', src: '' },
      { id: 'ln3', title: 'Nebula Drift', artist: 'WarBeats', src: '' },
    ],
  },
];

function MusicAppInner() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activePlaylist, setActivePlaylist] = useState<Playlist>(PLAYLISTS[0]);
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showVisualizer, setShowVisualizer] = useState(true);
  const progressAnimRef = useRef<number>(0);

  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setPlaying = useAudioStore((s) => s.setPlaying);
  const setTrack = useAudioStore((s) => s.setTrack);
  const volume = useAudioStore((s) => s.volume);
  const setVolume = useAudioStore((s) => s.setVolume);
  const clearTrack = useAudioStore((s) => s.clearTrack);

  const activeTrack = activePlaylist.tracks[activeTrackIdx];

  // Connect to audio analyzer
  useAudioAnalyzer(audioRef.current);

  // Update progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      if (audio.duration) {
        setProgress(audio.currentTime);
        setDuration(audio.duration);
      }
      progressAnimRef.current = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      progressAnimRef.current = requestAnimationFrame(updateProgress);
    }

    return () => cancelAnimationFrame(progressAnimRef.current);
  }, [isPlaying]);

  // Volume sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setPlaying(false);
    } else {
      if (activeTrack.src) {
        audio.play().then(() => {
          setPlaying(true);
          setTrack(activeTrack.src, activeTrack.title);
        }).catch(() => {
          // Autoplay blocked
        });
      }
    }
  }, [isPlaying, setPlaying, setTrack, activeTrack]);

  const nextTrack = useCallback(() => {
    const nextIdx = (activeTrackIdx + 1) % activePlaylist.tracks.length;
    setActiveTrackIdx(nextIdx);
    const next = activePlaylist.tracks[nextIdx];
    if (audioRef.current && next.src) {
      audioRef.current.src = next.src;
      audioRef.current.play().then(() => {
        setPlaying(true);
        setTrack(next.src, next.title);
      }).catch(() => {});
    }
  }, [activeTrackIdx, activePlaylist, setPlaying, setTrack]);

  const prevTrack = useCallback(() => {
    const prevIdx = activeTrackIdx === 0 ? activePlaylist.tracks.length - 1 : activeTrackIdx - 1;
    setActiveTrackIdx(prevIdx);
    const prev = activePlaylist.tracks[prevIdx];
    if (audioRef.current && prev.src) {
      audioRef.current.src = prev.src;
      audioRef.current.play().then(() => {
        setPlaying(true);
        setTrack(prev.src, prev.title);
      }).catch(() => {});
    }
  }, [activeTrackIdx, activePlaylist, setPlaying, setTrack]);

  const selectPlaylist = useCallback((pl: Playlist) => {
    setActivePlaylist(pl);
    setActiveTrackIdx(0);
    clearTrack();
  }, [clearTrack]);

  const selectTrack = useCallback((idx: number) => {
    setActiveTrackIdx(idx);
    const track = activePlaylist.tracks[idx];
    if (audioRef.current && track.src) {
      audioRef.current.src = track.src;
      audioRef.current.play().then(() => {
        setPlaying(true);
        setTrack(track.src, track.title);
      }).catch(() => {});
    }
  }, [activePlaylist, setPlaying, setTrack]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (audioRef.current && duration > 0) {
      audioRef.current.currentTime = ratio * duration;
    }
  }, [duration]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-black/40 rounded-md overflow-hidden font-mono text-text-primary">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={nextTrack}
        preload="metadata"
      />

      {/* ─── Visualizer Area ─── */}
      <AnimatePresence>
        {showVisualizer && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 120 }}
            exit={{ height: 0 }}
            className="relative overflow-hidden bg-black/60"
          >
            <AudioVisualizer />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-sm text-accent-primary font-bold">
                  {activeTrack?.title ?? 'No Track'}
                </p>
                <p className="text-[10px] text-text-muted">
                  {activeTrack?.artist ?? ''}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Controls ─── */}
      <div className="px-3 py-2 border-b border-white/5">
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-white/10 rounded-full cursor-pointer mb-2 group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-accent-primary rounded-full relative transition-all"
            style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-accent-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_6px_var(--accent-primary)]" />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-text-muted mb-2">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Play controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevTrack}
            className="text-text-secondary hover:text-accent-primary transition-colors text-sm"
            aria-label="Previous track"
          >
            ⏮
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center hover:bg-accent-primary/30 transition-all hover:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="text-accent-primary text-lg">
              {isPlaying ? '⏸' : '▶'}
            </span>
          </button>
          <button
            onClick={nextTrack}
            className="text-text-secondary hover:text-accent-primary transition-colors text-sm"
            aria-label="Next track"
          >
            ⏭
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-text-muted">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-1 accent-[var(--accent-primary)] cursor-pointer"
            aria-label="Volume"
          />
          <button
            onClick={() => setShowVisualizer(!showVisualizer)}
            className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              showVisualizer ? 'text-accent-primary bg-accent-primary/10' : 'text-text-muted'
            )}
          >
            📊
          </button>
        </div>
      </div>

      {/* ─── Playlist Tabs ─── */}
      <div className="flex border-b border-white/5 overflow-x-auto">
        {PLAYLISTS.map((pl) => (
          <button
            key={pl.id}
            onClick={() => selectPlaylist(pl)}
            className={cn(
              'px-3 py-1.5 text-[10px] whitespace-nowrap transition-colors shrink-0',
              activePlaylist.id === pl.id
                ? 'text-accent-primary border-b border-accent-primary bg-accent-primary/5'
                : 'text-text-muted hover:text-text-secondary'
            )}
          >
            {pl.emoji} {pl.name}
          </button>
        ))}
      </div>

      {/* ─── Track List ─── */}
      <div className="flex-1 overflow-y-auto">
        {activePlaylist.tracks.map((track, idx) => (
          <button
            key={track.id}
            onClick={() => selectTrack(idx)}
            className={cn(
              'w-full px-3 py-2 text-left flex items-center gap-2',
              'hover:bg-white/5 transition-colors border-b border-white/[0.02]',
              activeTrackIdx === idx && 'bg-accent-primary/5'
            )}
          >
            <span className="text-[10px] text-text-muted w-4">
              {activeTrackIdx === idx && isPlaying ? '▶' : `${idx + 1}`}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-xs truncate',
                activeTrackIdx === idx ? 'text-accent-primary' : 'text-text-primary'
              )}>
                {track.title}
              </p>
              <p className="text-[10px] text-text-muted truncate">
                {track.artist}
              </p>
            </div>
          </button>
        ))}

        {/* Placeholder message for empty tracks */}
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-text-muted">
            🎵 Add audio files to <code className="text-accent-primary/60">public/music/</code>
          </p>
          <p className="text-[10px] text-text-muted mt-1">
            and update track sources to enable playback
          </p>
        </div>
      </div>
    </div>
  );
}

export const MusicApp = memo(MusicAppInner);
