// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quest Planner
// Goal + target date + decks → a daily plan: unseen cards spread
// over the days left, reviews kept on schedule, a rotating topic
// quiz and a boss fight on the target day. Today's quests tick
// themselves off from real study activity (or by hand). The plan
// lives in the quest plan store; the schedule is derived live.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Crosshair, Flag, Pencil, Play, Repeat, Sparkles, Swords, Trophy, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLearningStore } from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import { launchTraining, type TrainingLauncher } from './practice/launch';
import { masteryColor, toPercent } from './practice/mastery';
import { buildPlanView, PLAN_DAYS_SHOWN, type PlanDay, type Quest, type QuestKind } from './practice/quest-plan';
import { useQuestPlanStore, type QuestPlanInput } from './practice/quest-plan-store';
import { QuestPlanForm } from './practice/QuestPlanForm';
import { dayKeyOf, relativeDayLabel, shortDateLabel, utcDayStart, weekdayLabel } from './practice/schedule';

interface StudyPlannerProps {
  /** Opens a mode on a deck/topic (from TrainingGroundsApp); the start event is used without it. */
  onStart?: TrainingLauncher;
}

/** Schedule rows shown before "show all". */
const DAYS_PREVIEW = 14;
const NO_TICKS: readonly string[] = [];

/** Schedule series colours (validated on dark surfaces). */
const NEW_COLOR = '#a855f7';
const REVIEW_COLOR = '#0891b2';

const QUEST_ICONS: Readonly<Record<QuestKind, LucideIcon>> = {
  boss: Swords,
  review: Repeat,
  learn: Sparkles,
  quiz: Crosshair,
};

const START_LABELS: Readonly<Record<QuestKind, string>> = {
  boss: 'Fight',
  review: 'Review',
  learn: 'Learn',
  quiz: 'Quiz',
};

// ─── Quest row ───

interface QuestRowProps {
  quest: Quest;
  index: number;
  done: boolean;
  onToggle: (quest: Quest) => void;
  onStart: (quest: Quest) => void;
}

function QuestRow({ quest, index, done, onToggle, onStart }: QuestRowProps) {
  const Icon = QUEST_ICONS[quest.kind];
  const shown = Math.min(quest.progress, quest.target);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 transition-colors',
        done ? 'border-emerald-400/25 bg-emerald-500/[0.07]' : 'border-white/10 bg-white/[0.03]',
        quest.kind === 'boss' && !done && 'border-purple-400/30 bg-purple-500/10'
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={quest.achieved ? `${quest.title}: done from your study activity` : `Mark "${quest.title}" done`}
        disabled={quest.achieved}
        onClick={() => onToggle(quest)}
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-all',
          done ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-200' : 'border-white/20 hover:border-white/40',
          quest.achieved && 'cursor-default'
        )}
      >
        <AnimatePresence>
          {done && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              <Check className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 text-sm font-medium', done ? 'text-white/50 line-through' : 'text-white/90')}>
          <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', done ? 'text-white/40' : 'text-cyan-300')} />
          <span className="truncate">{quest.title}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-white/45">
          <span className="mr-1">{quest.deckIcon}</span>
          {quest.deckName} · {quest.detail}
        </p>
        {quest.target > 1 && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: done ? '#34d399' : quest.deckColor }}
              initial={false}
              animate={{ width: `${(shown / quest.target) * 100}%` }}
            />
          </div>
        )}
      </div>

      <span className="flex-shrink-0 text-xs text-white/50 tabular-nums">
        {shown}/{quest.target}
      </span>
      {!done && (
        <button
          type="button"
          onClick={() => onStart(quest)}
          className="flex flex-shrink-0 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/20"
        >
          <Play className="h-3 w-3" />
          {START_LABELS[quest.kind]}
        </button>
      )}
    </motion.li>
  );
}

// ─── Schedule row ───

