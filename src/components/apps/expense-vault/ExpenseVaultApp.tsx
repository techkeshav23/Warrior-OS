// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Vault App
// Monthly spending tracker: overview (spent / budget / remaining /
// days left), quick add, category donut, 30-day trend and an
// editable transaction list. Amounts in rupees, Indian grouping.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Undo2, Wallet } from 'lucide-react';
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

  return (
    <div className="@container relative flex h-full flex-col bg-black/30 text-white">
      {/* ─── Header ─── */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold tracking-wider text-white">EXPENSE VAULT</h2>
            <p className="truncate text-[11px] text-white/50">
              Every rupee accounted for · saved on this device
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1" aria-label="Month">
          <button
            type="button"
            onClick={() => goToMonth(shiftMonthKey(viewMonth, -1))}
            disabled={!canGoBack}
            className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold text-white" aria-live="polite">
            {monthName}
          </span>
          <button
            type="button"
            onClick={() => goToMonth(shiftMonthKey(viewMonth, 1))}
            disabled={!canGoForward}
            className="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {viewMonth !== currentMonthKey && (
            <button
              type="button"
              onClick={() => goToMonth(currentMonthKey)}
              className="ml-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/20"
            >
              This month
            </button>
          )}
        </nav>
      </header>

      {/* ─── Body ─── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <BudgetOverview
          key={viewMonth}
          monthKey={viewMonth}
          todayKey={todayKey}
          spent={spent}
          transactionCount={monthExpenses.length}
          budget={budget}
          canEditBudget={viewMonth === currentMonthKey}
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
      </div>

      {/* ─── Snackbar (undo delete / saved to another month) ─── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
        <AnimatePresence>
          {snack && (
            <motion.div
              key={snack.kind === 'deleted' ? `del-${snack.expense.id}` : `saved-${snack.text}`}
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border border-white/10 bg-[rgba(12,12,20,0.95)] px-3 py-2 text-xs text-white/85 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md"
            >
              {snack.kind === 'deleted' ? (
                <>
                  <span className="truncate">
                    Deleted {formatINR(snack.expense.amount)} ·{' '}
                    {snack.expense.note || EXPENSE_CATEGORY_MAP[snack.expense.category].label}
                  </span>
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-semibold text-cyan-300 hover:bg-cyan-500/25"
                  >
                    <Undo2 className="h-3 w-3" /> Undo
                  </button>
                </>
              ) : (
                <>
                  <span className="truncate">{snack.text}</span>
                  {snackMonth && (
                    <button
                      type="button"
                      onClick={() => {
                        goToMonth(snackMonth);
                        setSnack(null);
                      }}
                      className="shrink-0 rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-semibold text-cyan-300 hover:bg-cyan-500/25"
                    >
                      View {monthLabel(snackMonth)}
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const ExpenseVaultApp = memo(ExpenseVaultAppInner);
