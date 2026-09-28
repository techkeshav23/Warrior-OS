// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Detail
// Dialog card for one gallery badge: large badge (spins in when
// unlocked), title, description, rarity, category, XP reward and the
// unlock date. Hidden locked badges stay secret. ←/→ step, Esc closes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import type { Achievement } from '@/types/achievement';
import { CATEGORY_LABEL, RARITY_STYLE, withAlpha } from '@/components/effects/effects-utils';
import { cn } from '@/lib/utils';
import { AchievementBadge } from './AchievementBadge';
import { formatUnlockDateTime } from './achievement-data';

interface AchievementDetailProps {
  achievement: Achievement;
  /** Position within the currently filtered list (0-based). */
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function AchievementDetailInner({ achievement, index, total, onClose, onPrev, onNext }: AchievementDetailProps) {
  const titleId = useId();
  const unlocked = !!achievement.unlockedAt;
  const secret = !unlocked && !!achievement.hidden;
  const rarity = RARITY_STYLE[achievement.rarity];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="relative w-full max-w-sm rounded-xl border p-5 text-center"
      style={{
        background: 'rgba(12, 12, 20, 0.97)',
        borderColor: unlocked ? withAlpha(rarity.color, 0.4) : 'rgba(255, 255, 255, 0.1)',
        boxShadow: unlocked ? `0 0 44px ${rarity.glow}` : '0 10px 40px rgba(0, 0, 0, 0.55)',
      }}
      initial={{ y: 20, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 10, opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        type="button"
        onClick={onClose}
        autoFocus
        aria-label="Close achievement details"
        className="absolute right-3 top-3 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex justify-center" style={{ perspective: 600 }}>
        <motion.div
          key={achievement.id}
          initial={{ rotateY: unlocked ? -180 : 0, scale: 0.85, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          transition={{ duration: unlocked ? 0.7 : 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <AchievementBadge achievement={achievement} size={96} />
        </motion.div>
      </div>

      <p
        className="mt-4 text-[10px] font-bold uppercase tracking-[0.3em]"
        style={{ color: unlocked ? rarity.color : 'rgba(255, 255, 255, 0.45)' }}
      >
        {secret ? 'Hidden achievement' : unlocked ? 'Unlocked' : 'Locked'}
      </p>
      <h3 id={titleId} className="mt-1 text-lg font-bold text-white">
        {secret ? '???' : achievement.title}
      </h3>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-relaxed text-white/65">
        {secret ? 'A secret badge. Keep exploring Warrior OS to reveal it.' : achievement.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span
          className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: rarity.color,
            borderColor: withAlpha(rarity.color, 0.4),
            background: withAlpha(rarity.color, 0.1),
          }}
        >
          {rarity.label}
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/65">
          {CATEGORY_LABEL[achievement.category]}
        </span>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-200">
          +{achievement.xpReward} XP
        </span>
      </div>

      <div
        className={cn(
          'mt-4 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs',
          unlocked ? 'border-white/10 bg-white/5 text-white/80' : 'border-white/5 bg-black/30 text-white/50'
        )}
      >
        {unlocked && achievement.unlockedAt ? (
          <>
            <CalendarCheck className="h-3.5 w-3.5" style={{ color: rarity.color }} />
            Unlocked {formatUnlockDateTime(achievement.unlockedAt)}
          </>
        ) : (
          <>
            <Lock className="h-3.5 w-3.5" />
            Not unlocked yet
          </>
        )}
      </div>

      {total > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous achievement"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="font-mono text-[10px] text-white/45">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next achievement"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

export const AchievementDetail = memo(AchievementDetailInner);
