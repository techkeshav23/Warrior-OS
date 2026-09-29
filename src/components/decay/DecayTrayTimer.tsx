// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DecayTrayTimer (FORGE HUD)
// System-tray readout of the current continuous study time (spec
// 6.45). The status LED tracks the decay stage; click for details: a
// stage meter, the minutes until the next stage, today's totals and a
// "Take a break" button that starts a voluntary BreakMode.
// Mount inside the Taskbar's system tray.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Coffee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDecayStore, DECAY_BASE_THRESHOLDS, dayKey } from '@/stores/useDecayStore';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const DECAY_STAGE_NAMES = ['Stable', 'Warming', 'Slowing', 'Burning', 'Heartbeat', 'Fractured'] as const;

/** LED / meter fill per stage (0 = stable … 5 = fractured). */
const STAGE_FILL = [
  'bg-success',
  'bg-warning/60',
  'bg-warning/80',
  'bg-warning',
  'bg-danger/80',
  'bg-danger',
] as const;
const STAGE_TONE: readonly Tone[] = ['success', 'warning', 'warning', 'warning', 'danger', 'danger'];
const EASE = [0.16, 1, 0.3, 1] as const;

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
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
  const live = isTracking && !pausedForIdle && !isOnBreak;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'chamfer-xs flex h-8 items-center gap-1.5 px-2 transition-colors duration-120 ease-out-quint focus-ring',
          open ? 'bg-surface-active text-fg' : 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active'
        )}
        title={`Continuous study ${formatStudyMinutes(minutes)} · ${DECAY_STAGE_NAMES[safeStage]}`}
        aria-label={`Continuous study time ${formatStudyMinutes(minutes)}, decay stage ${safeStage}`}
        aria-expanded={open}
      >
        <span
          aria-hidden
          className={cn('size-1.5 shrink-0 rounded-full', STAGE_FILL[safeStage], live && 'motion-safe:animate-pulse-soft')}
        />
        <Timer size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
        <span className={cn('tabular font-mono text-xs', pausedForIdle && 'opacity-60')}>{formatStudyMinutes(minutes)}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 6, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 4, opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: EASE } }}
            transition={{ duration: 0.18, ease: EASE }}
            className="armor-popover absolute bottom-11 right-0 w-72 p-4 text-left [--cut:8px]"
            style={{ transformOrigin: 'bottom right' }}
            role="dialog"
            aria-label="Reality Decay timer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="engraved font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Continuous study</p>
                <p className="tabular mt-1.5 font-display text-2xl font-semibold leading-none text-fg">
                  {formatStudyMinutes(minutes)}
                </p>
              </div>
              <Badge tone={STAGE_TONE[safeStage]} dot pulse={live}>
                {DECAY_STAGE_NAMES[safeStage]}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-fg-muted">{status}</p>

            {/* Stage meter: five decay stages */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                <span className="text-fg-muted">
                  Stage <span className="tabular text-fg">{safeStage}</span> of 5
                </span>
                <span className="tabular font-mono text-2xs text-fg-subtle">
                  {next !== undefined ? `next in ${formatStudyMinutes(next - minutes)}` : `${breakDuration}-min break due`}
                </span>
              </div>
              <div className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span
                    key={s}
                    className={cn(
                      'h-2 flex-1 [clip-path:polygon(3px_0,100%_0,calc(100%-3px)_100%,0_100%)]',
                      s <= safeStage ? STAGE_FILL[s] : 'bg-steel-700'
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Today */}
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
              <div>
                <dt className="hud-label">Studied today</dt>
                <dd className="tabular mt-1 text-sm font-medium text-fg">{formatStudyMinutes(todayMinutes)}</dd>
              </div>
              <div>
                <dt className="hud-label">Breaks</dt>
                <dd className="tabular mt-1 text-sm font-medium text-fg">{todayBreaks}</dd>
              </div>
            </dl>

            <Button
              variant="primary"
              fullWidth
              leadingIcon={Coffee}
              disabled={!canBreak}
              className="mt-4"
              onClick={() => {
                startBreak('voluntary');
                setOpen(false);
              }}
            >
              Take a {breakDuration}-minute break now
            </Button>
            <p className="mt-2 text-center text-2xs text-fg-subtle">Breaks after 30+ minutes of study earn +50 XP.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
