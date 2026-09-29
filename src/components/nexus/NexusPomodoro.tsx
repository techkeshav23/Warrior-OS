// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Pomodoro
// The focus timer started by "study mode" / "start pomodoro".
// State (end timestamps) lives in useNexusStore so it survives
// window closes and reloads. NexusPomodoroEngine advances phases
// and fires the completion effects (chime, notification, XP);
// NexusPomodoroPill is the countdown UI (HUD or inline).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Coffee, Pause, Play, Square, Timer } from 'lucide-react';
import { useNexusStore } from '@/stores/useNexusStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useXPStore } from '@/stores/useXPStore';
import { formatClock, pomodoroRemainingMs } from '@/lib/nexus/context';
import { playNexusChime } from '@/lib/nexus/chime';
import { NEXUS_ACHIEVEMENTS, unlockNexusAchievement } from './NexusCore';
import { IconButton } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { NexusPomodoroTransition } from '@/types/nexus';

/** Focus sessions shorter than this earn no XP (no 1-minute XP farming). */
export const NEXUS_POMODORO_MIN_XP_MINUTES = 10;
/** A session this long counts as a "full" pomodoro for the achievement. */
export const NEXUS_POMODORO_FULL_MINUTES = 15;

/** 1 XP per focused minute (max 60) for sessions of 10+ minutes. */
export function pomodoroXp(focusMinutes: number): number {
  return focusMinutes >= NEXUS_POMODORO_MIN_XP_MINUTES ? Math.min(60, Math.round(focusMinutes)) : 0;
}

/** Side effects of a finished phase. */
export function handlePomodoroTransition(transition: NexusPomodoroTransition): void {
  const notify = useNotificationStore.getState().addNotification;
  const nexus = useNexusStore.getState();

  if (transition.completed === 'focus') {
    if (transition.late) {
      notify({
        type: 'info',
        title: 'NEXUS',
        message: `${transition.focusMinutes} min pomodoro tab band/away rehte hue khatam hua — XP sirf live sessions pe milta hai.`,
        icon: '⏱️',
      });
      return;
    }
    playNexusChime('focus-complete');
    const xp = pomodoroXp(transition.focusMinutes);
    if (xp > 0) useXPStore.getState().addXP(xp, 'pomodoro');
    if (transition.focusMinutes >= NEXUS_POMODORO_FULL_MINUTES) unlockNexusAchievement(NEXUS_ACHIEVEMENTS.pomodoro);
    const onBreak = useNexusStore.getState().pomodoro.phase === 'break';
    const text = `Focus session complete — ${transition.focusMinutes} min${xp > 0 ? `, +${xp} XP` : ''}.${
      onBreak ? ` Ab ${transition.breakMinutes} min break: uth, stretch kar, paani pee.` : ''
    }`;
    notify({ type: 'success', title: 'NEXUS', message: text, icon: '⏱️', autoDismiss: 8000 });
    nexus.pushNudge({ ruleId: 'pomodoro', text, tone: 'success', at: Date.now(), source: 'event' });
    return;
  }

  if (!transition.late) playNexusChime('break-complete');
  const text = 'Break over. Agla round shuru karein?';
  notify({ type: 'info', title: 'NEXUS', message: text, icon: '⏱️', autoDismiss: 8000 });
  nexus.pushNudge({
    ruleId: 'pomodoro',
    text,
    tone: 'info',
    at: Date.now(),
    source: 'event',
    action: { kind: 'command', label: 'Start pomodoro', command: { type: 'start_pomodoro' } },
  });
}

/** Invisible driver: advances the timer every second while one is active. */
function NexusPomodoroEngineInner() {
  const active = useNexusStore((s) => s.pomodoro.phase !== 'idle');

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const transition = useNexusStore.getState().advancePomodoro(Date.now());
      if (transition) handlePomodoroTransition(transition);
    };
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [active]);

  return null;
}

