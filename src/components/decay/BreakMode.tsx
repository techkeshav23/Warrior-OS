// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BreakMode
// Full-screen forced-break overlay. Deep-blue calming gradient,
// animated 4-7-8 breathing circle, stretching-tip carousel, and a
// countdown timer. Cannot be dismissed early (Esc disabled).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Howl } from 'howler';
import { useDecayStore } from '@/stores/useDecayStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

const STRETCH_TIPS: string[] = [
  'Roll your shoulders slowly, both directions.',
  'Look at something 20 feet away for 20 seconds.',
  'Stand up and stretch your arms overhead.',
  'Unclench your jaw. Drop your shoulders.',
  'Take a slow sip of water.',
  'Rotate your wrists and stretch your fingers.',
  'Breathe from your belly, not your chest.',
];

// 4-7-8 technique: inhale 4s, hold 7s, exhale 8s.
type BreathPhase = 'inhale' | 'hold' | 'exhale';
const PHASE_DURATION: Record<BreathPhase, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
};
const PHASE_LABEL: Record<BreathPhase, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface BreakModeProps {
  /** Called once the countdown reaches zero. */
  onComplete: () => void;
}

export function BreakMode({ onComplete }: BreakModeProps) {
  const breakDuration = useDecayStore((s) => s.breakDuration);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);

  const totalSeconds = breakDuration * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [tipIndex, setTipIndex] = useState(0);
  const completedRef = useRef(false);
  const ambientRef = useRef<Howl | null>(null);

  // Countdown
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onComplete]);

  // Breathing phase cycle (4-7-8)
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const order: BreathPhase[] = ['inhale', 'hold', 'exhale'];
    let idx = 0;

    const advance = () => {
      if (cancelled) return;
      const current = order[idx];
      setPhase(current);
      timer = setTimeout(() => {
        idx = (idx + 1) % order.length;
        advance();
      }, PHASE_DURATION[current] * 1000);
    };
    advance();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Tip carousel
  useEffect(() => {
    const id = setInterval(() => {
      setTipIndex((i) => (i + 1) % STRETCH_TIPS.length);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // Soft ambient sound (best-effort; file may not exist — never throws)
  useEffect(() => {
    if (!soundEnabled) return;
    if (typeof window === 'undefined') return;
    let howl: Howl | null = null;
    try {
      howl = new Howl({
        src: ['/sounds/ambient-calm.mp3'],
        loop: true,
        volume: Math.min(0.4, soundVolume),
        html5: true,
        onloaderror: () => {},
        onplayerror: () => {},
      });
      howl.play();
      ambientRef.current = howl;
    } catch {
      /* ignore missing audio */
    }
    return () => {
      try {
        howl?.stop();
        howl?.unload();
      } catch {
        /* noop */
      }
      ambientRef.current = null;
    };
  }, [soundEnabled, soundVolume]);

  // Block Esc + other dismissal keys while break is active.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const block = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, []);

  const circleScale =
    phase === 'inhale' ? 1.35 : phase === 'hold' ? 1.35 : 0.75;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center select-none"
      style={{
        zIndex: 960,
        background:
          'radial-gradient(circle at 50% 40%, #123a6b 0%, #0a1f3d 55%, #050b18 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="text-center mb-10">
        <p className="font-display text-accent-primary text-glow-sm text-sm tracking-[0.3em] uppercase">
          Forced Recovery
        </p>
        <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto">
          Your focus is legendary. Your body is mortal. Rest — this cannot be
          skipped.
        </p>
      </div>

      {/* Breathing circle */}
      <div className="relative flex items-center justify-center w-72 h-72">
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            background:
              'radial-gradient(circle, rgba(0,240,255,0.28) 0%, rgba(123,97,255,0.12) 60%, transparent 75%)',
            border: '1px solid rgba(0,240,255,0.4)',
          }}
          animate={{ scale: circleScale }}
          transition={{
            duration: PHASE_DURATION[phase],
            ease: phase === 'hold' ? 'linear' : 'easeInOut',
          }}
        />
        <div className="relative text-center z-10">
          <p className="font-display text-2xl text-text-primary text-glow-sm">
            {PHASE_LABEL[phase]}
          </p>
          <p className="text-text-secondary text-xs mt-1">
            {PHASE_DURATION[phase]}s
          </p>
        </div>
      </div>

      {/* Timer */}
      <div className="mt-10 text-center">
        <p className="font-mono text-4xl text-text-primary tracking-widest">
          {formatTime(remaining)}
        </p>
        <p className="text-text-muted text-xs mt-1 uppercase tracking-widest">
          remaining
        </p>
      </div>

      {/* Stretch tip carousel */}
      <div className="mt-8 h-8 flex items-center">
        <motion.p
          key={tipIndex}
          className="text-text-secondary text-sm"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.5 }}
        >
          {STRETCH_TIPS[tipIndex]}
        </motion.p>
      </div>
    </motion.div>
  );
}
