// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music Player (FORGE HUD)
// The "Procedural" tab of WarBeats: a now-playing hero (mood, live
// staff of generated notes, transport with the primary play button,
// new seed, volume), four mode cards (Morning / Deep Study / Typing
// Rhythm / Night) and the auto-mood switch. Also mounts MoodShift +
// AutoMood (attached once OS-wide) so events and time of day shape
// the music.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import {
  AudioLines,
  BookOpen,
  Keyboard,
  LoaderCircle,
  MoonStar,
  Play,
  Shuffle,
  Square,
  Sunrise,
  TriangleAlert,
  Volume1,
  Volume2,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton, Slider, Switch } from '@/components/ui';
import { VIZ } from '@/styles/tokens';
import { useProceduralMusic } from '@/hooks/useProceduralMusic';
import { useMusicGenStore, MUSIC_MOODS, type MusicMood } from '@/stores/useMusicGenStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { MOOD_LABELS, moodForHour } from '@/lib/procedural-music/engine';
import { NoteStaff } from './NoteStaff';
import { MoodShift } from './MoodShift';
import { AutoMood } from './AutoMood';

interface ModeMeta {
  icon: LucideIcon;
  blurb: string;
  /** Identity hue (viz palette): the icon tile and the notes on the staff. */
  color: string;
}