function DayRow({ day, todayStart, maxLoad }: { day: PlanDay; todayStart: number; maxLoad: number }) {
  const isToday = day.offset === 0;
  const learnPct = (day.learn / maxLoad) * 100;
  const reviewPct = (day.review / maxLoad) * 100;
  return (
    <li
      className={cn(
        'grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-xs',
        isToday && 'bg-cyan-500/10',
        day.isTarget && 'bg-purple-500/10'
      )}
    >
      <span className={cn('truncate', isToday ? 'font-semibold text-cyan-200' : 'text-white/60')}>
        {day.isTarget && <Flag className="mr-1 inline h-3 w-3 text-purple-300" aria-label="Target day" />}
        {relativeDayLabel(day.dayStart, todayStart)}{' '}
        <span className="text-white/35">{shortDateLabel(day.dayStart)}</span>
      </span>
      <span
        className="flex h-2 items-center gap-[2px]"
        role="img"
        aria-label={`${day.learn} new, ${day.estimated ? 'about ' : ''}${day.review} reviews`}
      >
        {day.learn > 0 && (
          <span className="h-full rounded-l-sm" style={{ width: `${learnPct}%`, backgroundColor: NEW_COLOR, minWidth: 3 }} />
        )}
        {day.review > 0 && (
          <span
            className={cn('h-full', day.learn > 0 ? 'rounded-r-sm' : 'rounded-sm')}
            style={{ width: `${reviewPct}%`, backgroundColor: REVIEW_COLOR, minWidth: 3 }}
          />
        )}
        {day.learn === 0 && day.review === 0 && <span className="text-[10px] text-white/25">rest</span>}
      </span>
      <span className="text-right text-white/55 tabular-nums">
        {day.learn} new · {day.estimated ? '≈' : ''}
        {day.review} rev
      </span>
    </li>
  );
}

// ─── Planner ───

