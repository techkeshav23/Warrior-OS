// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Entry
// Glass quick-add form (amount, category, note, date) with inline
// validation. The same form edits an existing expense; the parent
// remounts it (key) whenever the expense being edited changes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useRef, useState, type FormEvent } from 'react';
import { Check, IndianRupee, Plus, X } from 'lucide-react';
import { parseISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { MAX_EXPENSE_NOTE_LENGTH, useExpenseStore } from '@/stores/useExpenseStore';
import type { Expense, ExpenseCategory } from '@/types/expense';
import { checkBudgetAlert, checkFirstExpenseAchievement } from './expense-alerts';
import {
  EARLIEST_EXPENSE_DATE,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_MAP,
  formatINR,
  isValidDateKey,
  parseAmountInput,
  toDateKey,
} from './expense-utils';

interface ExpenseEntryProps {
  className?: string;
  /** Expense being edited, or null for quick-add mode. */
  editing: Expense | null;
  todayKey: string;
  onSaved: (expense: Expense, mode: 'added' | 'updated') => void;
  onCancelEdit: () => void;
}

interface FieldErrors {
  amount?: string;
  date?: string;
  note?: string;
}

function validate(
  amountText: string,
  date: string,
  note: string,
  todayKey: string
): { errors: FieldErrors; amount: number | null } {
  const errors: FieldErrors = {};
  const parsed = parseAmountInput(amountText);
  if (!parsed.ok) errors.amount = parsed.error;
  if (!date) errors.date = 'Pick the day you spent it.';
  else if (!isValidDateKey(date)) errors.date = 'That is not a valid date.';
  else if (date > todayKey) errors.date = 'Expenses cannot be dated in the future.';
  else if (date < EARLIEST_EXPENSE_DATE) errors.date = 'Dates before 2000 are not supported.';
  if (note.trim().length > MAX_EXPENSE_NOTE_LENGTH) {
    errors.note = `Keep the note within ${MAX_EXPENSE_NOTE_LENGTH} characters.`;
  }
  return { errors, amount: parsed.ok ? parsed.value : null };
}

function ExpenseEntryInner({ className, editing, todayKey, onSaved, onCancelEdit }: ExpenseEntryProps) {
  const fieldId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(() => (editing ? String(editing.amount) : ''));
  const [category, setCategory] = useState<ExpenseCategory>(() => editing?.category ?? 'food');
  const [note, setNote] = useState(() => editing?.note ?? '');
  const [date, setDate] = useState(() => editing?.date ?? todayKey);
  const [submitted, setSubmitted] = useState(false);

  const isEditing = editing !== null;
  const { errors, amount: parsedAmount } = validate(amount, date, note, todayKey);
  const visibleErrors: FieldErrors = submitted ? errors : {};
  const yesterdayKey = toDateKey(subDays(parseISO(todayKey), 1));
  const selectedMeta = EXPENSE_CATEGORY_MAP[category];
  const SelectedIcon = selectedMeta.Icon;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const result = validate(amount, date, note, todayKey);
    if (result.amount === null || Object.keys(result.errors).length > 0) {
      if (result.errors.amount) amountRef.current?.focus();
      return;
    }

    const input = { amount: result.amount, category, note, date };
    const store = useExpenseStore.getState();

    if (editing) {
      const unchanged =
        Math.round(editing.amount * 100) === Math.round(input.amount * 100) &&
        editing.category === input.category &&
        editing.note === input.note.trim() &&
        editing.date === input.date;
      if (unchanged) {
        onCancelEdit();
        return;
      }
      const saved = store.updateExpense(editing.id, input);
      if (saved) {
        checkBudgetAlert(saved.date, todayKey);
        onSaved(saved, 'updated');
      } else {
        // The expense was deleted elsewhere while being edited.
        onCancelEdit();
      }
      return;
    }

    const saved = store.addExpense(input);
    checkFirstExpenseAchievement();
    checkBudgetAlert(saved.date, todayKey);
    onSaved(saved, 'added');
    // Keep category + date for rapid entry of several expenses.
    setAmount('');
    setNote('');
    setSubmitted(false);
    amountRef.current?.focus();
  };

  const inputBase =
    'w-full rounded-lg border bg-black/30 text-white outline-none transition-colors placeholder:text-white/30 focus:border-cyan-400/60';

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isEditing ? 'Edit expense' : 'Add expense'}
      className={cn(
        'rounded-xl border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md',
        isEditing ? 'border-cyan-500/30 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/[0.05]',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{isEditing ? 'Edit expense' : 'Quick add'}</h3>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-white/55 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        )}
      </div>

      {/* Amount */}
      <label htmlFor={`${fieldId}-amount`} className="mb-1 block text-[11px] text-white/60">
        Amount
      </label>
      <div className="relative">
        <IndianRupee className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          ref={amountRef}
          id={`${fieldId}-amount`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          autoFocus={isEditing}
          aria-invalid={visibleErrors.amount ? true : undefined}
          aria-describedby={`${fieldId}-amount-hint`}
          className={cn(
            inputBase,
            'py-2 pl-8 pr-3 font-mono text-lg',
            visibleErrors.amount ? 'border-red-500/50' : 'border-white/10'
          )}
        />
      </div>
      <p id={`${fieldId}-amount-hint`} className={cn('mt-1 min-h-[1rem] text-[11px]', visibleErrors.amount ? 'text-red-300' : 'text-white/45')}>
        {visibleErrors.amount ?? (parsedAmount !== null ? `= ${formatINR(parsedAmount, 'always')}` : 'Rupees, up to 2 decimals')}
      </p>

      {/* Category + date */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <label htmlFor={`${fieldId}-category`} className="mb-1 block text-[11px] text-white/60">
            Category
          </label>
          <div className="relative">
            <SelectedIcon
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: selectedMeta.color }}
            />
            <select
              id={`${fieldId}-category`}
              value={category}
              onChange={(e) => {
                const next = EXPENSE_CATEGORIES.find((c) => c.id === e.target.value);
                if (next) setCategory(next.id);
              }}
              className={cn(inputBase, 'border-white/10 py-2 pl-8 pr-2 text-sm')}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#111118] text-white">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${fieldId}-date`} className="mb-1 block text-[11px] text-white/60">
            Date
          </label>
          <input
            id={`${fieldId}-date`}
            type="date"
            value={date}
            min={EARLIEST_EXPENSE_DATE}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            aria-invalid={visibleErrors.date ? true : undefined}
            aria-describedby={visibleErrors.date ? `${fieldId}-date-error` : undefined}
            className={cn(
              inputBase,
              'px-2 py-[7px] text-sm',
              visibleErrors.date ? 'border-red-500/50' : 'border-white/10'
            )}
          />
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1">
        {[
          { key: todayKey, label: 'Today' },
          { key: yesterdayKey, label: 'Yesterday' },
        ].map((d) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setDate(d.key)}
            aria-pressed={date === d.key}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
              date === d.key
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-white/10 text-white/50 hover:bg-white/10'
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      {visibleErrors.date && (
        <p id={`${fieldId}-date-error`} className="mt-1 text-[11px] text-red-300">
          {visibleErrors.date}
        </p>
      )}

      {/* Note */}
      <div className="mt-2 flex items-baseline justify-between">
        <label htmlFor={`${fieldId}-note`} className="block text-[11px] text-white/60">
          Note <span className="text-white/35">(optional)</span>
        </label>
        {note.length > MAX_EXPENSE_NOTE_LENGTH - 20 && (
          <span className="text-[10px] text-white/40">
            {note.length}/{MAX_EXPENSE_NOTE_LENGTH}
          </span>
        )}
      </div>
      <input
        id={`${fieldId}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={MAX_EXPENSE_NOTE_LENGTH}
        autoComplete="off"
        placeholder="Canteen thali, metro card, GATE guide..."
        aria-invalid={visibleErrors.note ? true : undefined}
        className={cn(inputBase, 'mt-1 px-2.5 py-2 text-sm', visibleErrors.note ? 'border-red-500/50' : 'border-white/10')}
      />
      {visibleErrors.note && <p className="mt-1 text-[11px] text-red-300">{visibleErrors.note}</p>}

      <button
        type="submit"
        className={cn(
          'mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition-colors',
          isEditing
            ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30'
            : 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
        )}
      >
        {isEditing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {isEditing ? 'Save changes' : 'Add expense'}
      </button>
    </form>
  );
}

export const ExpenseEntry = memo(ExpenseEntryInner);
