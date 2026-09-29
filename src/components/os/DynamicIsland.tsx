// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DynamicIsland Component (FORGE HUD)
// Hardware-black pill at the top centre that morphs between live
// activities. Compact shows the most important one (achievement >
// timer > music > creature > unread), with small indicators for the
// rest; click to expand into one row per activity. Hidden when idle.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bell, Coffee, Pause, Timer, Trophy } from 'lucide-react';
import { useAudioStore } from '@/stores/useAudioStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useXPStore } from '@/stores/useXPStore';
import { formatClock, pomodoroRemainingMs } from '@/lib/nexus/context';
import type { CreatureMood } from '@/types/creature';
import { cn } from '@/lib/utils';

// The creature sprite (canvas painters) is a lazy client-only chunk; the
// creature barrel would also drag the stats popup and recharts into the
// boot bundle.
const CreatureIslandBadge = dynamic(
  () => import('@/components/creature/CreatureStatusBadges').then((m) => m.CreatureIslandBadge),
  { ssr: false }
);

type IslandState = 'compact' | 'expanded';
type Activity = 'achievement' | 'timer' | 'music' | 'creature' | 'unread';

const EASE = [0.16, 1, 0.3, 1] as const;
const ACHIEVEMENT_MS = 7000;

/**
 * Moods the island surfaces, the same rule as useCreatureIslandSignal():
 * sad → amber warning (until fed), celebrating → a short success pulse.
 * Read straight from the store so the island needs no creature code.
 */
function isIslandMood(mood: CreatureMood): boolean {
  return mood === 'sad' || mood === 'dance' || mood === 'excited';
}

// ─── Live sources ───

interface RecentAchievement {
  id: string;
  title: string;
  xp: number;
}

/** The last achievement unlocked, for a few seconds after it lands. */
function useRecentAchievement(): RecentAchievement | null {
  const [recent, setRecent] = useState<RecentAchievement | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const unsubscribe = useXPStore.subscribe((state, prev) => {
      const unlock = state.recentUnlock;
      if (!unlock || unlock === prev.recentUnlock) return;
      setRecent({ id: unlock.id, title: unlock.title, xp: unlock.xpReward });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setRecent(null), ACHIEVEMENT_MS);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);
  return recent;
}

interface TimerStatus {
  label: string;
  clock: string;
  progress: number;
  isBreak: boolean;
  paused: boolean;
}

/** The NEXUS pomodoro, ticking once a second while it runs. */
function usePomodoroStatus(): TimerStatus | null {
  const pomodoro = useNexusStore((s) => s.pomodoro);
  const active = pomodoro.phase !== 'idle';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const refresh = () => setNow(Date.now());
    const first = window.setTimeout(refresh, 0);
    const id = window.setInterval(refresh, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);

  if (!active) return null;
  const paused = pomodoro.pausedRemainingMs !== null;
  const remaining = Math.min(pomodoroRemainingMs(pomodoro, now), pomodoro.phaseDurationMs);
  const progress =
    pomodoro.phaseDurationMs > 0 ? Math.min(1, Math.max(0, 1 - remaining / pomodoro.phaseDurationMs)) : 0;
  const isBreak = pomodoro.phase === 'break';
  return { label: paused ? 'Paused' : isBreak ? 'Break' : 'Focus', clock: formatClock(remaining), progress, isBreak, paused };
}

// ─── Small visuals ───