const MODES: Record<MusicMood, ModeMeta> = {
  morning: { icon: Sunrise, blurb: 'Light pentatonic arpeggios · 80 bpm', color: VIZ[6] },
  study: { icon: BookOpen, blurb: 'Low drone, rain, distant bells', color: VIZ[3] },
  coding: { icon: Keyboard, blurb: 'Your keystrokes become the beat', color: VIZ[0] },
  night: { icon: MoonStar, blurb: 'Deep drone, wind, far rumbles', color: VIZ[2] },
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
  const active = MODES[activeMood];
  const ActiveIcon = active.icon;
  const live = isGenerating && status === 'playing';
  const warming = status === 'starting';
  const VolumeIcon = volume <= 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const statusLine = error ? (
    <span className="flex min-w-0 items-center gap-1.5 text-danger" role="alert">
      <TriangleAlert size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span className="truncate" title={error}>
        {error}
      </span>
    </span>
  ) : isGenerating && warming ? (
    <span className="truncate text-warning">Browser paused audio: click anywhere to start</span>
  ) : status === 'playing' ? (
    <span className="truncate">Tone.js engine running</span>
  ) : (
    <span className="truncate">Audio starts on play</span>
  );

  return (
    <div className={cn('scrollbar-thin flex h-full flex-col gap-3 overflow-y-auto p-4', className)}>
      <MoodShift />
      <AutoMood />

      {/* ── Now playing ── */}
      <section
        aria-label="Now playing"
        className={cn(
          'glass-panel relative isolate shrink-0 overflow-hidden rounded-card',
          live && 'hud-corners'
        )}
        style={{ '--mood': active.color } as React.CSSProperties}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-260"
          style={{
            background: 'radial-gradient(ellipse at 88% 0%, color-mix(in oklab, var(--mood) 16%, transparent), transparent 62%)',
            opacity: live ? 1 : 0.55,
          }}
        />
        <div className="flex items-start gap-3 px-4 pt-3.5">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-card border border-line-strong bg-linear-to-b from-ink-750 to-ink-850 inset-shadow-[0_1px_0_rgb(255_255_255/0.06)]"
            style={{ color: active.color }}
          >
            <ActiveIcon size={22} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="hud-label">{live ? 'Now composing' : warming ? 'Warming up' : 'Ready'}</div>
            <div className="mt-0.5 truncate text-lg font-semibold text-fg">{MOOD_LABELS[activeMood]}</div>
            <div className="truncate text-xs text-fg-muted" title={active.blurb}>
              {active.blurb}
            </div>
          </div>
        </div>

        {/* Live staff: every generated note lands at its pitch */}
        <div className="relative mx-4 mt-3 h-16 overflow-hidden rounded-control border border-line bg-ink-950/55">
          <NoteStaff color={active.color} />
          {!isGenerating && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-fg-subtle">
              {warming ? (
                <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin" aria-hidden />
              ) : (
                <AudioLines size={14} strokeWidth={1.75} aria-hidden />
              )}
              {warming ? 'Warming up the synths' : 'Press play. The OS composes as you go.'}
            </div>
          )}
        </div>

        {activeMood === 'coding' && (
          <div className="mx-4 mt-2 flex items-start gap-2 text-xs text-fg-muted">
            <Keyboard size={14} strokeWidth={1.75} className="mt-px shrink-0 text-fg-subtle" aria-hidden />
            {biometricsOn ? (
              <span>
                Tempo follows your typing · <span className="tabular font-mono text-fg">{typingBPM} BPM</span>
                {isGenerating && (typingActive ? ' · beat live' : ' · type to bring the beat back')}
              </span>
            ) : (
              <span>
                Typing biometrics are off, so the beat holds a steady{' '}
                <span className="tabular font-mono text-fg">90 BPM</span>.
              </span>
            )}
          </div>
        )}

        {/* Transport */}
        <div className="flex items-center gap-3 px-4 pb-3.5 pt-3">
          <button
            type="button"
            onClick={togglePlay}
            disabled={warming && !isGenerating}
            aria-label={isGenerating ? 'Stop procedural music' : 'Play procedural music'}
            className={cn(
              'focus-ring flex size-12 shrink-0 items-center justify-center rounded-full',
              'transition-[filter,box-shadow,background-color] duration-120 ease-out-quint',
              'disabled:pointer-events-none disabled:opacity-45',
              'bg-accent text-accent-fg inset-shadow-[0_1px_0_rgb(255_255_255/0.28)] hover:brightness-110 hover:shadow-glow active:brightness-95',
              live && 'shadow-glow'
            )}
          >
            {isGenerating ? (
              <Square size={16} strokeWidth={2} className="fill-current" aria-hidden />
            ) : (
              <Play size={20} strokeWidth={2} className="ml-0.5 fill-current" aria-hidden />
            )}
          </button>
          <IconButton icon={Shuffle} variant="secondary" aria-label="New seed: a brand-new pattern" tooltip onClick={newSeed} />
          <div className="ml-auto flex min-w-0 max-w-40 flex-1 items-center gap-2">
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

      {/* ── Modes ── */}
      <section aria-label="Music mode" className="shrink-0">
        <h3 className="hud-label mb-2">Modes</h3>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Music mode">
          {MUSIC_MOODS.map((mood) => {
            const meta = MODES[mood];
            const Icon = meta.icon;
            const checked = activeMood === mood;
            const playingHere = isGenerating && currentMood === mood;
            return (
              <button
                key={mood}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => selectMode(mood)}
                title={meta.blurb}
                className={cn(
                  'focus-ring group relative flex min-w-0 flex-col gap-1 rounded-card border px-3 py-2 text-left',
                  'transition-[background-color,border-color] duration-120 ease-out-quint',
                  checked
                    ? 'border-accent/40 bg-accent/[0.07]'
                    : 'border-line bg-surface-2 hover:border-line-strong hover:bg-surface-hover active:bg-surface-active'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-[6px] border border-line bg-ink-800"
                    style={{ color: meta.color }}
                  >
                    <Icon size={14} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className={cn('min-w-0 flex-1 truncate text-ui font-medium', checked ? 'text-fg' : 'text-fg-muted group-hover:text-fg')}>
                    {MOOD_LABELS[mood]}
                  </span>
                  {playingHere ? (
                    <span className="relative flex size-2 shrink-0" aria-label="Playing">
                      <span className="absolute inset-0 rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                      <span className="relative size-2 rounded-full bg-success" />
                    </span>
                  ) : (
                    <span className="tabular shrink-0 font-mono text-2xs text-fg-subtle" title="Time composed">
                      {formatListen(listenSeconds[mood])}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-fg-subtle">{meta.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Auto-mood ── */}
      <section className="shrink-0 rounded-card bg-surface-2 px-3 py-2">
        <Switch
          layout="row"
          size="sm"
          checked={autoMood}
          onCheckedChange={toggleAuto}
          label="Auto-mood"
          description={
            autoMood
              ? `On · ${MOOD_LABELS[timeMood]} (${AUTO_WINDOWS[timeMood]}); typing switches to Typing Rhythm`
              : 'Pick the mode from the time of day'
          }
          title="Pick the mode from the time of day; sustained typing switches to Typing Rhythm"
        />
      </section>

      <div className="mt-auto flex min-h-5 shrink-0 items-center gap-2 text-xs text-fg-subtle">{statusLine}</div>
    </div>
  );
}

export const ProceduralMusicPlayer = memo(ProceduralMusicPlayerInner);