export const NexusPomodoroEngine = memo(NexusPomodoroEngineInner);

interface NexusPomodoroPillProps {
  /** 'hud' = floating pill on the desktop, 'inline' = compact chip in app headers */
  variant?: 'hud' | 'inline';
  className?: string;
}

function NexusPomodoroPillInner({ variant = 'hud', className }: NexusPomodoroPillProps) {
  const pomodoro = useNexusStore((s) => s.pomodoro);
  const [now, setNow] = useState(() => Date.now());
  const active = pomodoro.phase !== 'idle';

  useEffect(() => {
    if (!active) return;
    const refresh = () => setNow(Date.now());
    const first = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [active]);

  const paused = pomodoro.pausedRemainingMs !== null;
  const remaining = Math.min(pomodoroRemainingMs(pomodoro, now), pomodoro.phaseDurationMs);
  const progress = pomodoro.phaseDurationMs > 0 ? Math.min(1, Math.max(0, 1 - remaining / pomodoro.phaseDurationMs)) : 0;
  const isBreak = pomodoro.phase === 'break';

  const toggle = () => {
    const store = useNexusStore.getState();
    if (store.pomodoro.pausedRemainingMs !== null) store.resumePomodoro();
    else store.pausePomodoro();
  };
  const stop = () => useNexusStore.getState().stopPomodoro();

  const label = paused ? 'Paused' : isBreak ? 'Break' : 'Focus';

  if (variant === 'inline') {
    if (!active) return null;
    return (
      <span
        className={cn(
          'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2 font-mono text-2xs font-medium tabular ring-1 ring-inset',
          paused
            ? 'bg-surface-active text-fg-muted ring-line-strong'
            : isBreak
              ? 'bg-success/10 text-success ring-success/25'
              : 'bg-accent/10 text-accent ring-accent/25',
          className
        )}
        title={`Pomodoro ${label.toLowerCase()}`}
      >
        {paused ? (
          <Pause size={12} strokeWidth={2} aria-hidden />
        ) : isBreak ? (
          <Coffee size={12} strokeWidth={2} aria-hidden />
        ) : (
          <Timer size={12} strokeWidth={2} aria-hidden />
        )}
        {formatClock(remaining)}
      </span>
    );
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="nexus-pomodoro"
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'glass-popover pointer-events-auto relative flex h-10 items-center gap-2.5 overflow-hidden rounded-full pl-3.5 pr-1',
            className
          )}
          role="timer"
          aria-label={`Pomodoro ${label}: ${formatClock(remaining)} remaining`}
        >
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-full',
              paused ? 'text-fg-subtle' : isBreak ? 'text-success' : 'text-accent'
            )}
            aria-hidden
          >
            {isBreak ? <Coffee size={15} strokeWidth={1.75} /> : <Timer size={15} strokeWidth={1.75} />}
          </span>
          <span
            className={cn(
              'hud-label',
              paused ? 'text-warning' : isBreak ? 'text-success' : 'text-accent'
            )}
          >
            {label}
          </span>
          <span className="font-mono text-sm font-medium text-fg tabular">{formatClock(remaining)}</span>
          <span className="flex items-center">
            <IconButton
              icon={paused ? Play : Pause}
              iconSize={13}
              size="sm"
              onClick={toggle}
              aria-label={paused ? 'Resume pomodoro' : 'Pause pomodoro'}
              tooltip={paused ? 'Resume' : 'Pause'}
            />
            <IconButton
              icon={Square}
              iconSize={12}
              size="sm"
              variant="ghost-danger"
              onClick={stop}
              aria-label="Stop pomodoro"
              tooltip="Stop"
            />
          </span>
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-line" aria-hidden>
            <span
              className={cn(
                'block h-full transition-[width] duration-1000 ease-linear',
                paused ? 'bg-fg-subtle' : isBreak ? 'bg-success' : 'bg-accent'
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const NexusPomodoroPill = memo(NexusPomodoroPillInner);
