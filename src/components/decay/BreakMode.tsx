// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BreakMode
// Full-screen recovery overlay: deep-blue calming gradient, an
// animated 4-7-8 breathing circle (inhale 4 s · hold 7 s · exhale
// 8 s), a stretching-tip carousel, and a countdown that always ends
// on its own. It cannot be skipped: pointer input is covered, Esc and
// every other app key are swallowed, and the end time is persisted so
// a reload resumes the same break. A soft synthesised ambient pad
// plays underneath when sound is on.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDecayStore } from '@/stores/useDecayStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { createSynthLoop } from '@/lib/procedural-music/synth-samples';
import { cn } from '@/lib/utils';

const STRETCH_TIPS: string[] = [
  'Roll your shoulders slowly — five times forward, five times back.',
  'Look at something 20 feet away for 20 seconds. Let your eyes soften.',
  'Stand up and stretch your arms overhead. Reach for the ceiling.',
  'Unclench your jaw. Drop your shoulders away from your ears.',
  'Take a slow sip of water.',
  'Rotate your wrists and gently stretch each finger back.',
  'Tilt your head toward each shoulder and hold for a breath.',
  'Breathe from your belly, not your chest.',
];
const TIP_SECONDS = 12;

// 4-7-8 technique: inhale 4 s, hold 7 s, exhale 8 s (19 s cycle).
type BreathPhase = 'inhale' | 'hold' | 'exhale';
const PHASES: { phase: BreathPhase; seconds: number }[] = [
  { phase: 'inhale', seconds: 4 },
  { phase: 'hold', seconds: 7 },
  { phase: 'exhale', seconds: 8 },
];
const CYCLE_SECONDS = 19;
const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
};

