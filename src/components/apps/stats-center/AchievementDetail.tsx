// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Detail
// Dialog for one gallery badge: large medallion (spins in when
// unlocked), title, description, rarity, category, XP reward and the
// unlock date. Hidden locked badges stay secret. ←/→ step, Esc closes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, ChevronLeft, ChevronRight, Lock, X, Zap } from 'lucide-react';
import type { Achievement } from '@/types/achievement';
import { CATEGORY_LABEL, RARITY_STYLE } from '@/components/effects/effects-utils';
import { cn } from '@/lib/utils';
import { Badge, Button, Dialog, IconButton } from '@/components/ui';
import { AchievementBadge } from './AchievementBadge';
import { formatUnlockDateTime, tint } from './achievement-data';

interface AchievementDetailProps {
  /** The badge on show; null closes the dialog. */
  achievement: Achievement | null;
  /** Position within the currently filtered list (0-based). */
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function AchievementDetailInner({ achievement, index, total, onClose, onPrev, onNext }: AchievementDetailProps) {
  const reduceMotion = useReducedMotion();
  // Keep the last badge on screen while the dialog animates out.
  const [last, setLast] = useState<Achievement | null>(achievement);
  if (achievement && achievement !== last) setLast(achievement);
  const shown = achievement ?? last;
  const open = achievement !== null;

  const navRef = useRef({ onPrev, onNext });
  useEffect(() => {
    navRef.current = { onPrev, onNext };
  });

  // ←/→ step through the filtered list while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navRef.current.onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navRef.current.onNext();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!shown) return null;

  const unlocked = !!shown.unlockedAt;
  const secret = !unlocked && !!shown.hidden;
  const rarity = RARITY_STYLE[shown.rarity] ?? RARITY_STYLE.common;
  const heading = secret ? 'Hidden achievement' : shown.title;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      showClose={false}
      title={<span className="sr-only">{heading}</span>}
      footer={
        total > 1 ? (
          <div className="flex w-full items-center justify-between">
            <Button size="sm" variant="ghost" leadingIcon={ChevronLeft} onClick={onPrev} aria-label="Previous achievement">
              Prev
            </Button>
            <span className="tabular font-mono text-xs text-fg-subtle">
              {index + 1} / {total}
            </span>
            <Button size="sm" variant="ghost" trailingIcon={ChevronRight} onClick={onNext} aria-label="Next achievement">
              Next
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="relative -mt-5 flex flex-col items-center pt-1 text-center">
        <span className="absolute -right-2 -top-1 z-10">
          <IconButton icon={X} size="sm" aria-label="Close achievement details" onClick={onClose} />
        </span>

        {/* Rarity wash behind the medallion */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full blur-2xl"
          style={{ background: unlocked ? tint(rarity.color, 18) : 'transparent' }}
        />

        <div className="relative flex justify-center pt-2" style={{ perspective: 600 }}>
          <motion.div
            key={shown.id}
            initial={reduceMotion ? false : { rotateY: unlocked ? -180 : 0, scale: 0.85, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            transition={{ duration: unlocked ? 0.7 : 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <AchievementBadge achievement={shown} size={96} />
          </motion.div>
        </div>

        <p
          className="relative mt-4 font-mono text-2xs font-medium uppercase tracking-[0.14em]"
          style={{ color: unlocked ? rarity.color : undefined }}
        >
          <span className={unlocked ? undefined : 'text-fg-subtle'}>
            {secret ? 'Hidden achievement' : unlocked ? 'Unlocked' : 'Locked'}
          </span>
        </p>
        <h3 className="relative mt-1 text-lg font-semibold text-fg">{secret ? '???' : shown.title}</h3>
        <p className="relative mx-auto mt-1 max-w-xs text-ui text-fg-muted">
          {secret ? 'A secret badge. Keep exploring Warrior OS to reveal it.' : shown.description}
        </p>

        <div className="relative mt-4 flex flex-wrap items-center justify-center gap-1.5">
          <span
            className="inline-flex h-5 items-center gap-1.5 rounded-full px-2 font-mono text-2xs font-medium uppercase tracking-[0.08em] ring-1 ring-inset"
            style={{ color: rarity.color, background: tint(rarity.color, 12), '--tw-ring-color': tint(rarity.color, 30) } as CSSProperties}
          >
            <span className="size-1.5 rounded-full" style={{ background: rarity.color }} />
            {rarity.label}
          </span>
          <Badge tone="neutral">{CATEGORY_LABEL[shown.category]}</Badge>
          <Badge tone="gold" icon={Zap}>
            +{shown.xpReward} XP
          </Badge>
        </div>

        <div
          className={cn(
            'relative mt-4 flex w-full items-center justify-center gap-2 rounded-control px-3 py-2 text-xs',
            unlocked ? 'bg-surface-hover text-fg-muted' : 'bg-ink-950/40 text-fg-subtle'
          )}
        >
          {unlocked && shown.unlockedAt ? (
            <>
              <CalendarCheck size={14} strokeWidth={1.75} style={{ color: rarity.color }} aria-hidden />
              Unlocked {formatUnlockDateTime(shown.unlockedAt)}
            </>
          ) : (
            <>
              <Lock size={14} strokeWidth={1.75} aria-hidden />
              Not unlocked yet
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export const AchievementDetail = memo(AchievementDetailInner);
