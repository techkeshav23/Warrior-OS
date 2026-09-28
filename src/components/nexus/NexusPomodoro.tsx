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
          'flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
          isBreak ? 'border-emerald-400/30 text-emerald-300' : 'border-cyan-400/30 text-cyan-300',
          paused && 'opacity-70',
          className
        )}
        title={`Pomodoro ${label.toLowerCase()}`}
      >
        {isBreak ? <Coffee size={11} /> : <Timer size={11} />}
        {formatClock(remaining)}
      </span>
    );
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="nexus-pomodoro"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'pointer-events-auto relative flex items-center gap-2 overflow-hidden rounded-full border bg-black/85 py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur-xl',
            isBreak ? 'border-emerald-400/30' : 'border-cyan-400/30',
            className
          )}
          role="timer"
          aria-label={`Pomodoro ${label}: ${formatClock(remaining)} remaining`}
        >
          {isBreak ? (
            <Coffee size={13} className="text-emerald-300" />
          ) : (
            <Timer size={13} className="text-cyan-300" />
          )}
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.15em]',
              paused ? 'text-amber-300' : isBreak ? 'text-emerald-300/80' : 'text-cyan-300/80'
            )}
          >
            {label}
          </span>
          <span className="font-mono text-sm tabular-nums text-white">{formatClock(remaining)}</span>
          <button
            type="button"
            onClick={toggle}
            className="rounded-full p-1 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            aria-label={paused ? 'Resume pomodoro' : 'Pause pomodoro'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={12} /> : <Pause size={12} />}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-full p-1 text-white/65 transition-colors hover:bg-white/10 hover:text-rose-300"
            aria-label="Stop pomodoro"
            title="Stop"
          >
            <Square size={11} />
          </button>
          <span
            className={cn('absolute bottom-0 left-0 h-[2px]', isBreak ? 'bg-emerald-400/70' : 'bg-cyan-400/70')}
            style={{ width: `${progress * 100}%` }}
            aria-hidden
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const NexusPomodoroPill = memo(NexusPomodoroPillInner);
