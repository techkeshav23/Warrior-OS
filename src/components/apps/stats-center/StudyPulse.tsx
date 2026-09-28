// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Study Pulse
// Today's learning at a glance: cards due for review today (with a
// jump into the Training Grounds review queue), cards mastered,
// and answer accuracy over the last seven days.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, type ReactNode } from 'react';
import { ArrowRight, CalendarClock, CircleCheck, Crosshair, Layers } from 'lucide-react';
import { Button, ProgressBar, StatTile } from '@/components/ui';
import { useLearningStore } from '@/stores/useLearningStore';
import { useNow } from '@/components/widgets/hooks';
import { openTrainingGrounds } from '@/components/widgets/os-events';
import { ACCURACY_COLOR, ACCURACY_DAYS, MASTERY_COLOR, summarizeLearning } from './learning-stats';

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
  const accuracyPct = recentAccuracy === null ? null : Math.round(recentAccuracy * 100);
  const canReview = dueNow + newCards > 0;

  return (
    <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
      <PulseTile
        footer={
          canReview ? (
            <Button size="sm" variant="secondary" fullWidth trailingIcon={ArrowRight} onClick={() => openTrainingGrounds('flashcards')}>
              Review now
            </Button>
          ) : (
            <p className="flex h-7 items-center gap-1.5 text-xs text-fg-subtle">
              <CircleCheck size={14} strokeWidth={1.75} className="text-success" aria-hidden />
              {mastery.total === 0 ? 'Create a deck to start' : 'Queue is clear'}
            </p>
          )
        }
      >
        <StatTile
          bare
          size="sm"
          label="Due today"
          icon={CalendarClock}
          value={mastery.total === 0 ? '—' : dueToday}
          deltaLabel={
            mastery.total === 0
              ? 'No cards yet'
              : dueToday === 0 && newCards === 0
                ? 'All caught up'
                : `${dueNow} ready · ${newCards} new`
          }
        />
      </PulseTile>

      <PulseTile
        footer={
          <ProgressBar value={masteryPct} size="sm" color={MASTERY_COLOR} animated={false} aria-label="Overall mastery" />
        }
      >
        <StatTile
          bare
          size="sm"
          label="Cards mastered"
          icon={Layers}
          value={mastery.mastered}
          unit={`/ ${mastery.total}`}
          deltaLabel={`${masteryPct}% · ${mastery.seen} studied`}
        />
      </PulseTile>

      <PulseTile
        footer={
          <ProgressBar
            value={accuracyPct ?? 0}
            size="sm"
            color={ACCURACY_COLOR}
            animated={false}
            aria-label={`Accuracy over ${ACCURACY_DAYS} days`}
          />
        }
      >
        <StatTile
          bare
          size="sm"
          label={`Accuracy · ${ACCURACY_DAYS}d`}
          icon={Crosshair}
          value={accuracyPct === null ? '—' : accuracyPct}
          unit={accuracyPct === null ? undefined : '%'}
          deltaLabel={
            recentAnswers === 0
              ? 'No answers this week'
              : `${recentAnswers} ${recentAnswers === 1 ? 'answer' : 'answers'} this week`
          }
        />
      </PulseTile>
    </div>
  );
}

function PulseTile({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="glass-panel flex min-w-0 flex-col gap-4 rounded-card p-4">
      {children}
      <div className="mt-auto">{footer}</div>
    </div>
  );
}

export const StudyPulse = memo(StudyPulseInner);
