// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Leaderboard
// Glass popover (toggled from the tray OnlineCounter): "Today's top
// warriors": the top 10 anonymous warriors by focused hours today, with
// quizzes and streak. Top three get gold / steel / ember rank marks;
// your own row is highlighted (and your rank is shown even outside the
// top 10). Live, connecting and offline states each have their own
// status line; the war-cry composer sits in the footer. Updates live
// from the ghost store. Simulated data is labelled as such.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Clock, Flame, LoaderCircle, Trophy, Users, WifiOff, X } from 'lucide-react';
import { rankWarriors, useGhostStore } from '@/stores/useGhostStore';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { cn } from '@/lib/utils';
import { WarCryComposer } from './WarCrySystem';

interface WarriorLeaderboardProps {
  /** Controlled open state; defaults to the ghost store's leaderboardOpen. */
  isOpen?: boolean;
  onClose?: () => void;
  /** Open under a top-right counter, or above the taskbar tray. */
  anchor?: 'top' | 'bottom';
}

/** Rank marks for the podium: gold, steel, ember. */
const PODIUM = [
  'bg-gold/14 text-gold ring-gold/35',
  'bg-fg-muted/12 text-fg ring-fg-muted/30',
  'bg-ember-400/14 text-ember-300 ring-ember-400/35',
];

