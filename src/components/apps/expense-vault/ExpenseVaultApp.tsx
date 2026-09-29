// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Vault App
// Monthly spending tracker: overview (spent / budget / remaining /
// days left + pace), quick add, category donut, 30-day trend and an
// editable transaction list. Amounts in rupees, Indian grouping.
// Frame: AppHeader (month title + switcher) over a @container body.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, ChevronLeft, ChevronRight, CircleCheck, Trash2, Undo2 } from 'lucide-react';
import { AppHeader, AppLayout, Button, IconButton } from '@/components/ui';
import { TRANSITION } from '@/styles/tokens';
import {
  monthKeyOfDate,
  resolveMonthBudget,
  sumExpenses,
  useExpenseStore,
} from '@/stores/useExpenseStore';
import type { Expense, ExpenseCategory } from '@/types/expense';
import { BudgetOverview } from './BudgetOverview';
import { BudgetChart } from './BudgetChart';
import { ExpenseEntry } from './ExpenseEntry';
import { TransactionList } from './TransactionList';
import { TrendsGraph } from './TrendsGraph';
import { checkBudgetAlert, checkFirstExpenseAchievement, evaluateBudgetGuardian } from './expense-alerts';
import { EXPENSE_CATEGORY_MAP, formatINR, monthLabel, shiftMonthKey, toDateKey } from './expense-utils';

/** How long the undo / info snackbar stays up. */
const SNACK_MS = 6000;

type Snack =
  | { kind: 'deleted'; expense: Expense }
  | { kind: 'saved'; text: string; monthKey: string | null };

