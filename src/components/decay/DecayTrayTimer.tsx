// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecayTrayTimer
// System-tray readout of the current continuous study time (spec
// 6.45). Colour dot tracks the decay stage; click for details, the
// minutes until the next stage, today's totals and a "Take a break
// now" button that starts a voluntary BreakMode.
// Mount inside the Taskbar's system tray.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDecayStore, DECAY_BASE_THRESHOLDS, dayKey } from '@/stores/useDecayStore';

export const DECAY_STAGE_NAMES = ['Stable', 'Warming', 'Slowing', 'Burning', 'Heartbeat', 'Fractured'] as const;
const STAGE_DOT = [
  'bg-accent-success',
  'bg-accent-warning/60',
  'bg-accent-warning/80',
  'bg-accent-warning',
  'bg-accent-danger/80',
  'bg-accent-danger',
] as const;

export function formatStudyMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.max(0, min % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Local day key that rolls over at midnight while mounted. */
export function useLocalDayKey(): string {
  const [key, setKey] = useState(() => dayKey(Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => setKey(dayKey(Date.now())), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return key;
}

export function DecayTrayTimer({ className }: { className?: string }) {
  const enabled = useDecayStore((s) => s.enabled);
  const minutes = useDecayStore((s) => s.continuousStudyMinutes);
  const stage = useDecayStore((s) => s.decayStage);
  const isTracking = useDecayStore((s) => s.isTracking);
  const pausedForIdle = useDecayStore((s) => s.pausedForIdle);
  const isOnBreak = useDecayStore((s) => s.isOnBreak);
  const isRepairing = useDecayStore((s) => s.isRepairing);
  const offset = useDecayStore((s) => s.thresholdOffset);
  const daily = useDecayStore((s) => s.daily);
  const breakDuration = useDecayStore((s) => s.breakDuration);
  const startBreak = useDecayStore((s) => s.startBreak);
  const today = useLocalDayKey();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the popover on any press outside it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open]);

  if (!enabled) return null;

  const thresholds = DECAY_BASE_THRESHOLDS.map((t) => t + offset);
  const next = thresholds.find((t) => t > minutes);
  const status = isOnBreak
    ? 'On a recovery break'
    : isRepairing
      ? 'Restoring systems'
      : pausedForIdle
        ? 'Paused — idle 10+ min'
        : isTracking
          ? 'Tracking continuous study'
          : 'Starts on your next action';
  const safeStage = Math.max(0, Math.min(5, stage));
  const canBreak = !isOnBreak && !isRepairing;
  const todayMinutes = daily.day === today ? daily.studyMinutes : 0;
  const todayBreaks = daily.day === today ? daily.breaks : 0;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 font-mono text-[11px] text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
        title={`Continuous study ${formatStudyMinutes(minutes)} · ${DECAY_STAGE_NAMES[safeStage]}`}
        aria-label={`Continuous study time ${formatStudyMinutes(minutes)}, decay stage ${safeStage}`}
        aria-expanded={open}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOT[safeStage])} aria-hidden />
        <Timer className="h-3.5 w-3.5" aria-hidden />
        <span className={cn(pausedForIdle && 'opacity-60')}>{formatStudyMinutes(minutes)}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 8, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 6, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-11 right-0 w-64 rounded-[var(--radius-md)] border border-white/10 p-3 text-left"
            style={{ background: 'rgba(12, 12, 20, 0.95)', backdropFilter: 'blur(20px)' }}
            role="dialog"
            aria-label="Reality Decay timer"
          >
            <p className="text-[10px] uppercase tracking-widest text-text-muted">Continuous study</p>
            <p className="mt-0.5 text-2xl font-semibold text-text-primary">{formatStudyMinutes(minutes)}</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">{status}</p>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-text-secondary">
              <span className={cn('h-2 w-2 rounded-full', STAGE_DOT[safeStage])} aria-hidden />
              <span className="text-text-primary">
                Stage {safeStage} · {DECAY_STAGE_NAMES[safeStage]}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted">
              {next !== undefined
                ? `Next stage in ${formatStudyMinutes(next - minutes)}`
                : `Forced ${breakDuration}-minute break is due`}
            </p>

            <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-text-secondary">
              Today: {formatStudyMinutes(todayMinutes)} studied · {todayBreaks} break
              {todayBreaks === 1 ? '' : 's'}
            </div>

            <button
              type="button"
              disabled={!canBreak}
              onClick={() => {
                startBreak('voluntary');
                setOpen(false);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-accent-primary/30 bg-accent-primary/10 px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-accent-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Coffee className="h-3.5 w-3.5" aria-hidden />
              Take a {breakDuration}-minute break now
            </button>
            <p className="mt-1.5 text-center text-[10px] text-text-muted">
              Breaks after 30+ minutes of study earn +50 XP.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
