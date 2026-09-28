// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quest Plan Form
// Goal + target date + decks → a plan. Shows the daily pace the
// plan will ask for before it is forged.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deckCards } from '@/stores/useLearningStore';
import type { CardReview, Deck } from '@/types/learning';
import type { QuestPlan, QuestPlanInput } from './quest-plan-store';
import { learningDaysFrom } from './quest-plan';
import { DAY_MS, dayKeyOf, daysBetween, parseDayKey, shortDateLabel, utcDayStart } from './schedule';

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

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.07] via-slate-950/40 to-purple-500/[0.08] p-5"
    >
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-white">
          <Swords className="h-5 w-5 text-cyan-300" />
          {plan ? 'Edit your quest' : 'Forge a quest'}
        </h3>
        <p className="mt-1 text-xs text-white/50">
          Name a goal and a date. Your unseen cards get spread over the days left, reviews stay on schedule, and every
          day hands you a short list of quests.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs text-white/60">Goal</span>
        <input
          type="text"
          value={goal}
          maxLength={120}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. Know every React hook cold before the interview"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-cyan-500/50 focus:outline-none"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs text-white/60">Target date</span>
        <input
          type="date"
          value={targetDate}
          min={todayKey}
          onChange={(e) => setTargetDate(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark] focus:border-cyan-500/50 focus:outline-none"
        />
      </label>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-xs text-white/60">Decks</legend>
        {decks.length === 0 ? (
          <p className="text-xs text-white/40">No decks yet. Create one in the Question Bank first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {decks.map((deck) => {
              const on = selected.includes(deck.id);
              const count = deckCards(deck).length;
              return (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => toggleDeck(deck.id)}
                  aria-pressed={on}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-all',
                    on ? 'bg-white/10 text-white' : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'
                  )}
                  style={on ? { borderColor: deck.color } : undefined}
                >
                  <span>{deck.icon}</span>
                  {deck.name}
                  <span className="text-white/35 tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/60">
        {dateError || deckError ? (
          <p className="text-amber-200/80">{dateError ?? deckError}</p>
        ) : (
          <p>
            <span className="font-semibold text-white">{preview.unseen}</span> new card{preview.unseen === 1 ? '' : 's'}{' '}
            over <span className="font-semibold text-white">{preview.learningDays}</span> day
            {preview.learningDays === 1 ? '' : 's'} ≈{' '}
            <span className="font-semibold text-cyan-200">{preview.perDay} a day</span>
            {preview.due > 0 ? ` · ${preview.due} reviews due now` : ''}
            {preview.targetStart !== null && preview.daysLeft !== null && preview.daysLeft >= 3
              ? ` · ${shortDateLabel(preview.targetStart)} is kept for review and a boss fight`
              : ''}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm text-white/60 hover:bg-white/10"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canSave}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 p-2.5 text-sm font-semibold text-cyan-100 shadow-[0_0_24px_-10px_rgba(34,211,238,0.8)] hover:bg-cyan-500/30 disabled:opacity-30 disabled:shadow-none"
        >
          <Swords className="h-4 w-4" />
          {plan ? 'Save plan' : 'Forge plan'}
        </button>
      </div>
    </motion.form>
  );
}

export const QuestPlanForm = memo(QuestPlanFormInner);
