// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quest Plan Form
// Goal + target date + decks → a plan. Shows the daily pace the
// plan will ask for before it is forged.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarRange, Swords, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Chip, Input } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import { deckCards } from '@/stores/useLearningStore';
import type { CardReview, Deck } from '@/types/learning';
import type { QuestPlan, QuestPlanInput } from './quest-plan-store';
import { learningDaysFrom } from './quest-plan';
import { DAY_MS, dayKeyOf, daysBetween, parseDayKey, shortDateLabel, utcDayStart } from './schedule';
import { EmberSeam } from '../armor-bits';

/** HUD corner brackets in forge ember (the form is a forge action). */

/** Default horizon of a new plan. */
const DEFAULT_DAYS = 14;

interface QuestPlanFormProps {
  decks: readonly Deck[];
  reviews: Readonly<Record<string, CardReview>>;
  now: number;
  /** The plan being edited, if any. */
  plan: QuestPlan | null;
  onSave: (input: QuestPlanInput) => void;
  onCancel?: () => void;
}

function QuestPlanFormInner({ decks, reviews, now, plan, onSave, onCancel }: QuestPlanFormProps) {
  const todayKey = dayKeyOf(now);
  const reduceMotion = useReducedMotion();
  const [goal, setGoal] = useState(plan?.goal ?? '');
  const [targetDate, setTargetDate] = useState(() => {
    // An ended plan starts over with a fresh horizon.
    const target = plan ? parseDayKey(plan.targetDate) : null;
    return plan && target !== null && target >= utcDayStart(now)
      ? plan.targetDate
      : dayKeyOf(now + DEFAULT_DAYS * DAY_MS);
  });
  const [selected, setSelected] = useState<string[]>(() => {
    const existing = plan ? plan.deckIds.filter((id) => decks.some((d) => d.id === id)) : [];
    if (existing.length > 0) return existing;
    return decks.filter((d) => deckCards(d).length > 0).map((d) => d.id);
  });

  const preview = useMemo(() => {
    let total = 0;
    let unseen = 0;
    let due = 0;
    for (const deck of decks) {
      if (!selected.includes(deck.id)) continue;
      for (const card of deckCards(deck)) {
        total += 1;
        const review = reviews[card.id];
        if (!review) unseen += 1;
        else if (review.dueAt <= now) due += 1;
      }
    }
    const targetStart = parseDayKey(targetDate);
    const daysLeft = targetStart === null ? null : daysBetween(now, targetStart);
    const learningDays = daysLeft === null ? 0 : learningDaysFrom(0, daysLeft);
    return {
      total,
      unseen,
      due,
      targetStart,
      daysLeft,
      learningDays,
      perDay: learningDays > 0 ? Math.ceil(unseen / learningDays) : 0,
    };
  }, [decks, reviews, selected, targetDate, now]);

  const dateError =
    preview.daysLeft === null ? 'Pick a target date.' : preview.daysLeft < 0 ? 'The target date has passed.' : null;
  const deckError = selected.length === 0 ? 'Pick at least one deck.' : preview.total === 0 ? 'These decks have no cards yet.' : null;
  const canSave = !dateError && !deckError;

  const toggleDeck = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((d) => d !== id) : [...current, id]));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSave) onSave({ goal, targetDate, deckIds: selected });
  };

  const problem = dateError ?? deckError;

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={TRANSITION.panel}
      className="@container armor-panel chamfer-md rivets relative space-y-5 p-5 [--cut-tl:16px] [--cut-br:16px] [--rivet-inset:5px]"
    >
      <EmberSeam />
      <div className="flex items-start gap-3">
        <span className="armor-plate chamfer-sm mt-0.5 flex size-9 shrink-0 items-center justify-center bg-[color-mix(in_oklab,var(--color-ember-500)_18%,var(--color-steel-800))] text-ember-400 [--cut-tr:0px] [--cut-bl:0px]">
          <Swords size={18} strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-wide text-fg">{plan ? 'Edit your quest' : 'Forge a quest'}</h3>
          <p className="mt-0.5 max-w-prose text-ui text-fg-muted">
            Name a goal and a date. Your unseen cards get spread over the days left, reviews stay on schedule, and every day
            hands you a short list of quests.
          </p>
        </div>
      </div>

      <div className="grid gap-4 @xl:grid-cols-[minmax(0,1fr)_12rem]">
        <Input
          label="Goal"
          value={goal}
          maxLength={120}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Know every React hook cold before the interview"
        />
        <Input
          label="Target date"
          type="date"
          value={targetDate}
          min={todayKey}
          onChange={(e) => setTargetDate(e.target.value)}
          className="font-mono tabular"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="engraved mb-2 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">Decks</legend>
        {decks.length === 0 ? (
          <p className="text-xs text-fg-subtle">No decks yet. Create one in Decks first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {decks.map((deck) => {
              const count = deckCards(deck).length;
              return (
                <Chip key={deck.id} selected={selected.includes(deck.id)} onClick={() => toggleDeck(deck.id)}>
                  <span aria-hidden className="mr-1.5">
                    {deck.icon}
                  </span>
                  {deck.name}
                  <span className="ml-1.5 font-mono tabular opacity-60">{count}</span>
                </Chip>
              );
            })}
          </div>
        )}
      </fieldset>

      <div
        role={problem ? 'alert' : 'status'}
        className={cn(
          'flex items-start gap-3 chamfer-sm px-3.5 py-3 text-ui ring-1 ring-inset',
          problem ? 'bg-warning/8 text-fg ring-warning/25' : 'bg-steel-950/50 text-fg-muted ring-line bevel'
        )}
      >
        {problem ? (
          <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" aria-hidden />
        ) : (
          <CalendarRange size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        )}
        {problem ? (
          <p>{problem}</p>
        ) : (
          <p className="tabular">
            <span className="font-semibold text-fg">{preview.unseen}</span> new card{preview.unseen === 1 ? '' : 's'} over{' '}
            <span className="font-semibold text-fg">{preview.learningDays}</span> day{preview.learningDays === 1 ? '' : 's'} ≈{' '}
            <span className="font-semibold text-accent">{preview.perDay} a day</span>
            {preview.due > 0 ? ` · ${preview.due} reviews due now` : ''}
            {preview.targetStart !== null && preview.daysLeft !== null && preview.daysLeft >= 3
              ? ` · ${shortDateLabel(preview.targetStart)} is kept for review and a boss fight`
              : ''}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button variant="secondary" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="ember" size="lg" leadingIcon={Swords} disabled={!canSave}>
          {plan ? 'Save plan' : 'Forge plan'}
        </Button>
      </div>
    </motion.form>
  );
}

export const QuestPlanForm = memo(QuestPlanFormInner);
