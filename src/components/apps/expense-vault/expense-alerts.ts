// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Vault alerts & achievements
// Budget alerts spoken through NEXUS ('warrior:nexus-say') and the
// vault's achievement checks. Everything here runs from event
// handlers or effects, never during render.
// ═══════════════════════════════════════════════════════════

import { format, getDaysInMonth, parseISO } from 'date-fns';
import {
  monthKeyOfDate,
  monthTotal,
  resolveMonthBudget,
  useExpenseStore,
} from '@/stores/useExpenseStore';
import { useXPStore } from '@/stores/useXPStore';
import type { Expense } from '@/types/expense';
import { formatINR } from './expense-utils';

export const EXPENSE_FIRST_LOG_ACHIEVEMENT_ID = 'expense-first-log';
export const EXPENSE_UNDER_BUDGET_ACHIEVEMENT_ID = 'expense-month-under-budget';

// ─── NEXUS voice (cross-feature event contract) ───

const NEXUS_SAY_EVENT = 'warrior:nexus-say';

type NexusTone = 'info' | 'success' | 'warning' | 'danger';

/**
 * Ask NEXUS to say something. Per the contract the detail is parked in
 * sessionStorage first (so a listener that mounts later still gets it),
 * then the live window event is dispatched.
 */
function nexusSay(text: string, tone: NexusTone): void {
  if (typeof window === 'undefined') return;
  const detail = { text, tone };
  try {
    window.sessionStorage.setItem(`warrior:pending:${NEXUS_SAY_EVENT}`, JSON.stringify(detail));
  } catch {
    // sessionStorage can be unavailable (privacy mode / quota); the live event still fires.
  }
  window.dispatchEvent(new CustomEvent(NEXUS_SAY_EVENT, { detail }));
}

// ─── Budget alerts ───

/**
 * After an expense lands in (or is restored to) the month in progress,
 * warn once at 80% and once at 100% of that month's budget. Changing the
 * budget re-arms both thresholds (see useExpenseStore.setBudget).
 */
export function checkBudgetAlert(expenseDateKey: string, todayKey: string): void {
  const monthKey = monthKeyOfDate(expenseDateKey);
  if (monthKey !== monthKeyOfDate(todayKey)) return;

  const store = useExpenseStore.getState();
  const budget = resolveMonthBudget(store.budgets, monthKey).amount;
  if (budget <= 0) return;
  const spent = monthTotal(store.expenses, monthKey);
  const usedPct = (spent / budget) * 100;
  const alreadySent = store.alertsSent[monthKey] ?? 0;
  const monthName = format(parseISO(`${monthKey}-01`), 'MMMM');

  if (usedPct >= 100 && alreadySent < 100) {
    store.markAlertSent(monthKey, 100);
    const over = spent - budget;
    nexusSay(
      over >= 0.01
        ? `Budget alert: you are ${formatINR(over)} over your ${formatINR(budget)} ${monthName} budget.`
        : `Budget alert: your ${formatINR(budget)} ${monthName} budget is fully used.`,
      'danger'
    );
    return;
  }

  if (usedPct >= 80 && alreadySent < 80) {
    store.markAlertSent(monthKey, 80);
    const today = parseISO(todayKey);
    const daysLeft = getDaysInMonth(today) - Number(todayKey.slice(8, 10)) + 1;
    const perDay = (budget - spent) / Math.max(daysLeft, 1);
    nexusSay(
      `Budget check: ${Math.floor(usedPct)}% of your ${formatINR(budget)} ${monthName} budget is used with ` +
        `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left. About ${formatINR(perDay, 'never')} a day keeps you on track.`,
      'warning'
    );
  }
}

// ─── Achievements ───

/** Unlock "Every Rupee Counts" once the ledger has any entry (idempotent). */
export function checkFirstExpenseAchievement(): void {
  if (useExpenseStore.getState().expenses.length > 0) {
    useXPStore.getState().unlockAchievement(EXPENSE_FIRST_LOG_ACHIEVEMENT_ID);
  }
}

/**
 * First month that qualifies for "Budget Guardian", or null. A month counts
 * when it is over (before the current month), the vault was tracking from
 * its first day, it has at least one logged expense, its budget was chosen
 * by the user (set that month or carried forward, not the untouched
 * default) and its total spending stayed within that budget.
 */
export function findMonthClosedUnderBudget(
  expenses: readonly Expense[],
  budgets: Readonly<Record<string, number>>,
  trackingSince: string | null,
  currentMonthKey: string
): string | null {
  if (!trackingSince) return null;
  const candidates = new Set<string>();
  for (const e of expenses) {
    const monthKey = monthKeyOfDate(e.date);
    if (monthKey < currentMonthKey && trackingSince <= `${monthKey}-01`) candidates.add(monthKey);
  }
  const ordered = Array.from(candidates).sort();
  for (const monthKey of ordered) {
    const budget = resolveMonthBudget(budgets, monthKey);
    if (budget.source === 'default') continue;
    if (monthTotal(expenses, monthKey) <= budget.amount) return monthKey;
  }
  return null;
}

/** Evaluate "Budget Guardian"; runs when the vault opens and when the month rolls over. */
export function evaluateBudgetGuardian(currentMonthKey: string): void {
  const { expenses, budgets, trackingSince } = useExpenseStore.getState();
  if (findMonthClosedUnderBudget(expenses, budgets, trackingSince, currentMonthKey)) {
    useXPStore.getState().unlockAchievement(EXPENSE_UNDER_BUDGET_ACHIEVEMENT_ID);
  }
}