function ModeLine({ onlineCount }: { onlineCount: number }) {
  const mode = useGhostStore((s) => s.mode);
  const lastError = useGhostStore((s) => s.lastError);

  if (mode === 'realtime') {
    return (
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        <Badge tone="success" dot pulse size="sm">
          Live
        </Badge>
        <span className="tabular">
          {onlineCount} warrior{onlineCount === 1 ? '' : 's'} online
        </span>
        {lastError && (
          <span className="truncate text-warning" title={lastError}>
            · {lastError}
          </span>
        )}
      </div>
    );
  }
  if (mode === 'connecting') {
    return (
      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <LoaderCircle size={14} strokeWidth={1.75} className="animate-spin text-fg-subtle" aria-hidden />
        <span className="truncate" title={lastError ?? undefined}>
          Connecting to the campfire…{lastError ? ` (${lastError})` : ''}
        </span>
      </p>
    );
  }
  return (
    <div className="flex gap-2.5 rounded-control bg-warning/8 px-3 py-2 ring-1 ring-inset ring-warning/20">
      <WifiOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-warning">
          Offline campfire <span className="font-normal text-fg-subtle tabular">· {onlineCount} here</span>
        </p>
        <p className="mt-0.5 text-fg-muted">
          Your other open tabs are real; SIM warriors are simulated.{' '}
          {lastError ?? (
            <>
              Set <code className="font-mono text-2xs text-fg">NEXT_PUBLIC_FIREBASE_DATABASE_URL</code> to meet real
              warriors.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function WarriorLeaderboardInner({ isOpen, onClose, anchor = 'top' }: WarriorLeaderboardProps) {
  const storeOpen = useGhostStore((s) => s.leaderboardOpen);
  const setLeaderboardOpen = useGhostStore((s) => s.setLeaderboardOpen);
  const warriors = useGhostStore((s) => s.onlineWarriors);
  const open = isOpen ?? storeOpen;

  const ranked = useMemo(() => rankWarriors(warriors), [warriors]);
  const top = ranked.slice(0, 10);
  const selfIndex = ranked.findIndex((w) => w.isSelf);
  const onlineCount = ranked.length;

  const close = () => {
    if (onClose) onClose();
    else setLeaderboardOpen(false);
  };

  // Escape closes the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (onClose) onClose();
      else setLeaderboardOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, setLeaderboardOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            'glass-popover fixed right-3 flex w-[336px] flex-col rounded-card',
            anchor === 'top' ? 'top-14' : 'bottom-14'
          )}
          style={{
            zIndex: 'var(--z-notification)',
            transformOrigin: anchor === 'top' ? 'top right' : 'bottom right',
          }}
          initial={{ opacity: 0, y: anchor === 'top' ? -6 : 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: anchor === 'top' ? -4 : 4, scale: 0.98, transition: { duration: 0.14 } }}
          transition={{ duration: 0.26, ease: EASE_OUT_QUINT }}
          role="dialog"
          aria-label="Today's top warriors"
        >
          {/* Header */}
          <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-gold/12 ring-1 ring-inset ring-gold/25">
              <Trophy size={16} strokeWidth={1.75} className="text-gold" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-fg">Today&apos;s top warriors</h3>
              <p className="hud-label mt-0.5">Focused hours · anonymous</p>
            </div>
            <IconButton icon={X} aria-label="Close leaderboard" size="sm" onClick={close} />
          </div>

          <div className="px-4 pb-3">
            <ModeLine onlineCount={onlineCount} />
          </div>

          {/* Ranking */}
          <div className="border-t border-line">
            {top.length === 0 ? (
              <EmptyState
                size="sm"
                icon={Users}
                title="No warriors online yet"
                description="Warriors appear here as they join the campfire."
              />
            ) : (
              <ol className="scrollbar-thin flex max-h-[45vh] flex-col gap-0.5 overflow-y-auto p-1.5" aria-label="Ranking">
                {top.map((w, i) => (
                  <li
                    key={w.anonymousId}
                    className={cn(
                      'relative flex items-center gap-3 rounded-control px-2.5 py-1.5 transition-colors duration-120 ease-out-quint',
                      w.isSelf ? 'bg-accent/10 ring-1 ring-inset ring-accent/30' : 'hover:bg-surface-hover'
                    )}
                    aria-current={w.isSelf ? 'true' : undefined}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-2xs font-semibold tabular',
                        i < 3 ? cn('ring-1 ring-inset', PODIUM[i]) : 'text-fg-subtle'
                      )}
                      aria-label={`Rank ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn('truncate font-mono text-ui', w.isSelf ? 'text-accent' : 'text-fg')}
                          title={w.anonymousId}
                        >
                          {w.anonymousId}
                        </span>
                        {w.isSelf && (
                          <Badge tone="accent" size="sm">
                            You
                          </Badge>
                        )}
                        {w.isLocalTab && (
                          <Badge tone="info" size="sm">
                            Tab
                          </Badge>
                        )}
                        {w.isSimulated && (
                          <Badge tone="warning" size="sm">
                            Sim
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 flex items-center gap-3 text-2xs text-fg-subtle tabular">
                        <span className="flex items-center gap-1" title="Quizzes today">
                          <BookOpen size={12} strokeWidth={1.75} aria-hidden /> {w.quizzesToday}
                        </span>
                        <span className="flex items-center gap-1 text-ember-300/90" title="Day streak">
                          <Flame size={12} strokeWidth={1.75} aria-hidden /> {w.streak}
                        </span>
                      </p>
                    </div>
                    <span
                      className="flex shrink-0 items-center gap-1 font-mono text-ui font-medium text-fg tabular"
                      title="Focused hours today"
                    >
                      <Clock size={12} strokeWidth={1.75} className="text-fg-subtle" aria-hidden />
                      {w.studyHoursToday.toFixed(1)}
                      <span className="text-2xs text-fg-subtle">h</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {selfIndex >= 10 && (
            <p className="mx-3 mb-2 flex items-center justify-between rounded-control bg-accent/8 px-3 py-1.5 text-xs ring-1 ring-inset ring-accent/25">
              <span className="text-fg-muted">Your rank</span>
              <span className="font-mono font-medium text-accent tabular">
                #{selfIndex + 1} of {onlineCount}
              </span>
            </p>
          )}

          {/* War cry */}
          <div className="border-t border-line px-4 pb-4 pt-3">
            <WarCryComposer compact />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const WarriorLeaderboard = memo(WarriorLeaderboardInner);