function ExpenseVaultAppInner() {
  const expenses = useExpenseStore((s) => s.expenses);
  const budgets = useExpenseStore((s) => s.budgets);
  const trackingSince = useExpenseStore((s) => s.trackingSince);
  const reduceMotion = useReducedMotion();

  // `now` ticks so "today", days-left and the month rollover stay current
  // while the window is open (render itself never reads the clock).
  const [now, setNow] = useState(() => Date.now());
  const [viewMonth, setViewMonth] = useState(() => toDateKey(Date.now()).slice(0, 7));
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<Snack | null>(null);

  const todayKey = toDateKey(now);
  const currentMonthKey = todayKey.slice(0, 7);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // First open: remember when tracking began; catch up on the first-expense
  // unlock in case the XP store was not ready when the expense was logged.
  useEffect(() => {
    useExpenseStore.getState().startTracking(toDateKey(Date.now()));
    checkFirstExpenseAchievement();
  }, []);

  // "Budget Guardian" is judged when the vault opens and whenever a month closes.
  useEffect(() => {
    evaluateBudgetGuardian(currentMonthKey);
  }, [currentMonthKey]);

  // Snackbar auto-dismiss.
  useEffect(() => {
    if (!snack) return;
    const id = window.setTimeout(() => setSnack(null), SNACK_MS);
    return () => window.clearTimeout(id);
  }, [snack]);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKeyOfDate(e.date) === viewMonth),
    [expenses, viewMonth]
  );
  const spent = useMemo(() => sumExpenses(monthExpenses), [monthExpenses]);
  const budget = useMemo(() => resolveMonthBudget(budgets, viewMonth), [budgets, viewMonth]);
  const editing = useMemo(
    () => (editingId ? expenses.find((e) => e.id === editingId) ?? null : null),
    [expenses, editingId]
  );

  // Month navigation spans from the first tracked month to the current one.
  const earliestMonth = useMemo(() => {
    let earliest = currentMonthKey;
    for (const e of expenses) {
      const key = monthKeyOfDate(e.date);
      if (key < earliest) earliest = key;
    }
    if (trackingSince && monthKeyOfDate(trackingSince) < earliest) earliest = monthKeyOfDate(trackingSince);
    return earliest;
  }, [expenses, trackingSince, currentMonthKey]);

  const canGoBack = viewMonth > earliestMonth;
  const canGoForward = viewMonth < currentMonthKey;
  const isCurrentMonth = viewMonth === currentMonthKey;
  const monthName = monthLabel(viewMonth);
  /** Month a just-saved expense landed in, when that is not the month on screen. */
  const snackMonth = snack?.kind === 'saved' ? snack.monthKey : null;

  const goToMonth = (monthKey: string) => {
    setViewMonth(monthKey);
    setCategoryFilter(null);
  };

  const handleSaved = (expense: Expense, mode: 'added' | 'updated') => {
    const savedMonth = monthKeyOfDate(expense.date);
    const label = EXPENSE_CATEGORY_MAP[expense.category].label;
    if (mode === 'updated') setEditingId(null);
    setSnack({
      kind: 'saved',
      text:
        mode === 'added'
          ? `Logged ${formatINR(expense.amount)} · ${label}`
          : `Saved ${formatINR(expense.amount)} · ${label}`,
      monthKey: savedMonth !== viewMonth ? savedMonth : null,
    });
  };

  const handleDelete = (expense: Expense) => {
    const removed = useExpenseStore.getState().deleteExpense(expense.id);
    if (!removed) return;
    if (editingId === expense.id) setEditingId(null);
    setSnack({ kind: 'deleted', expense: removed });
  };

  const handleUndo = () => {
    if (snack?.kind !== 'deleted') return;
    useExpenseStore.getState().restoreExpense(snack.expense);
    checkBudgetAlert(snack.expense.date, todayKey);
    setSnack(null);
  };

  const subtitle = `${monthExpenses.length} ${monthExpenses.length === 1 ? 'transaction' : 'transactions'} · ${
    isCurrentMonth ? 'month in progress' : 'closed month'
  } · saved on this device`;

  return (
    <AppLayout
      className="relative"
      bodyClassName="@container"
      header={
        <AppHeader
          title={<span aria-live="polite">{monthName}</span>}
          subtitle={subtitle}
          actions={
            <nav className="flex items-center gap-2" aria-label="Month">
              {!isCurrentMonth && (
                <Button variant="ghost" size="sm" leadingIcon={CalendarClock} onClick={() => goToMonth(currentMonthKey)}>
                  This month
                </Button>
              )}
              <div className="flex items-center gap-0.5 rounded-control border border-line-strong bg-surface-2 p-0.5">
                <IconButton
                  icon={ChevronLeft}
                  size="sm"
                  aria-label="Previous month"
                  tooltip
                  disabled={!canGoBack}
                  onClick={() => goToMonth(shiftMonthKey(viewMonth, -1))}
                />
                <IconButton
                  icon={ChevronRight}
                  size="sm"
                  aria-label="Next month"
                  tooltip
                  disabled={!canGoForward}
                  onClick={() => goToMonth(shiftMonthKey(viewMonth, 1))}
                />
              </div>
            </nav>
          }
        />
      }
    >
      <BudgetOverview
        key={viewMonth}
        monthKey={viewMonth}
        todayKey={todayKey}
        spent={spent}
        transactionCount={monthExpenses.length}
        budget={budget}
        canEditBudget={isCurrentMonth}
        onSaveBudget={(amount) => useExpenseStore.getState().setBudget(viewMonth, amount)}
      />

      {/* Narrow: form, donut, trend, list. Wide: charts left, form + list right. */}
      <div className="mt-4 flex flex-col gap-4 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] @3xl:items-start">
        <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-4">
          <BudgetChart
            className="order-2 @3xl:order-none"
            expenses={monthExpenses}
            budget={budget.amount}
            monthName={monthName}
            selected={categoryFilter}
            onSelect={setCategoryFilter}
          />
          <TrendsGraph
            className="order-3 @3xl:order-none"
            expenses={expenses}
            budgets={budgets}
            todayKey={todayKey}
          />
        </div>
        <div className="contents @3xl:flex @3xl:min-w-0 @3xl:flex-col @3xl:gap-4">
          <ExpenseEntry
            key={editing ? editing.id : 'new'}
            className="order-1 @3xl:order-none"
            editing={editing}
            todayKey={todayKey}
            onSaved={handleSaved}
            onCancelEdit={() => setEditingId(null)}
          />
          <TransactionList
            className="order-4 @3xl:order-none @3xl:max-h-[34rem]"
            expenses={monthExpenses}
            monthName={monthName}
            todayKey={todayKey}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            editingId={editingId}
            onEdit={(expense) => setEditingId(expense.id)}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* ─── Snackbar (undo delete / saved to another month) ─── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-5">
        <AnimatePresence>
          {snack && (
            <motion.div
              key={snack.kind === 'deleted' ? `del-${snack.expense.id}` : `saved-${snack.text}`}
              role="status"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 8, transition: TRANSITION.small }}
              transition={TRANSITION.panel}
              className="glass-popover pointer-events-auto flex h-11 max-w-full items-center gap-3 rounded-card pl-3.5 pr-1.5 text-ui text-fg"
            >
              {snack.kind === 'deleted' ? (
                <>
                  <Trash2 size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
                  <span className="truncate">
                    Deleted <span className="tabular font-mono">{formatINR(snack.expense.amount)}</span> ·{' '}
                    {snack.expense.note || EXPENSE_CATEGORY_MAP[snack.expense.category].label}
                  </span>
                  <Button variant="secondary" size="sm" leadingIcon={Undo2} onClick={handleUndo}>
                    Undo
                  </Button>
                </>
              ) : (
                <>
                  <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-success" />
                  <span className={snackMonth ? 'truncate' : 'truncate pr-2'}>{snack.text}</span>
                  {snackMonth && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        goToMonth(snackMonth);
                        setSnack(null);
                      }}
                    >
                      View {monthLabel(snackMonth)}
                    </Button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

export const ExpenseVaultApp = memo(ExpenseVaultAppInner);
