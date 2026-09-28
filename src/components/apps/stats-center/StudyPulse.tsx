// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Pulse
// Today's learning at a glance: cards due for review today (with a
// jump into the Training Grounds review queue), cards mastered,
// and answer accuracy over the last seven days.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { useLearningStore } from '@/stores/useLearningStore';
import { useNow } from '@/components/widgets/hooks';
import { openTrainingGrounds } from '@/components/widgets/os-events';
import { ACCURACY_DAYS, MASTERY_COLOR, summarizeLearning } from './learning-stats';

interface TileProps {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  children?: ReactNode;
}

function Tile({ label, value, sub, children }: TileProps) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] text-white/55">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-white">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-white/40">{sub}</p>
      {children}
    </div>
  );
}

function StudyPulseInner() {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const attempts = useLearningStore((s) => s.attempts);
  // Minute tick: cards fall due as time passes, without any store change.
  const now = useNow(60_000);
  const summary = useMemo(
    () => summarizeLearning(decks, reviews, attempts, now),
    [decks, reviews, attempts, now]
  );

  const { mastery, dueNow, dueToday, newCards, recentAnswers, recentAccuracy } = summary;
  const masteryPct = Math.round(mastery.value * 100);
  const canReview = dueNow + newCards > 0;

  return (
    <div className="grid grid-cols-1 gap-3 @sm:grid-cols-3">
      <Tile
        label="Due today"
        value={mastery.total === 0 ? '—' : dueToday}
        sub={
          mastery.total === 0
            ? 'No cards yet'
            : dueToday === 0 && newCards === 0
              ? 'All caught up'
              : `${dueNow} ready now · ${newCards} new`
        }
      >
        {canReview && (
          <button
            type="button"
            onClick={() => openTrainingGrounds('flashcards')}
            className="mt-2 self-start rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200 transition-colors hover:bg-cyan-500/20 focus-ring"
          >
            Review now
          </button>
        )}
      </Tile>

      <Tile
        label="Cards mastered"
        value={
          <>
            {mastery.mastered}
            <span className="text-sm font-semibold text-white/40"> / {mastery.total}</span>
          </>
        }
        sub={`${masteryPct}% overall mastery · ${mastery.seen} studied`}
      >
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Overall mastery"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={masteryPct}
        >
          <div className="h-full rounded-full" style={{ width: `${masteryPct}%`, background: MASTERY_COLOR }} />
        </div>
      </Tile>

      <Tile
        label={`Accuracy · ${ACCURACY_DAYS} days`}
        value={recentAccuracy === null ? '—' : `${Math.round(recentAccuracy * 100)}%`}
        sub={
          recentAnswers === 0
            ? 'No answers this week'
            : `${recentAnswers} ${recentAnswers === 1 ? 'answer' : 'answers'} this week`
        }
      />
    </div>
  );
}

export const StudyPulse = memo(StudyPulseInner);
