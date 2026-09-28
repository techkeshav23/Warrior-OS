// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Budget Overview
// Month summary for Expense Vault: spent, budget (editable for the
// month in progress), remaining, days left and a pace-aware bar
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Check, Lock, Pencil, X } from 'lucide-react';
import { getDaysInMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { MAX_MONTHLY_BUDGET } from '@/stores/useExpenseStore';
import type { ExpenseMonthBudget } from '@/types/expense';
import { formatINR, monthStart, parseAmountInput, shortMonthLabel } from './expense-utils';

interface BudgetOverviewProps {
  monthKey: string;
  todayKey: string;
  spent: number;
  transactionCount: number;
  budget: ExpenseMonthBudget;
  /** Only the month in progress is editable; closed months keep the budget they ran on. */
  canEditBudget: boolean;
  onSaveBudget: (amount: number) => void;
}

function usageTone(pct: number): { bar: string; text: string } {
  if (pct > 100) return { bar: 'bg-red-500', text: 'text-red-300' };
  if (pct >= 80) return { bar: 'bg-amber-400', text: 'text-amber-300' };
  return { bar: 'bg-emerald-400', text: 'text-emerald-300' };
}

function budgetSourceText(budget: ExpenseMonthBudget): string {
  if (budget.source === 'explicit') return 'Set for this month';
  if (budget.source === 'inherited' && budget.setFor) return `Carried over from ${shortMonthLabel(budget.setFor)}`;
  return 'Default budget';
}

function BudgetOverviewInner({
  monthKey,
  todayKey,
  spent,
  transactionCount,
  budget,
  canEditBudget,
  onSaveBudget,
}: BudgetOverviewProps) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isCurrentMonth = monthKey === todayKey.slice(0, 7);
  const daysInMonth = getDaysInMonth(monthStart(monthKey));
  const dayOfMonth = isCurrentMonth ? Number(todayKey.slice(8, 10)) : daysInMonth;
  const daysLeft = isCurrentMonth ? daysInMonth - dayOfMonth + 1 : 0;

  const remaining = budget.amount - spent;
  const usedPct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
  const tone = usageTone(usedPct);
  const perDayLeft = isCurrentMonth && remaining > 0 ? remaining / daysLeft : 0;
  const averagePerDay = spent / Math.max(dayOfMonth, 1);

  // Pace: how much of the budget "should" be gone by the end of today.
  const pacePct = isCurrentMonth ? (dayOfMonth / daysInMonth) * 100 : 100;
  const expectedByToday = (budget.amount * dayOfMonth) / daysInMonth;
  const paceGap = expectedByToday - spent;

  const startEditing = () => {
    setDraft(String(budget.amount));
    setError(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError(null);
  };

  const commit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canEditBudget) {
      // The month closed while the editor was open.
      cancelEditing();
      return;
    }
    const parsed = parseAmountInput(draft, MAX_MONTHLY_BUDGET);
    if (!parsed.ok) {
      setError(parsed.error.replace('Amount', 'Budget'));
      return;
    }
    if (parsed.value < 1) {
      setError('Budget must be at least ₹1.');
      return;
    }
    onSaveBudget(parsed.value);
    setEditing(false);
    setError(null);
  };

  const onDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cancelEditing();
    }
  };

  return (
    <section aria-label="Month overview" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
        {/* Spent */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Spent</p>
          <p className="mt-1 truncate font-mono text-lg font-semibold text-white">{formatINR(spent)}</p>
          <p className="text-[11px] text-white/50">
            {transactionCount} {transactionCount === 1 ? 'transaction' : 'transactions'}
          </p>
        </div>

        {/* Budget */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={inputId} className="text-[11px] uppercase tracking-wider text-white/50">
              Budget
            </label>
            {canEditBudget && !editing && (
              <button
                type="button"
                onClick={startEditing}
                className="rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-cyan-300"
                aria-label="Edit this month's budget"
                title="Edit budget"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {!canEditBudget && (
              <span className="flex items-center gap-1 text-[10px] text-white/40" title="Closed months keep the budget they ran on">
                <Lock className="h-3 w-3" /> Closed
              </span>
            )}
          </div>
          {editing && canEditBudget ? (
            <form onSubmit={commit} className="mt-1">
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm text-white/50">₹</span>
                <input
                  id={inputId}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={onDraftKeyDown}
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${inputId}-error` : undefined}
                  className="w-full min-w-0 rounded border border-white/15 bg-black/40 px-1.5 py-0.5 font-mono text-sm text-white outline-none focus:border-cyan-400/60"
                />
                <button
                  type="submit"
                  className="rounded p-1 text-emerald-300 hover:bg-emerald-500/15"
                  aria-label="Save budget"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="rounded p-1 text-white/50 hover:bg-white/10"
                  aria-label="Cancel editing budget"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {error && (
                <p id={`${inputId}-error`} className="mt-1 text-[10px] text-red-300">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <>
              <p className="mt-1 truncate font-mono text-lg font-semibold text-white">{formatINR(budget.amount)}</p>
              <p className="truncate text-[11px] text-white/50">
                {budgetSourceText(budget)}
                {budget.source === 'default' && canEditBudget && ' · edit to set your own'}
              </p>
            </>
          )}
        </div>

        {/* Remaining */}
        <div
          className={cn(
            'rounded-xl border p-3',
            remaining < 0 ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/[0.04]'
          )}
        >
          <p className="text-[11px] uppercase tracking-wider text-white/50">
            {remaining < 0 ? 'Over budget' : 'Remaining'}
          </p>
          <p
            className={cn(
              'mt-1 truncate font-mono text-lg font-semibold',
              remaining < 0 ? 'text-red-300' : 'text-white'
            )}
          >
            {formatINR(Math.abs(remaining))}
          </p>
          <p className={cn('text-[11px]', tone.text)}>{Math.round(usedPct)}% of budget used</p>
        </div>

        {/* Days left */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Days left</p>
          {isCurrentMonth ? (
            <>
              <p className="mt-1 font-mono text-lg font-semibold text-white">
                {daysLeft}
                <span className="ml-1 text-xs font-normal text-white/50">incl. today</span>
              </p>
              <p className="truncate text-[11px] text-white/50">
                {remaining > 0 ? `${formatINR(perDayLeft, 'never')}/day to stay on budget` : 'No budget left this month'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 font-mono text-lg font-semibold text-white/70">0</p>
              <p className="truncate text-[11px] text-white/50">Month closed · avg {formatINR(averagePerDay, 'never')}/day</p>
            </>
          )}
        </div>
      </div>

      {/* Usage bar; the white tick marks where an even pace would be by today */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <div className="relative">
          <div
            className="h-2 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-label="Budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(Math.round(usedPct), 100)}
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', tone.bar)}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
          {isCurrentMonth && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-white/80"
              style={{ left: `${pacePct}%` }}
            />
          )}
        </div>
        <p className="mt-2 text-[11px] text-white/55">
          {isCurrentMonth ? (
            paceGap >= 0 ? (
              <>
                <span className="text-emerald-300">{formatINR(paceGap, 'never')} under pace</span> · an even pace
                would have spent {formatINR(expectedByToday, 'never')} by today
              </>
            ) : (
              <>
                <span className="text-amber-300">{formatINR(-paceGap, 'never')} ahead of pace</span> · an even
                pace would have spent {formatINR(expectedByToday, 'never')} by today
              </>
            )
          ) : transactionCount === 0 ? (
            <span>No expenses were logged this month.</span>
          ) : remaining >= 0 ? (
            <span className="text-emerald-300">Closed under budget with {formatINR(remaining)} to spare</span>
          ) : (
            <span className="text-red-300">Closed over budget by {formatINR(-remaining)}</span>
          )}
        </p>
      </div>
    </section>
  );
}

export const BudgetOverview = memo(BudgetOverviewInner);
