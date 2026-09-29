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
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Crosshair,
  Flag,
  Pencil,
  Play,
  Repeat,
  Sparkles,
  Swords,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, ConfirmDialog, EmptyState, IconButton, ProgressBar, StatTile } from '@/components/ui';
import { EASE_OUT_QUINT, TRANSITION } from '@/styles/tokens';
import { useLearningStore } from '@/stores/useLearningStore';
import { recordStudyAction } from '@/components/achievements/study-streak';
import { TabHeader } from './QuizControls';
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

/** Schedule series colours: the viz palette, in order. */
const NEW_COLOR = 'var(--color-viz-1)';
const REVIEW_COLOR = 'var(--color-viz-2)';

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
  const reduceMotion = useReducedMotion();
  const Icon = QUEST_ICONS[quest.kind];
  const shown = Math.min(quest.progress, quest.target);
  const boss = quest.kind === 'boss';
  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: index * 0.04, ease: EASE_OUT_QUINT }}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 transition-colors duration-120 ease-out-quint',
        boss && !done && 'bg-ember-500/6'
      )}
    >
      {boss && !done && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-ember-400 shadow-[0_0_8px_var(--color-ember-500)]" />}
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={quest.achieved ? `${quest.title}: done from your study activity` : `Mark "${quest.title}" done`}
        title={quest.achieved ? 'Done from your study activity' : undefined}
        disabled={quest.achieved}
        onClick={() => onToggle(quest)}
        className={cn(
          'focus-ring flex size-5 shrink-0 items-center justify-center chamfer-xs [--cut:3px] border transition-colors duration-120 ease-out-quint',
          done ? 'border-success bg-success text-ink-950' : 'border-fg-faint bg-steel-950 shadow-[inset_0_1px_0_rgb(0_0_0/0.7)] hover:border-fg-subtle',
          quest.achieved && 'cursor-default'
        )}
      >
        <AnimatePresence initial={false}>
          {done && (
            <motion.span
              initial={reduceMotion ? false : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={TRANSITION.small}
              className="flex"
            >
              <Check size={14} strokeWidth={3} aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center chamfer-sm bg-steel-950/70 bevel',
          done ? 'text-fg-subtle' : boss ? 'ember-edge text-ember-400' : 'text-accent'
        )}
      >
        <Icon size={16} strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn('truncate text-ui font-medium', done ? 'text-fg-subtle line-through decoration-fg-faint' : 'text-fg')}
          title={quest.title}
        >
          {quest.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-fg-subtle" title={`${quest.deckName} · ${quest.detail}`}>
          <span aria-hidden className="mr-1">
            {quest.deckIcon}
          </span>
          {quest.deckName} · {quest.detail}
        </p>
        {quest.target > 1 && (
          <ProgressBar
            value={shown}
            max={quest.target}
            size="sm"
            tone={done ? 'success' : boss ? 'ember' : 'accent'}
            animated={false}
            className="mt-2 max-w-64"
            aria-label={`${quest.title}: ${shown} of ${quest.target}`}
          />
        )}
      </div>

      <span className="shrink-0 font-mono text-xs text-fg-muted tabular">
        {shown}/{quest.target}
      </span>
      {done ? (
        <span className="hidden min-w-24 shrink-0 text-right text-xs text-success @md:inline">Done</span>
      ) : (
        <Button variant={boss ? 'ember' : 'secondary'} size="sm" leadingIcon={Play} onClick={() => onStart(quest)} className="min-w-24">
          {START_LABELS[quest.kind]}
        </Button>
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
        'grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 chamfer-xs px-2.5 py-1.5 @md:grid-cols-[8rem_minmax(0,1fr)_auto]',
        isToday && 'bg-accent/8 shadow-[inset_2px_0_0_var(--accent)]',
        day.isTarget && 'bg-ember-500/8'
      )}
    >
      <span className={cn('flex min-w-0 items-center gap-1.5 text-xs', isToday ? 'font-semibold text-fg' : 'text-fg-muted')}>
        {day.isTarget && <Flag size={12} strokeWidth={2} className="shrink-0 text-ember-400" aria-label="Target day" />}
        <span className="truncate">{relativeDayLabel(day.dayStart, todayStart)}</span>
        <span className="shrink-0 font-mono text-2xs font-normal text-fg-subtle">{shortDateLabel(day.dayStart)}</span>
      </span>
      <span
        className="flex h-2 items-center gap-0.5"
        role="img"
        aria-label={`${day.learn} new, ${day.estimated ? 'about ' : ''}${day.review} reviews`}
      >
        {day.learn > 0 && (
          <span
            className="h-full"
            style={{ width: `${learnPct}%`, backgroundColor: NEW_COLOR, minWidth: 4 }}
          />
        )}
        {day.review > 0 && (
          <span
            className={cn('h-full', day.estimated && 'opacity-70')}
            style={{ width: `${reviewPct}%`, backgroundColor: REVIEW_COLOR, minWidth: 4 }}
          />
        )}
        {day.learn === 0 && day.review === 0 && <span className="font-mono text-2xs text-fg-subtle">rest</span>}
      </span>
      <span className="text-right font-mono text-2xs text-fg-muted tabular">
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
  const reduceMotion = useReducedMotion();

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
      <div className="@container space-y-5 p-5">
        {!plan && (
          <TabHeader
            icon={Flag}
            title="Quest planner"
            description="A deadline turned into daily quests: learn a slice of new cards, clear your reviews, win one quiz a day."
          />
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

  const endDialog = (
    <ConfirmDialog
      open={confirmEnd}
      onClose={() => setConfirmEnd(false)}
      onConfirm={() => {
        clearPlan();
        setConfirmEnd(false);
      }}
      title="End this quest?"
      description="The plan and today's ticks are cleared. Your study progress and mastery stay."
      confirmLabel="End quest"
      cancelLabel="Keep"
      tone="danger"
    />
  );

  const goal = plan.goal || 'Untitled quest';
  const targetLabel = `${weekdayLabel(view.targetStart)}, ${shortDateLabel(view.targetStart)}`;

  // ─── Plan over / decks gone ───
  if (view.status !== 'active') {
    const ended = view.status === 'ended';
    return (
      <div className="@container p-5">
        <motion.div
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={TRANSITION.panel}
        >
          <Card hud tone={ended ? 'ember' : 'default'} padding="lg">
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              {ended ? (
                <span className="armor-plate chamfer-md flex size-14 items-center justify-center bg-[color-mix(in_oklab,var(--color-gold)_18%,var(--color-steel-800))] text-gold [--cut-tl:12px] [--cut-br:12px]">
                  <Trophy size={26} strokeWidth={1.75} aria-hidden />
                </span>
              ) : (
                <span className="armor-plate chamfer-md flex size-14 items-center justify-center text-fg-muted [--cut-tl:12px] [--cut-br:12px]">
                  <Flag size={24} strokeWidth={1.75} aria-hidden />
                </span>
              )}
              <div>
                <div className="hud-label">{ended ? 'Quest over' : 'Quest'}</div>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-wide text-fg">{ended ? 'Quest complete' : 'This quest lost its decks'}</h3>
                <p className="mt-1 text-ui text-fg-muted">
                  {goal} · {ended ? `target was ${targetLabel}` : 'the decks it covered were deleted'}
                </p>
              </div>
              {ended && (
                <p className="text-ui text-fg-muted tabular">
                  Final mastery <span className="font-semibold text-fg">{toPercent(view.mastery.value)}%</span> ·{' '}
                  {view.mastery.mastered} of {view.mastery.total} cards mastered
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" size="lg" onClick={clearPlan}>
                  Clear
                </Button>
                <Button variant={ended ? 'ember' : 'primary'} size="lg" leadingIcon={Swords} onClick={() => setEditing(true)}>
                  {ended ? 'Forge the next quest' : 'Pick decks'}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
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

  return (
    <div className="@container space-y-6 p-5">
      {endDialog}

      {/* Quest header */}
      <Card hud tone="ember" padding="lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="hud-label text-ember-400">Quest planner · active quest</div>
            <h3 className="mt-1.5 break-words font-display text-xl font-semibold tracking-wide text-fg">{goal}</h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-fg-muted">
              <Flag size={14} strokeWidth={1.75} className="text-ember-400" aria-hidden />
              {targetLabel}
              <span aria-hidden className="text-fg-faint">
                ·
              </span>
              {view.daysLeft === 0 ? (
                <Badge tone="ember" size="sm">
                  Target day
                </Badge>
              ) : (
                <span className="tabular">
                  {view.daysLeft} day{view.daysLeft === 1 ? '' : 's'} left
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton icon={Pencil} aria-label="Edit plan" tooltip onClick={() => setEditing(true)} />
            <IconButton icon={X} variant="ghost-danger" aria-label="End this quest" tooltip onClick={() => setConfirmEnd(true)} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4">
          <StatTile bare size="sm" label="Mastery" value={toPercent(view.mastery.value)} unit="%" />
          <StatTile bare size="sm" label="Cards seen" value={view.mastery.seen} unit={`/ ${view.mastery.total}`} />
          <StatTile bare size="sm" label="Mastered" value={view.mastery.mastered} />
        </div>
        <div className="mt-4 space-y-2">
          <ProgressBar
            value={toPercent(view.mastery.value)}
            color={masteryColor(view.mastery.value)}
            aria-label="Mastery of the plan's cards"
          />
          <p className="truncate text-xs text-fg-subtle" title={view.decks.map((d) => d.name).join(' · ')}>
            {toPercent(seenPct)}% of cards seen · {view.decks.map((d) => `${d.icon} ${d.name}`).join('  ·  ')}
          </p>
        </div>
      </Card>

      {/* Today */}
      <section className="space-y-3" aria-label="Today's quests">
        <div className="flex items-center justify-between gap-3">
          <h4 className="engraved font-display text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Today&apos;s quests</h4>
          <Badge tone={allDone ? 'success' : 'neutral'} icon={allDone ? Check : undefined}>
            {doneCount}/{quests.length} done
          </Badge>
        </div>
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={TRANSITION.small}
              className="relative flex items-center gap-3 chamfer-md bg-gold/10 px-4 py-3 ring-1 ring-inset ring-gold/25 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-gold"
            >
              <Trophy size={18} strokeWidth={1.75} className="shrink-0 text-gold" aria-hidden />
              <p className="text-ui text-fg">Day cleared. Every quest done: the streak holds.</p>
            </motion.div>
          )}
        </AnimatePresence>
        {quests.length === 0 ? (
          <EmptyState
            size="sm"
            icon={Swords}
            title="Nothing to do today"
            description="Nothing due and nothing new left today. Rest, or run a quiz for fun."
          />
        ) : (
          <ul className="armor-panel chamfer-md divide-y divide-black/40 overflow-hidden">
            {quests.map((quest, i) => (
              <QuestRow key={quest.id} quest={quest} index={i} done={isDone(quest)} onToggle={toggle} onStart={start} />
            ))}
          </ul>
        )}
      </section>

      {/* Schedule */}
      <section className="space-y-3" aria-label="Schedule">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="engraved font-display text-xs font-semibold uppercase tracking-[0.18em] text-fg-muted">Schedule</h4>
          <span className="flex items-center gap-4 text-xs text-fg-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: NEW_COLOR }} />
              New cards
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: REVIEW_COLOR }} />
              Reviews (≈ estimated)
            </span>
          </span>
        </div>
        <Card padding="sm">
          <ol className="space-y-0.5">
            {days.map((day) => (
              <DayRow key={day.dayStart} day={day} todayStart={todayStart} maxLoad={maxLoad} />
            ))}
          </ol>
        </Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {view.daysLeft >= PLAN_DAYS_SHOWN ? (
            <p className="text-xs text-fg-subtle">
              Showing the next {PLAN_DAYS_SHOWN} days; the pace already accounts for the whole stretch.
            </p>
          ) : (
            <span />
          )}
          {view.days.length > DAYS_PREVIEW && (
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<ChevronDown size={14} strokeWidth={1.75} className={cn(showAllDays && 'rotate-180')} />}
              onClick={() => setShowAllDays((v) => !v)}
            >
              {showAllDays ? 'Show fewer days' : `Show all ${view.days.length} days`}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

export const StudyPlanner = memo(StudyPlannerInner);