/** Four equalizer bars (static when motion is reduced). */
function EqBars({ still }: { still: boolean }) {
  const rest = [0.55, 0.9, 0.4, 0.7];
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {rest.map((h, i) =>
        still ? (
          <span key={i} className="w-[3px] rounded-full bg-accent" style={{ height: `${h * 100}%` }} />
        ) : (
          <motion.span
            key={i}
            className="h-full w-[3px] origin-bottom rounded-full bg-accent"
            initial={{ scaleY: h }}
            animate={{ scaleY: [h, 1, 0.35, 0.8, h] }}
            transition={{ duration: 1.1 + i * 0.12, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
          />
        )
      )}
    </span>
  );
}

/** 18px progress ring for the timer. */
function RingProgress({ progress, tone }: { progress: number; tone: 'accent' | 'success' }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-[18px] shrink-0 -rotate-90">
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-ink-600)" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        stroke={tone === 'success' ? 'var(--color-success)' : 'var(--accent)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}

function ExpandedRow({ icon, title, detail, trailing }: { icon: ReactNode; title: ReactNode; detail?: ReactNode; trailing?: ReactNode }) {
  return (
    <span className="flex items-center gap-3 py-1.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control border border-line-strong bg-ink-850">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ui font-medium text-fg">{title}</span>
        {detail != null && <span className="block truncate text-xs text-fg-subtle">{detail}</span>}
      </span>
      {trailing != null && <span className="shrink-0">{trailing}</span>}
    </span>
  );
}

// ─── Island ───

export function DynamicIsland() {
  const [state, setState] = useState<IslandState>('compact');
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const trackTitle = useAudioStore((s) => s.trackTitle);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const creatureVisible = useCreatureStore((s) => isIslandMood(s.mood));
  const achievement = useRecentAchievement();
  const timer = usePomodoroStatus();
  const reduceMotion = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);

  const activities: Activity[] = [];
  if (achievement) activities.push('achievement');
  if (timer) activities.push('timer');
  if (isPlaying) activities.push('music');
  if (creatureVisible) activities.push('creature');
  if (unreadCount > 0) activities.push('unread');
  const primary = activities[0];
  const expanded = state === 'expanded' && primary !== undefined;

  // Collapse on any press outside, or Escape.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setState('compact');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState('compact');
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const trackName = trackTitle || 'Focus music';
  const loud = primary === 'achievement';

  // ─── Compact: the primary activity + indicators for the rest ───
  const compactPrimary = (() => {
    switch (primary) {
      case 'achievement':
        return (
          <>
            <Trophy size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-gold" />
            <span className="min-w-0 max-w-[200px] truncate text-xs font-medium text-fg">{achievement?.title}</span>
            <span className="tabular shrink-0 font-mono text-2xs font-semibold text-gold">+{achievement?.xp} XP</span>
          </>
        );
      case 'timer':
        return (
          <>
            <RingProgress progress={timer?.progress ?? 0} tone={timer?.isBreak ? 'success' : 'accent'} />
            <span className="text-xs text-fg-muted">{timer?.label}</span>
            <span className={cn('tabular font-mono text-xs font-medium text-fg', timer?.paused && 'text-fg-subtle')}>
              {timer?.clock}
            </span>
          </>
        );
      case 'music':
        return (
          <>
            <EqBars still={reduceMotion} />
            <span className="min-w-0 max-w-[180px] truncate text-xs text-fg-muted">{trackName}</span>
          </>
        );
      case 'creature':
        return <CreatureIslandBadge />;
      case 'unread':
        return (
          <>
            <Bell size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-muted" />
            <span className="tabular text-xs text-fg-muted">
              <span className="font-medium text-fg">{unreadCount}</span> new
            </span>
          </>
        );
      default:
        return null;
    }
  })();

  const indicators = activities.slice(1);

  const summary = [
    achievement && `Achievement unlocked: ${achievement.title}`,
    timer && `${timer.label} ${timer.clock}`,
    isPlaying && `Playing ${trackName}`,
    creatureVisible && 'Companion needs attention',
    unreadCount > 0 && `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div ref={rootRef} className="fixed left-1/2 top-3 -translate-x-1/2" style={{ zIndex: 'var(--z-dynamic-island)' }}>
      <AnimatePresence>
        {primary !== undefined && (
          <motion.button
            key="island"
            type="button"
            layout={!reduceMotion}
            onClick={() => setState(expanded ? 'compact' : 'expanded')}
            aria-expanded={expanded}
            aria-label={`Activity: ${summary}. ${expanded ? 'Collapse' : 'Expand'}`}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.92, y: reduceMotion ? 0 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.94, transition: { duration: 0.16, ease: EASE } }}
            transition={{ duration: 0.26, ease: EASE, layout: { duration: 0.26, ease: EASE } }}
            style={{ borderRadius: expanded ? 22 : 18 }}
            className={cn(
              'block overflow-hidden border bg-ink-950/90 text-left backdrop-blur-xl lite:bg-ink-950',
              'inset-shadow-[0_1px_0_rgb(255_255_255/0.06)] shadow-e2 focus-ring',
              'transition-[border-color,box-shadow] duration-260 ease-out-quint',
              loud
                ? 'border-gold/40 shadow-[0_0_28px_-8px_var(--color-gold)]'
                : 'border-line-strong hover:border-fg-faint'
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {expanded ? (
                <motion.span
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.06 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="flex w-[340px] flex-col px-4 py-2.5"
                >
                  <span className="hud-label pb-1 pt-0.5">Live activity</span>
                  {achievement && (
                    <ExpandedRow
                      icon={<Trophy size={16} strokeWidth={1.75} className="text-gold" />}
                      title={achievement.title}
                      detail="Achievement unlocked"
                      trailing={<span className="tabular font-mono text-xs font-semibold text-gold">+{achievement.xp} XP</span>}
                    />
                  )}
                  {timer && (
                    <ExpandedRow
                      icon={
                        timer.paused ? (
                          <Pause size={16} strokeWidth={1.75} className="text-fg-muted" />
                        ) : timer.isBreak ? (
                          <Coffee size={16} strokeWidth={1.75} className="text-success" />
                        ) : (
                          <Timer size={16} strokeWidth={1.75} className="text-accent" />
                        )
                      }
                      title={`Pomodoro · ${timer.label}`}
                      detail={`${Math.round(timer.progress * 100)}% of this ${timer.isBreak ? 'break' : 'session'}`}
                      trailing={<span className="tabular font-mono text-sm font-medium text-fg">{timer.clock}</span>}
                    />
                  )}
                  {isPlaying && (
                    <ExpandedRow icon={<EqBars still={reduceMotion} />} title={trackName} detail="Now playing" />
                  )}
                  {creatureVisible && (
                    <span className="py-1.5">
                      <CreatureIslandBadge expanded />
                    </span>
                  )}
                  {unreadCount > 0 && (
                    <ExpandedRow
                      icon={<Bell size={16} strokeWidth={1.75} className="text-fg-muted" />}
                      title={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`}
                      detail="Open the bell in the taskbar to read them"
                    />
                  )}
                </motion.span>
              ) : (
                <motion.span
                  key="compact"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.18, delay: 0.04 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="flex h-9 min-w-[132px] items-center gap-2 pl-3.5 pr-3"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">{compactPrimary}</span>
                  {indicators.length > 0 && (
                    <span className="ml-1 flex shrink-0 items-center gap-1.5 border-l border-line pl-2.5 text-fg-subtle">
                      {indicators.includes('timer') && <Timer size={12} strokeWidth={2} aria-hidden className="text-accent" />}
                      {indicators.includes('music') && <EqBars still />}
                      {indicators.includes('creature') && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
                      {indicators.includes('unread') && (
                        <span className="tabular flex items-center gap-1 font-mono text-2xs">
                          <Bell size={12} strokeWidth={2} aria-hidden />
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
