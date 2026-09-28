// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music Player
// Self-contained panel: mode selector (Morning / Deep Study /
// Typing Rhythm / Night), play/stop, volume, randomize-seed, and a
// live "bouncing dots on a staff" visualizer of generated notes.
// Drops into the Music app OR stands alone.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Shuffle, Volume2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProceduralMusic } from '@/hooks/useProceduralMusic';
import { useMusicGenStore, type MusicMood } from '@/stores/useMusicGenStore';

interface ModeMeta {
  mood: MusicMood;
  label: string;
  emoji: string;
  blurb: string;
  accent: string; // tailwind text/border token
}

const MODES: ModeMeta[] = [
  { mood: 'morning', label: 'Morning',       emoji: '🌅', blurb: 'Light pentatonic arpeggios',   accent: 'accent-warning' },
  { mood: 'study',   label: 'Deep Study',    emoji: '📚', blurb: 'Minimal drone + rain',          accent: 'accent-success' },
  { mood: 'coding',  label: 'Typing Rhythm', emoji: '⌨️', blurb: 'Your keystrokes become a beat', accent: 'accent-primary' },
  { mood: 'night',   label: 'Night',         emoji: '🌌', blurb: 'Dark atmospheric wind',         accent: 'accent-secondary' },
];

// 5 staff lines = 5 pentatonic degrees (A on top, C at bottom)
const STAFF_ROWS = 5;

function ProceduralMusicPlayerInner() {
  const { generate, stop, setVolume, isReady, error } = useProceduralMusic();

  const isGenerating = useMusicGenStore((s) => s.isGenerating);
  const currentMood = useMusicGenStore((s) => s.currentMood);
  const volume = useMusicGenStore((s) => s.volume);
  const typingBPM = useMusicGenStore((s) => s.typingBPM);
  const recentNotes = useMusicGenStore((s) => s.recentNotes);
  const autoMood = useMusicGenStore((s) => s.autoMood);
  const randomizeSeed = useMusicGenStore((s) => s.randomizeSeed);
  const toggleAutoMood = useMusicGenStore((s) => s.toggleAutoMood);

  const [selected, setSelected] = useState<MusicMood>(currentMood);

  useEffect(() => { setSelected(currentMood); }, [currentMood]);

  const handleSelect = useCallback((mood: MusicMood) => {
    setSelected(mood);
    if (isGenerating) void generate(mood); // hot-swap while playing
  }, [isGenerating, generate]);

  const handlePlayStop = useCallback(() => {
    if (isGenerating) {
      stop();
    } else {
      void generate(selected);
    }
  }, [isGenerating, stop, generate, selected]);

  const handleShuffle = useCallback(() => {
    randomizeSeed();
    if (isGenerating) void generate(selected); // re-roll pattern live
  }, [randomizeSeed, isGenerating, generate, selected]);

  // Trim the visualization to the most recent ~1.5s worth of notes.
  const now = Date.now();
  const liveNotes = recentNotes.filter((n) => now - n.at < 2000);

  return (
    <div className="flex flex-col h-full bg-black/30 text-text-primary">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <Sparkles className="w-4 h-4 text-accent-secondary" />
        <span className="font-display text-sm tracking-wide">Procedural Engine</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-text-muted">
          {isGenerating ? 'composing' : 'idle'}
        </span>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {MODES.map((m) => {
          const active = selected === m.mood;
          return (
            <button
              key={m.mood}
              onClick={() => handleSelect(m.mood)}
              className={cn(
                'text-left rounded-lg px-3 py-2 border transition-all',
                active
                  ? `border-${m.accent} bg-white/10 text-glow-sm`
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{m.emoji}</span>
                <span className={cn('text-sm font-medium', active && `text-${m.accent}`)}>{m.label}</span>
              </div>
              <div className="text-[11px] text-text-secondary mt-0.5">{m.blurb}</div>
            </button>
          );
        })}
      </div>

      {/* Visualizer — bouncing dots on a staff */}
      <div className="mx-3 mb-3 rounded-lg bg-black/40 border border-white/10 p-3">
        <div className="relative h-24">
          {/* staff lines */}
          {Array.from({ length: STAFF_ROWS }).map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-white/10"
              style={{ top: `${(i / (STAFF_ROWS - 1)) * 100}%` }}
            />
          ))}
          {/* note dots */}
          <AnimatePresence>
            {liveNotes.map((n) => {
              // degree 0..4 -> row; higher degree sits higher on staff
              const top = ((STAFF_ROWS - 1 - n.degree) / (STAFF_ROWS - 1)) * 100;
              const age = now - n.at;
              const left = Math.min(96, (age / 2000) * 96);
              return (
                <motion.div
                  key={n.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 - age / 2200 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute rounded-full bg-accent-primary"
                  style={{
                    top: `calc(${top}% - 5px)`,
                    left: `${left}%`,
                    width: 10,
                    height: 10,
                    boxShadow: `0 0 ${6 + n.velocity * 10}px var(--color-accent-primary, #00f0ff)`,
                  }}
                />
              );
            })}
          </AnimatePresence>
          {liveNotes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-text-muted">
              {isGenerating ? 'listening…' : 'press play to compose'}
            </div>
          )}
        </div>
        {selected === 'coding' && (
          <div className="mt-2 text-[11px] text-text-secondary">
            Tempo follows your typing · <span className="text-accent-primary">{typingBPM} BPM</span>
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="mt-auto px-3 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayStop}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-full transition-all',
              isGenerating
                ? 'bg-accent-danger/20 border border-accent-danger text-accent-danger'
                : 'bg-accent-primary/20 border border-accent-primary text-accent-primary neon-border'
            )}
            aria-label={isGenerating ? 'Stop' : 'Play'}
          >
            {isGenerating ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs"
            title="Randomize seed — new pattern"
          >
            <Shuffle className="w-3.5 h-3.5" />
            New Seed
          </button>

          <label className="flex items-center gap-2 ml-auto text-xs text-text-secondary">
            <Volume2 className="w-4 h-4" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => void setVolume(parseFloat(e.target.value))}
              className="w-24 accent-[var(--color-accent-primary,#00f0ff)]"
            />
          </label>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <button
            onClick={toggleAutoMood}
            className={cn(
              'rounded-md px-2 py-1 border transition-all',
              autoMood
                ? 'border-accent-success text-accent-success bg-accent-success/10'
                : 'border-white/10 text-text-muted bg-white/5'
            )}
          >
            Auto-mood {autoMood ? 'on' : 'off'}
          </button>
          <span className="text-text-muted">
            {error ? <span className="text-accent-danger">{error}</span> : isReady ? 'engine ready' : 'tap play to enable audio'}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ProceduralMusicPlayer = memo(ProceduralMusicPlayerInner);
