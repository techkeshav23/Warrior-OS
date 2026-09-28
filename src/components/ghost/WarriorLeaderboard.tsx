// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Leaderboard
// Glass panel (toggled from the tray OnlineCounter): "Today's Top
// Warriors" — top 10 anonymous warriors by focused hours today, with
// quizzes and streak. Your own row is highlighted (and your rank is
// shown even outside the top 10). Updates live from the ghost store.
// Simulated data is labelled as such.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Clock, Flame, Radio, Trophy, X } from 'lucide-react';
import { rankWarriors, useGhostStore } from '@/stores/useGhostStore';
import { cn } from '@/lib/utils';
import { WarCryComposer } from './WarCrySystem';

interface WarriorLeaderboardProps {
  /** Controlled open state; defaults to the ghost store's leaderboardOpen. */
  isOpen?: boolean;
  onClose?: () => void;
  /** Open under a top-right counter, or above the taskbar tray. */
  anchor?: 'top' | 'bottom';
}

const RANK_COLORS = ['text-accent-warning', 'text-text-primary', 'text-accent-tertiary'];

function ModeBanner() {
  const mode = useGhostStore((s) => s.mode);
  const lastError = useGhostStore((s) => s.lastError);
  if (mode === 'realtime') {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-accent-success">
        <Radio size={11} /> Live · anonymous warriors studying right now
        {lastError && <span className="text-accent-warning"> · {lastError}</span>}
      </p>
    );
  }
  if (mode === 'connecting') {
    return (
      <p className="mb-3 text-[11px] text-text-secondary">
        Connecting to the campfire…{lastError ? ` (${lastError})` : ''}
      </p>
    );
  }
  return (
    <div className="mb-3 rounded-lg border border-accent-warning/30 bg-accent-warning/10 px-2.5 py-1.5 text-[11px] text-accent-warning">
      <p className="font-semibold">Offline campfire</p>
      <p className="text-accent-warning/80">
        Your other open tabs are real; SIM warriors are simulated.{' '}
        {lastError ?? 'Set NEXT_PUBLIC_FIREBASE_DATABASE_URL to meet real warriors.'}
      </p>
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
            'glass-border fixed right-3 w-80 rounded-xl p-4 shadow-2xl',
            anchor === 'top' ? 'top-14' : 'bottom-14'
          )}
          style={{ zIndex: 'var(--z-notification)', background: 'rgba(12, 12, 20, 0.95)', backdropFilter: 'blur(20px)' }}
          initial={{ opacity: 0, y: anchor === 'top' ? -12 : 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: anchor === 'top' ? -12 : 12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          role="dialog"
          aria-label="Today's top warriors"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-accent-warning" />
              <h3 className="font-display text-sm text-text-primary text-glow-sm">Today&apos;s Top Warriors</h3>
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary focus-ring"
              aria-label="Close leaderboard"
            >
              <X size={14} />
            </button>
          </div>

          <ModeBanner />

          <p className="mb-2 flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-success" />
            {onlineCount} warrior{onlineCount === 1 ? '' : 's'} online
          </p>

          <div className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto">
            {top.length === 0 && <p className="py-6 text-center text-xs text-text-secondary">No warriors online yet.</p>}
            {top.map((w, i) => (
              <div
                key={w.anonymousId}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                  w.isSelf ? 'border border-accent-primary/50 bg-accent-primary/10 neon-border' : 'bg-white/5 hover:bg-white/10'
                )}
              >
                <span className={cn('w-5 text-center font-mono text-xs font-bold', RANK_COLORS[i] ?? 'text-text-secondary')}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-mono text-xs', w.isSelf ? 'text-accent-primary' : 'text-text-primary')}>
                    {w.anonymousId}
                    {w.isSelf && <span className="ml-1 text-[10px] text-accent-primary/70">(you)</span>}
                    {w.isLocalTab && (
                      <span className="ml-1 rounded bg-accent-primary/15 px-1 text-[9px] text-accent-primary">TAB</span>
                    )}
                    {w.isSimulated && (
                      <span className="ml-1 rounded bg-accent-warning/15 px-1 text-[9px] text-accent-warning">SIM</span>
                    )}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2.5 text-[10px] text-text-secondary">
                    <span className="flex items-center gap-0.5" title="Focused hours today">
                      <Clock size={9} /> {w.studyHoursToday.toFixed(1)}h
                    </span>
                    <span className="flex items-center gap-0.5" title="Quizzes today">
                      <BookOpen size={9} /> {w.quizzesToday}
                    </span>
                    <span className="flex items-center gap-0.5 text-accent-tertiary" title="Day streak">
                      <Flame size={9} /> {w.streak}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selfIndex >= 10 && (
            <p className="mt-2 rounded-lg border border-accent-primary/30 bg-accent-primary/5 px-2 py-1 font-mono text-[11px] text-accent-primary">
              Your rank: #{selfIndex + 1} of {onlineCount}
            </p>
          )}

          <div className="mt-3 border-t border-white/10 pt-3">
            <WarCryComposer compact />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const WarriorLeaderboard = memo(WarriorLeaderboardInner);
