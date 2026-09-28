// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music Player
// The "Procedural" tab of the Music Player: mode selector (Morning /
// Deep Study / Typing Rhythm / Night), play/stop, volume, a
// "new seed" re-roll, auto-mood, and bouncing dots on a staff showing
// the notes as they are generated. Also mounts MoodShift + AutoMood
// (attached once OS-wide) so events and time of day shape the music.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { Play, Square, Shuffle, Volume2, Sparkles, Keyboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProceduralMusic } from '@/hooks/useProceduralMusic';
import { useMusicGenStore, MUSIC_MOODS, type MusicMood } from '@/stores/useMusicGenStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MOOD_LABELS, moodForHour } from '@/lib/procedural-music/engine';
import { NoteStaff } from './NoteStaff';
import { MoodShift } from './MoodShift';
import { AutoMood } from './AutoMood';

interface ModeMeta {
  emoji: string;
  blurb: string;
  color: string; // identity colour for the card ring + staff dots
}

const MODES: Record<MusicMood, ModeMeta> = {
  morning: { emoji: '🌅', blurb: 'Light pentatonic arpeggios · 80 bpm', color: '#ffab00' },
  study: { emoji: '📚', blurb: 'Low drone, rain, distant bells', color: '#00e676' },
  coding: { emoji: '⌨️', blurb: 'Your keystrokes become the beat', color: '#00f0ff' },
  night: { emoji: '🌌', blurb: 'Deep drone, wind, far rumbles', color: '#7b61ff' },
};

const AUTO_WINDOWS: Record<MusicMood, string> = {
  morning: '6 AM – 12 PM',
  study: '12 – 6 PM',
  night: '6 PM – 6 AM',
  coding: 'while typing',
};

function formatListen(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 1) return seconds > 0 ? '<1m' : '—';
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}

function ProceduralMusicPlayerInner({ className }: { className?: string }) {
  const { generate, stop, setVolume, status, error } = useProceduralMusic();

  const isGenerating = useMusicGenStore((s) => s.isGenerating);
  const currentMood = useMusicGenStore((s) => s.currentMood);
  const volume = useMusicGenStore((s) => s.volume);
  const typingBPM = useMusicGenStore((s) => s.typingBPM);
  const typingActive = useMusicGenStore((s) => s.typingActive);
  const autoMood = useMusicGenStore((s) => s.autoMood);
  const listenSeconds = useMusicGenStore((s) => s.listenSeconds);
  const randomizeSeed = useMusicGenStore((s) => s.randomizeSeed);
  const setAutoMood = useMusicGenStore((s) => s.setAutoMood);
  const biometricsOn = useSettingsStore((s) => s.biometricsEnabled);

  const [selected, setSelected] = useState<MusicMood>(currentMood);
  // Follow the engine when auto-mood switches (derived during render).
  const [prevMood, setPrevMood] = useState(currentMood);
  if (prevMood !== currentMood) {
    setPrevMood(currentMood);
    setSelected(currentMood);
  }

  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const timeMood = moodForHour(hour);

  const selectMode = (mood: MusicMood) => {
    setSelected(mood);
    if (autoMood) setAutoMood(false); // an explicit pick wins over auto-mood
    if (isGenerating) void generate(mood);
  };

  const togglePlay = () => {
    if (isGenerating) stop();
    else void generate(autoMood ? timeMood : selected);
  };

  const newSeed = () => {
    randomizeSeed();
    if (isGenerating) void generate(currentMood); // re-roll the pattern live
  };

  const toggleAuto = () => {
    const next = !autoMood;
    setAutoMood(next);
    if (next && isGenerating && currentMood !== timeMood) void generate(timeMood);
  };

  const activeMood = isGenerating ? currentMood : selected;
  const statusLabel =
    status === 'starting' ? 'warming up' : status === 'playing' ? 'composing' : status === 'error' ? 'error' : 'idle';

  return (
    <div className={cn('flex h-full flex-col overflow-y-auto bg-black/30 text-text-primary', className)}>
      <MoodShift />
      <AutoMood />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Sparkles className="h-4 w-4 text-accent-secondary" aria-hidden />
        <span className="font-display text-sm tracking-wide">Procedural Engine</span>
        <span
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest',
            status === 'playing' ? 'bg-accent-success/15 text-text-primary' : 'bg-white/5 text-text-muted'
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', status === 'playing' ? 'bg-accent-success' : 'bg-text-muted')}
            aria-hidden
          />
          {statusLabel}
        </span>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 p-3" role="radiogroup" aria-label="Music mode">
        {MUSIC_MOODS.map((mood) => {
          const meta = MODES[mood];
          const active = activeMood === mood;
          return (
            <button
              key={mood}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => selectMode(mood)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                active ? 'bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
              )}
              style={active ? { borderColor: meta.color, boxShadow: `0 0 12px ${meta.color}33` } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden>
                  {meta.emoji}
                </span>
                <span className="text-sm font-medium">{MOOD_LABELS[mood]}</span>
                {isGenerating && currentMood === mood && (
                  <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: meta.color }} />
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-text-secondary">{meta.blurb}</div>
              <div className="mt-1 text-[10px] text-text-muted">
                {formatListen(listenSeconds[mood])} composed
              </div>
            </button>
          );
        })}
      </div>

      {/* Visualizer — bouncing dots on a staff */}
      <div className="mx-3 mb-3 rounded-lg border border-white/10 bg-black/40 p-2">
        <div className="relative h-28">
          <NoteStaff color={MODES[activeMood].color} />
          {!isGenerating && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-text-muted">
              {status === 'starting' ? 'warming up the synths…' : 'press play — the OS composes as you go'}
            </div>
          )}
        </div>
        {activeMood === 'coding' && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            {biometricsOn ? (
              <span>
                Tempo follows your typing · <span className="font-mono text-text-primary">{typingBPM} BPM</span>
                {isGenerating && (typingActive ? ' · beat live' : ' · type to bring the beat back')}
              </span>
            ) : (
              <span>
                Typing biometrics are off, so the beat can&apos;t hear you — it holds a steady{' '}
                <span className="font-mono text-text-primary">90 BPM</span>.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="mt-auto space-y-3 px-3 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={status === 'starting'}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full border transition-colors disabled:opacity-50',
              isGenerating
                ? 'border-accent-danger bg-accent-danger/20 text-accent-danger'
                : 'border-accent-primary bg-accent-primary/20 text-accent-primary'
            )}
            aria-label={isGenerating ? 'Stop procedural music' : 'Play procedural music'}
          >
            {isGenerating ? <Square className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={newSeed}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:bg-white/10"
            title="Randomize seed — a brand-new pattern"
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden />
            New seed
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

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            role="switch"
            aria-checked={autoMood}
            onClick={toggleAuto}
            className={cn(
              'rounded-md border px-2 py-1 transition-colors',
              autoMood
                ? 'border-accent-success/60 bg-accent-success/10 text-text-primary'
                : 'border-white/10 bg-white/5 text-text-muted hover:text-text-secondary'
            )}
            title="Pick the mode from the time of day; sustained typing switches to Typing Rhythm"
          >
            Auto-mood {autoMood ? `on · ${MOOD_LABELS[timeMood]} (${AUTO_WINDOWS[timeMood]})` : 'off'}
          </button>
          <span className="truncate text-text-muted">
            {error ? <span className="text-accent-danger">{error}</span> : status === 'playing' ? 'Tone.js engine running' : 'audio starts on play'}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ProceduralMusicPlayer = memo(ProceduralMusicPlayerInner);
