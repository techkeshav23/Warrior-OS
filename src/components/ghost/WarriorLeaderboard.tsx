// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior Leaderboard
// Toggleable glass panel: Today's Top Warriors (anonymous).
// Sorted by study hours. Own rank highlighted. Updates live.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, BookOpen, Clock, X } from 'lucide-react';
import { useGhostStore } from '@/stores/useGhostStore';
import { cn } from '@/lib/utils';
import { WarCryComposer } from './WarCrySystem';

interface WarriorLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

const RANK_COLORS = ['text-accent-warning', 'text-text-secondary', 'text-accent-tertiary'];

function WarriorLeaderboardInner({ isOpen, onClose }: WarriorLeaderboardProps) {
  const leaderboard = useGhostStore((s) => s.getLeaderboard(10));
  const selfId = useGhostStore((s) => s.selfId);
  const onlineCount = useGhostStore((s) => s.getOnlineCount());

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="glass-dark glass-border fixed right-3 top-14 w-80 rounded-xl p-4 shadow-2xl"
          style={{ zIndex: 'var(--z-notification)' }}
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-accent-warning" />
              <h3 className="font-display text-sm text-text-primary text-glow-sm">
                Today&apos;s Top Warriors
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary focus-ring"
              aria-label="Close leaderboard"
            >
              <X size={14} />
            </button>
          </div>

          <p className="mb-3 flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-success" />
            {onlineCount} warrior{onlineCount === 1 ? '' : 's'} studying right now
          </p>

          {/* List */}
          <div className="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
            {leaderboard.length === 0 && (
              <p className="py-6 text-center text-xs text-text-muted">
                No warriors online yet.
              </p>
            )}
            {leaderboard.map((w, i) => {
              const isSelf = w.anonymousId === selfId;
              return (
                <div
                  key={w.anonymousId}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
                    isSelf
                      ? 'border border-accent-primary/50 bg-accent-primary/10 neon-border'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <span
                    className={cn(
                      'w-5 text-center font-mono text-xs font-bold',
                      RANK_COLORS[i] ?? 'text-text-muted'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate font-mono text-xs',
                        isSelf ? 'text-accent-primary' : 'text-text-primary'
                      )}
                    >
                      {w.anonymousId}
                      {isSelf && <span className="ml-1 text-[10px] text-accent-primary/70">(you)</span>}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2.5 text-[10px] text-text-secondary">
                      <span className="flex items-center gap-0.5">
                        <Clock size={9} /> {w.studyHoursToday.toFixed(1)}h
                      </span>
                      <span className="flex items-center gap-0.5">
                        <BookOpen size={9} /> {w.quizzesToday}
                      </span>
                      <span className="flex items-center gap-0.5 text-accent-tertiary">
                        <Flame size={9} /> {w.streak}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* War cry composer */}
          <div className="mt-3 border-t border-white/10 pt-3">
            <WarCryComposer compact />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const WarriorLeaderboard = memo(WarriorLeaderboardInner);