function StudyPlannerInner({ onStart }: StudyPlannerProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const attempts = useLearningStore((s) => s.attempts);
  const plan = useQuestPlanStore((s) => s.plan);
  const checked = useQuestPlanStore((s) => s.checked);
  const savePlan = useQuestPlanStore((s) => s.savePlan);
  const clearPlan = useQuestPlanStore((s) => s.clearPlan);
  const toggleQuest = useQuestPlanStore((s) => s.toggleQuest);
  const [editing, setEditing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);

  // `now` ticks once a minute: due cards and the day roll over without impure renders.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const view = useMemo(
    () => (plan ? buildPlanView(plan, decks, reviews, attempts, now) : null),
    [plan, decks, reviews, attempts, now]
  );
  const todayKey = dayKeyOf(now);
  const todayStart = utcDayStart(now);
  const ticked = checked[todayKey] ?? NO_TICKS;

  const save = useCallback(
    (input: QuestPlanInput) => {
      if (savePlan(input, dayKeyOf(Date.now()))) {
        setEditing(false);
        setNow(Date.now());
      }
    },
    [savePlan]
  );

  const toggle = useCallback(
    (quest: Quest) => {
      if (quest.achieved) return;
      // Finishing a planned quest is study activity for today's streak.
      if (toggleQuest(todayKey, quest.id)) recordStudyAction();
    },
    [toggleQuest, todayKey]
  );

  const start = useCallback(
    (quest: Quest) => launchTraining(onStart, quest.mode, quest.launchTarget),
    [onStart]
  );

  // ─── No plan yet / editing ───
  if (!plan || !view || editing) {
    return (
      <div className="space-y-4 p-6">
        {!plan && (
          <header>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white">
              <Flag className="h-5 w-5 text-cyan-300" />
              Quest Planner
            </h3>
            <p className="mt-1 text-xs text-white/50">
              A deadline turned into daily quests: learn a slice of new cards, clear your reviews, win one quiz a day.
            </p>
          </header>
        )}
        <QuestPlanForm
          decks={decks}
          reviews={reviews}
          now={now}
          plan={plan}
          onSave={save}
          onCancel={plan ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const endControls = confirmEnd ? (
    <span className="flex items-center gap-1.5 text-[11px]">
      <span className="text-white/50">End this quest?</span>
      <button
        type="button"
        onClick={() => {
          clearPlan();
          setConfirmEnd(false);
        }}
        className="rounded-md border border-red-400/30 bg-red-500/15 px-2 py-1 text-red-200 hover:bg-red-500/25"
      >
        End
      </button>
      <button
        type="button"
        onClick={() => setConfirmEnd(false)}
        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-white/60 hover:bg-white/10"
      >
        Keep
      </button>
    </span>
  ) : (
    <span className="flex gap-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => setConfirmEnd(true)}
        className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/60 hover:bg-white/10"
        aria-label="End this quest"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );

  const goal = plan.goal || 'Untitled quest';
  const targetLabel = `${weekdayLabel(view.targetStart)}, ${shortDateLabel(view.targetStart)}`;

  // ─── Plan over / decks gone ───
  if (view.status !== 'active') {
    const ended = view.status === 'ended';
    return (
      <div className="p-6">
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 p-6 text-center"
        >
          {ended ? <Trophy className="mx-auto h-9 w-9 text-yellow-300" /> : <Flag className="mx-auto h-9 w-9 text-white/40" />}
          <div>
            <h3 className="text-lg font-bold text-white">{ended ? 'Quest complete' : 'This quest lost its decks'}</h3>
            <p className="mt-1 text-xs text-white/50">
              {goal} · {ended ? `target was ${targetLabel}` : 'the decks it covered were deleted'}
            </p>
          </div>
          {ended && (
            <p className="text-sm text-white/70">
              Final mastery <span className="font-semibold text-white">{toPercent(view.mastery.value)}%</span> ·{' '}
              {view.mastery.mastered} of {view.mastery.total} cards mastered
            </p>
          )}
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/30"
            >
              <Swords className="h-4 w-4" />
              {ended ? 'Forge the next quest' : 'Pick decks'}
            </button>
            <button
              type="button"
              onClick={clearPlan}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </motion.section>
      </div>
    );
  }

  // ─── Active plan ───
  const quests = view.quests;
  const isDone = (quest: Quest) => quest.achieved || ticked.includes(quest.id);
  const doneCount = quests.filter(isDone).length;
  const allDone = quests.length > 0 && doneCount === quests.length;
  const days = showAllDays ? view.days : view.days.slice(0, DAYS_PREVIEW);
  const maxLoad = Math.max(1, ...view.days.map((d) => d.learn + d.review));
  const seenPct = view.mastery.total > 0 ? view.mastery.seen / view.mastery.total : 0;
  const stats = [
    { label: 'Mastery', value: `${toPercent(view.mastery.value)}%` },
    { label: 'Cards seen', value: `${view.mastery.seen} / ${view.mastery.total}` },
    { label: 'Mastered', value: String(view.mastery.mastered) },
  ];

  return (
    <div className="space-y-5 p-6">
      {/* Quest header */}
      <section className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-slate-950/40 to-purple-500/10 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">Quest Planner · active quest</p>
            <h3 className="mt-1 break-words text-lg font-bold text-white">{goal}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/55">
              <Flag className="h-3.5 w-3.5 text-purple-300" />
              {targetLabel} ·{' '}
              {view.daysLeft === 0 ? (
                <span className="font-semibold text-purple-200">target day</span>
              ) : (
                `${view.daysLeft} day${view.daysLeft === 1 ? '' : 's'} left`
              )}
            </p>
          </div>
          {endControls}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-lg font-semibold text-white">{s.value}</p>
              <p className="text-[11px] text-white/45">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" title="Mastery of the plan's cards">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: masteryColor(view.mastery.value) }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(1, toPercent(view.mastery.value))}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] text-white/35">
            {toPercent(seenPct)}% of cards seen · {view.decks.map((d) => `${d.icon} ${d.name}`).join('  ·  ')}
          </p>
        </div>
      </section>

      {/* Today */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold text-white/85">Today&apos;s quests</h4>
          <span className="text-xs text-white/45 tabular-nums">
            {doneCount}/{quests.length} done
          </span>
        </div>
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100"
            >
              <Trophy className="h-4 w-4 text-yellow-300" />
              Day cleared. Every quest done: the streak holds.
            </motion.div>
          )}
        </AnimatePresence>
        {quests.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-white/45">
            Nothing due and nothing new left today. Rest, or run a quiz for fun.
          </p>
        ) : (
          <ul className="space-y-2">
            {quests.map((quest, i) => (
              <QuestRow key={quest.id} quest={quest} index={i} done={isDone(quest)} onToggle={toggle} onStart={start} />
            ))}
          </ul>
        )}
      </section>

      {/* Schedule */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-white/85">Schedule</h4>
          <span className="flex items-center gap-3 text-[11px] text-white/50">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: NEW_COLOR }} />
              New cards
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: REVIEW_COLOR }} />
              Reviews (≈ estimated)
            </span>
          </span>
        </div>
        <ol className="space-y-0.5 rounded-xl border border-white/10 bg-white/[0.02] p-1.5">
          {days.map((day) => (
            <DayRow key={day.dayStart} day={day} todayStart={todayStart} maxLoad={maxLoad} />
          ))}
        </ol>
        {view.days.length > DAYS_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAllDays((v) => !v)}
            className="text-xs text-cyan-300/80 hover:text-cyan-200"
          >
            {showAllDays ? 'Show fewer days' : `Show all ${view.days.length} days`}
          </button>
        )}
        {view.daysLeft >= PLAN_DAYS_SHOWN && (
          <p className="text-[11px] text-white/35">
            Showing the next {PLAN_DAYS_SHOWN} days; the pace already accounts for the whole stretch.
          </p>
        )}
      </section>
    </div>
  );
}

export const StudyPlanner = memo(StudyPlannerInner);
