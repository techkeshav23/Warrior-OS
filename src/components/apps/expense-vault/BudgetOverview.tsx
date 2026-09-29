// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Budget Overview
// Month summary for Expense Vault: stat tiles for spent, budget
// (editable for the month in progress), remaining and days left,
// plus a pace bar: actual spending against an even pace to today.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CalendarClock, Check, Coins, IndianRupee, Lock, Pencil, PiggyBank, ReceiptIndianRupee, X } from 'lucide-react';
import { getDaysInMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge, IconButton, Input, StatTile } from '@/components/ui';
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

type UsageTone = 'success' | 'warning' | 'danger';

function usageTone(pct: number): UsageTone {
  if (pct > 100) return 'danger';
  if (pct >= 80) return 'warning';
  return 'success';
}

const TONE_TEXT: Record<UsageTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const TONE_FILL: Record<UsageTone, string> = {
  success: 'from-success/60 to-success',
  warning: 'from-warning/60 to-warning',
  danger: 'from-danger/60 to-danger',
};

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
        <StatTile
          label="Spent"
          icon={ReceiptIndianRupee}
          value={formatINR(spent)}
          deltaLabel={`${transactionCount} ${transactionCount === 1 ? 'transaction' : 'transactions'}`}
        />

        {/* Budget: same anatomy as StatTile, with an inline editor */}
        <div className="glass-panel relative flex min-w-0 flex-col gap-3 rounded-card p-4">
          <div className="flex h-4 items-center justify-between gap-2">
            <label htmlFor={inputId} className="hud-label truncate">
              Budget
            </label>
            {canEditBudget && !editing && (
              <IconButton
                icon={Pencil}
                size="xs"
                aria-label="Edit this month's budget"
                tooltip="Edit budget"
                onClick={startEditing}
                className="-my-1 -mr-1"
              />
            )}
            {!canEditBudget && (
              <span title="Closed months keep the budget they ran on">
                <Badge size="sm" icon={Lock}>
                  Closed
                </Badge>
              </span>
            )}
            {canEditBudget && editing && <PiggyBank size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />}
          </div>
          {editing && canEditBudget ? (
            <form onSubmit={commit} className="animate-fade-in">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <Input
                    id={inputId}
                    size="sm"
                    leadingIcon={IndianRupee}
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={onDraftKeyDown}
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus
                    error={error}
                    className="tabular font-mono"
                  />
                </div>
                <IconButton icon={Check} type="submit" size="sm" variant="primary" aria-label="Save budget" />
                <IconButton icon={X} size="sm" aria-label="Cancel editing budget" onClick={cancelEditing} />
              </div>
            </form>
          ) : (
            <div className="min-w-0">
              <p className="tabular truncate font-display text-2xl font-semibold leading-none text-fg">
                {formatINR(budget.amount)}
              </p>
              <p className="mt-2 truncate text-xs text-fg-subtle">
                {budgetSourceText(budget)}
                {budget.source === 'default' && canEditBudget && ' · edit to set your own'}
              </p>
            </div>
          )}
        </div>

        <StatTile
          label={remaining < 0 ? 'Over budget' : 'Remaining'}
          icon={Coins}
          value={<span className={remaining < 0 ? 'text-danger' : undefined}>{formatINR(Math.abs(remaining))}</span>}
          delta={`${Math.round(usedPct)}% used`}
          deltaTone={tone === 'danger' ? 'negative' : tone === 'success' ? 'positive' : 'neutral'}
          className={cn(remaining < 0 && 'border-danger/30 bg-danger/[0.06]')}
        />

        {isCurrentMonth ? (
          <StatTile
            label="Days left"
            icon={CalendarClock}
            value={daysLeft}
            unit="incl. today"
            deltaLabel={
              remaining > 0 ? `${formatINR(perDayLeft, 'never')}/day to stay on budget` : 'No budget left this month'
            }
          />
        ) : (
          <StatTile
            label="Days left"
            icon={CalendarClock}
            value={<span className="text-fg-muted">0</span>}
            unit="month closed"
            deltaLabel={`Averaged ${formatINR(averagePerDay, 'never')}/day`}
          />
        )}
      </div>

      {/* Pace: hatched zone = where an even pace would be by today; tick = today */}
      <div className="glass-panel rounded-card px-4 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="hud-label">Budget pace</span>
          <span className="tabular font-mono text-xs text-fg-muted">
            <span className={TONE_TEXT[tone]}>{Math.round(usedPct)}%</span> used
            {isCurrentMonth && ` · day ${dayOfMonth} of ${daysInMonth}`}
          </span>
        </div>
        <div className="relative mt-3">
          <div
            className="relative h-2 overflow-hidden rounded-full bg-ink-600/70"
            role="progressbar"
            aria-label="Budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(Math.round(usedPct), 100)}
          >
            {isCurrentMonth && (
              <div
                aria-hidden="true"
                className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(135deg,var(--color-line-strong)_0_3px,transparent_3px_7px)]"
                style={{ width: `${pacePct}%` }}
              />
            )}
            <div
              className={cn(
                'relative h-full rounded-full bg-linear-to-r transition-[width] duration-260 ease-out-quint',
                TONE_FILL[tone]
              )}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
          {isCurrentMonth && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-fg shadow-[0_0_0_2px_var(--color-ink-900)]"
              style={{ left: `${pacePct}%` }}
            />
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-fg-muted">
          <p className="min-w-0">
            {isCurrentMonth ? (
              paceGap >= 0 ? (
                <>
                  <span className="font-medium text-success">{formatINR(paceGap, 'never')} under pace</span> · an even
                  pace would have spent <span className="tabular font-mono">{formatINR(expectedByToday, 'never')}</span> by
                  today
                </>
              ) : (
                <>
                  <span className="font-medium text-warning">{formatINR(-paceGap, 'never')} ahead of pace</span> · an even
                  pace would have spent <span className="tabular font-mono">{formatINR(expectedByToday, 'never')}</span> by
                  today
                </>
              )
            ) : transactionCount === 0 ? (
              <span>No expenses were logged this month.</span>
            ) : remaining >= 0 ? (
              <span className="font-medium text-success">Closed under budget with {formatINR(remaining)} to spare</span>
            ) : (
              <span className="font-medium text-danger">Closed over budget by {formatINR(-remaining)}</span>
            )}
          </p>
          {isCurrentMonth && (
            <span className="flex shrink-0 items-center gap-1.5 text-fg-subtle">
              <span aria-hidden className="h-3 w-0.5 rounded-full bg-fg" /> Even pace today
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export const BudgetOverview = memo(BudgetOverviewInner);