function breathAt(elapsedSec: number): { phase: BreathPhase; left: number; length: number; cycle: number } {
  const cycle = Math.floor(elapsedSec / CYCLE_SECONDS) + 1;
  let t = elapsedSec % CYCLE_SECONDS;
  for (const p of PHASES) {
    if (t < p.seconds) return { phase: p.phase, left: p.seconds - t, length: p.seconds, cycle };
    t -= p.seconds;
  }
  return { phase: 'inhale', left: 4, length: 4, cycle };
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const RING_R = 118;
const RING_C = 2 * Math.PI * RING_R;

/** Deep ink with a faint azure lift at the top and a hint of ember dawn below. */
const BACKDROP =
  'radial-gradient(ellipse 80% 60% at 50% 30%, color-mix(in oklab, var(--color-info) 10%, transparent), transparent 70%), radial-gradient(ellipse 70% 40% at 50% 115%, color-mix(in oklab, var(--color-ember-500) 10%, transparent), transparent 70%), linear-gradient(180deg, var(--color-ink-900), var(--color-ink-950))';

interface BreakModeProps {
  /** Called once the countdown reaches zero. */
  onComplete: () => void;
}

export function BreakMode({ onComplete }: BreakModeProps) {
  const breakEndsAt = useDecayStore((s) => s.breakEndsAt);
  const breakStartedAt = useDecayStore((s) => s.breakStartedAt);
  const breakReason = useDecayStore((s) => s.breakReason);
  const breakDuration = useDecayStore((s) => s.breakDuration);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  const startedAt = breakStartedAt ?? mountedAt;
  const endsAt = breakEndsAt ?? startedAt + breakDuration * 60_000;
  const totalMs = Math.max(1, endsAt - startedAt);
  const remainingMs = Math.max(0, endsAt - now);
  const done = remainingMs <= 0;
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);
  const breath = breathAt(elapsedSec);
  const tipIndex = Math.floor(elapsedSec / TIP_SECONDS) % STRETCH_TIPS.length;

  // Clock — 4 Hz keeps the breathing countdown crisp.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // The break always ends on its own once the persisted end time passes.
  useEffect(() => {
    if (done) onCompleteRef.current();
  }, [done]);

  // Nothing behind the overlay keeps keyboard focus.
  useEffect(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);

  // Swallow app keyboard input (Esc included). Browser-level chords
  // (Ctrl/⌘/Alt combos, F-keys) still reach the browser itself.
  useEffect(() => {
    const block = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      const browserChord = e.ctrlKey || e.metaKey || e.altKey || /^F\d{1,2}$/.test(e.key);
      if (!browserChord) e.preventDefault();
    };
    const opts: AddEventListenerOptions = { capture: true };
    window.addEventListener('keydown', block, opts);
    window.addEventListener('keyup', block, opts);
    window.addEventListener('keypress', block, opts);
    return () => {
      window.removeEventListener('keydown', block, opts);
      window.removeEventListener('keyup', block, opts);
      window.removeEventListener('keypress', block, opts);
    };
  }, []);

  // Soft ambient pad (synthesised loop through Howler), faded in and out.
  useEffect(() => {
    if (!soundEnabled) return;
    const target = Math.min(0.35, useSettingsStore.getState().soundVolume);
    const howl = createSynthLoop('calm-ambient', 0);
    if (!howl) return;
    howl.play();
    howl.fade(0, target, 2500);
    return () => {
      try {
        howl.fade(howl.volume(), 0, 600);
      } catch {
        /* already unloaded */
      }
      window.setTimeout(() => {
        howl.stop();
        howl.unload();
      }, 650);
    };
  }, [soundEnabled]);

  const circleScale = breath.phase === 'exhale' ? 0.72 : 1.3;
  const progress = 1 - remainingMs / totalMs;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const voluntary = breakReason === 'voluntary';

  return (
    <motion.div
      className="fixed inset-0 flex select-none flex-col items-center justify-center overflow-hidden bg-ink-950 px-6 text-fg"
      style={{ zIndex: 960 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      role="dialog"
      aria-modal="true"
      aria-label="Recovery break"
    >
      {/* Calm backdrop: deep ink, a slow drifting plasma haze, a hint of dawn */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: BACKDROP }} />
      <motion.div
        className="pointer-events-none absolute h-[70vmax] w-[70vmax] rounded-full"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-plasma-400) 7%, transparent) 0%, transparent 60%)' }}
        animate={{ x: ['-12%', '10%', '-12%'], y: ['-8%', '6%', '-8%'] }}
        transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      <div className="relative mb-6 text-center">
        <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-accent">{voluntary ? 'Recovery break' : 'Forced recovery'}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          {voluntary
            ? 'Good call, warrior. Rest now — the OS will repair itself when the timer ends.'
            : 'Your focus is legendary. Your body is mortal. This break cannot be skipped.'}
        </p>
      </div>

      {/* Breathing circle inside the break-progress ring */}
      <div className="relative flex size-72 items-center justify-center">
        <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 288 288" aria-hidden>
          <circle cx="144" cy="144" r={RING_R} fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" />
          {/* tick marks: one per minute of the ring */}
          <circle
            cx="144"
            cy="144"
            r={RING_R + 10}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="4"
            strokeDasharray={`1 ${((2 * Math.PI * (RING_R + 10)) / 60 - 1).toFixed(3)}`}
          />
          <circle
            cx="144"
            cy="144"
            r={RING_R}
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.8"
            strokeWidth="2"
            strokeLinecap="butt"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.25s linear' }}
          />
        </svg>
        {/* the breath: a soft plasma sphere with a hairline rim */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 168,
            height: 168,
            background:
              'radial-gradient(circle at 50% 40%, color-mix(in oklab, var(--color-plasma-300) 20%, transparent) 0%, color-mix(in oklab, var(--color-plasma-500) 9%, transparent) 55%, transparent 74%)',
            border: '1px solid color-mix(in oklab, var(--color-plasma-400) 32%, transparent)',
            boxShadow: '0 0 60px -10px color-mix(in oklab, var(--color-plasma-400) 30%, transparent)',
          }}
          initial={{ scale: 0.72 }}
          animate={{ scale: circleScale }}
          transition={{ duration: breath.phase === 'hold' ? 0.3 : breath.left, ease: 'easeInOut' }}
        />
        <div className="relative z-10 text-center" aria-live="polite">
          <p className="font-display text-2xl font-semibold text-fg">{PHASE_LABEL[breath.phase]}</p>
          <p className="mt-1 font-mono text-sm text-fg-muted tabular">{Math.ceil(breath.left)}</p>
          <p className="mt-2 hud-label">4 · 7 · 8 — cycle {breath.cycle}</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="relative mt-6 text-center">
        <p className="font-display text-4xl font-medium text-fg tabular" aria-label={`${formatClock(remainingSec)} remaining`}>
          {formatClock(remainingSec)}
        </p>
        <p className="mt-2 engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Remaining</p>
      </div>

      {/* Stretch tip carousel */}
      <div className="armor-panel relative mt-8 flex h-12 w-full max-w-lg items-center justify-center px-5 text-center [--cut-bl:0px] [--cut-tr:0px] [--cut:10px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            className="text-sm text-fg-muted"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {STRETCH_TIPS[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="relative mt-3 flex gap-1.5" aria-hidden>
        {STRETCH_TIPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 transition-[width,background-color] duration-260 ease-out-quint [clip-path:polygon(2px_0,100%_0,calc(100%-2px)_100%,0_100%)]',
              i === tipIndex ? 'w-4 bg-accent/70' : 'w-1 bg-fg-faint'
            )}
          />
        ))}
      </div>
    </motion.div>
  );
}
