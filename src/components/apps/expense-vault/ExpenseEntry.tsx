// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Entry
// Quick-add card (amount, category chips, date, note) with inline
// validation. The same form edits an existing expense; the parent
// remounts it (key) whenever the expense being edited changes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Check, IndianRupee, Pencil, Plus, X } from 'lucide-react';
import { parseISO, subDays } from 'date-fns';
import { Button, Card, Chip, Input } from '@/components/ui';
import { MAX_EXPENSE_NOTE_LENGTH, useExpenseStore } from '@/stores/useExpenseStore';
import type { Expense, ExpenseCategory } from '@/types/expense';
import { checkBudgetAlert, checkFirstExpenseAchievement } from './expense-alerts';
import {
  EARLIEST_EXPENSE_DATE,
  EXPENSE_CATEGORIES,
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

  const nearNoteLimit = note.length > MAX_EXPENSE_NOTE_LENGTH - 20;

  return (
    <Card
      title={isEditing ? 'Edit expense' : 'Quick add'}
      description={isEditing ? 'Changes update the month instantly' : 'Log it the moment you spend it'}
      icon={isEditing ? Pencil : Plus}
      tone={isEditing ? 'accent' : 'default'}
      actions={
        isEditing ? (
          <Button variant="ghost" size="sm" leadingIcon={X} onClick={onCancelEdit}>
            Cancel
          </Button>
        ) : undefined
      }
      className={className}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label={isEditing ? 'Edit expense' : 'Add expense'}
        className="space-y-4"
      >
        <Input
          ref={amountRef}
          id={`${fieldId}-amount`}
          label="Amount"
          size="lg"
          leadingIcon={IndianRupee}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          autoFocus={isEditing}
          error={visibleErrors.amount}
          hint={parsedAmount !== null ? `= ${formatINR(parsedAmount, 'always')}` : 'Rupees, up to 2 decimals'}
          className="tabular font-mono font-medium"
        />

        {/* Category */}
        <div className="space-y-1.5">
          <p id={`${fieldId}-category`} className="engraved font-display text-2xs font-semibold uppercase tracking-[0.16em] text-fg-muted">
            Category
          </p>
          <div role="group" aria-labelledby={`${fieldId}-category`} className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => {
              const Icon = c.Icon;
              const active = category === c.id;
              return (
                <Chip
                  key={c.id}
                  selected={active}
                  onClick={() => setCategory(c.id)}
                  icon={
                    <span
                      className="flex text-accent"
                      style={{ '--accent': c.color } as CSSProperties}
                      aria-hidden
                    >
                      <Icon size={14} strokeWidth={1.75} />
                    </span>
                  }
                >
                  {c.label}
                </Chip>
              );
            })}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Input
            id={`${fieldId}-date`}
            label="Date"
            type="date"
            value={date}
            min={EARLIEST_EXPENSE_DATE}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            error={visibleErrors.date}
            className="tabular font-mono"
          />
          <div className="flex items-center gap-1.5">
            {[
              { key: todayKey, label: 'Today' },
              { key: yesterdayKey, label: 'Yesterday' },
            ].map((d) => (
              <Chip key={d.label} size="sm" selected={date === d.key} onClick={() => setDate(d.key)}>
                {d.label}
              </Chip>
            ))}
          </div>
        </div>

        <Input
          id={`${fieldId}-note`}
          label={
            <>
              Note <span className="font-normal text-fg-subtle">(optional)</span>
            </>
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_EXPENSE_NOTE_LENGTH}
          autoComplete="off"
          placeholder="Masala chai, metro card, sci-fi paperback…"
          error={visibleErrors.note}
          hint={nearNoteLimit ? `${note.length}/${MAX_EXPENSE_NOTE_LENGTH}` : undefined}
        />

        <Button type="submit" variant="primary" size="lg" fullWidth leadingIcon={isEditing ? Check : Plus}>
          {isEditing ? 'Save changes' : 'Add expense'}
        </Button>
      </form>
    </Card>
  );
}

export const ExpenseEntry = memo(ExpenseEntryInner);
