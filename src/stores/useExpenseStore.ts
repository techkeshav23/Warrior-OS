// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Store
// Expense Vault ledger, per-month budgets and budget-alert
// bookkeeping. Persisted to localStorage; nothing touches the network.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';
import { generateId } from '@/lib/utils';
import type {
  Expense,
  ExpenseAlertLevel,
  ExpenseCategory,
  ExpenseInput,
  ExpenseMonthBudget,
} from '@/types/expense';

/** Budget shown for months before the user has ever set one (₹10,000). */
export const DEFAULT_MONTHLY_BUDGET = 10_000;
/** Largest single expense the vault accepts (₹10,00,000). */
export const MAX_EXPENSE_AMOUNT = 1_000_000;
/** Largest monthly budget accepted (₹1,00,00,000). */
export const MAX_MONTHLY_BUDGET = 10_000_000;
/** Longest note kept on an expense. */
export const MAX_EXPENSE_NOTE_LENGTH = 80;
/** Ledger cap so localStorage stays bounded; the oldest entries drop first. */
export const MAX_STORED_EXPENSES = 5_000;

const EXPENSE_CATEGORY_IDS: readonly ExpenseCategory[] = [
  'food',
  'transport',
  'books',
  'entertainment',
  'other',
];

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

// ─── Pure helpers (safe to call from useMemo with raw store fields) ───

/** Rupees → integer paise, so sums never pick up floating-point dust. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Round a rupee amount to two decimals. */
export function roundRupees(rupees: number): number {
  return toPaise(rupees) / 100;
}

/** Month key 'yyyy-MM' of a 'yyyy-MM-dd' day key. */
export function monthKeyOfDate(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** Exact sum of a list of expenses, in rupees. */
export function sumExpenses(list: readonly Expense[]): number {
  let paise = 0;
  for (const e of list) paise += toPaise(e.amount);
  return paise / 100;
}

/** Exact total spent in one month ('yyyy-MM'), in rupees. */
export function monthTotal(expenses: readonly Expense[], monthKey: string): number {
  let paise = 0;
  for (const e of expenses) {
    if (monthKeyOfDate(e.date) === monthKey) paise += toPaise(e.amount);
  }
  return paise / 100;
}

/**
 * Budget for a month: the figure set for that month, else the latest earlier
 * month the user set (budgets carry forward), else DEFAULT_MONTHLY_BUDGET.
 */
export function resolveMonthBudget(
  budgets: Readonly<Record<string, number>>,
  monthKey: string
): ExpenseMonthBudget {
  const own = budgets[monthKey];
  if (typeof own === 'number' && own > 0) {
    return { amount: own, source: 'explicit', setFor: monthKey };
  }
  let latestEarlier: string | null = null;
  for (const key of Object.keys(budgets)) {
    if (key < monthKey && budgets[key] > 0 && (latestEarlier === null || key > latestEarlier)) {
      latestEarlier = key;
    }
  }
  if (latestEarlier !== null) {
    return { amount: budgets[latestEarlier], source: 'inherited', setFor: latestEarlier };
  }
  return { amount: DEFAULT_MONTHLY_BUDGET, source: 'default', setFor: null };
}

function normalizeInput(input: ExpenseInput): ExpenseInput {
  const amount = Number.isFinite(input.amount) ? roundRupees(input.amount) : 0;
  return {
    amount: Math.min(Math.max(amount, 0.01), MAX_EXPENSE_AMOUNT),
    category: EXPENSE_CATEGORY_IDS.includes(input.category) ? input.category : 'other',
    note: input.note.trim().slice(0, MAX_EXPENSE_NOTE_LENGTH),
    date: input.date,
  };
}

/** Oldest first: by day, then by when it was logged. */
function compareOldestFirst(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return 0;
}

// ─── Persisted-state sanitising (guards against hand-edited / corrupt storage) ───

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeExpense(raw: unknown): Expense | null {
  if (!isRecord(raw)) return null;
  const { id, amount, category, note, date, createdAt, updatedAt } = raw;
  if (typeof id !== 'string' || !id) return null;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return null;
  if (typeof date !== 'string' || !DATE_KEY_RE.test(date)) return null;
  const created = typeof createdAt === 'string' ? createdAt : `${date}T00:00:00.000Z`;
  return {
    id,
    amount: roundRupees(amount),
    category: EXPENSE_CATEGORY_IDS.includes(category as ExpenseCategory)
      ? (category as ExpenseCategory)
      : 'other',
    note: typeof note === 'string' ? note.slice(0, MAX_EXPENSE_NOTE_LENGTH) : '',
    date,
    createdAt: created,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : created,
  };
}

// ─── Store ───

interface ExpenseStore {
  expenses: Expense[];
  /** Explicit budgets in rupees, keyed by month 'yyyy-MM'. */
  budgets: Record<string, number>;
  /** Highest budget alert already delivered for a month 'yyyy-MM'. */
  alertsSent: Record<string, ExpenseAlertLevel>;
  /** First local day ('yyyy-MM-dd') covered by the vault; null before first use. */
  trackingSince: string | null;

  // Actions
  addExpense: (input: ExpenseInput) => Expense;
  updateExpense: (id: string, input: ExpenseInput) => Expense | null;
  /** Removes an expense and returns it (for undo), or null if it did not exist. */
  deleteExpense: (id: string) => Expense | null;
  /** Re-inserts a previously deleted expense (undo). */
  restoreExpense: (expense: Expense) => void;
  /** Sets the budget for one month; later months without their own figure inherit it. */
  setBudget: (monthKey: string, amount: number) => void;
  markAlertSent: (monthKey: string, level: ExpenseAlertLevel) => void;
  /** Records the first day the vault was used (no-op once set). */
  startTracking: (todayKey: string) => void;

  // Queries — call through getState(); in components select raw fields and
  // derive with the pure helpers above (a selector returning a fresh object
  // re-renders forever in zustand v5).
  getMonthTotal: (monthKey: string) => number;
  getMonthBudget: (monthKey: string) => ExpenseMonthBudget;
}

export const useExpenseStore = create<ExpenseStore>()(
  persist(
    immer((set, get) => ({
      expenses: [],
      budgets: {},
      alertsSent: {},
      trackingSince: null,

      addExpense: (input) => {
        const clean = normalizeInput(input);
        const stamp = new Date().toISOString();
        const expense: Expense = {
          id: generateId('exp'),
          ...clean,
          createdAt: stamp,
          updatedAt: stamp,
        };
        set((s) => {
          s.expenses.push(expense);
          if (s.expenses.length > MAX_STORED_EXPENSES) {
            s.expenses.sort(compareOldestFirst);
            s.expenses.splice(0, s.expenses.length - MAX_STORED_EXPENSES);
          }
          if (s.trackingSince === null || expense.date < s.trackingSince) {
            s.trackingSince = expense.date;
          }
        });
        return expense;
      },

      updateExpense: (id, input) => {
        if (!get().expenses.some((e) => e.id === id)) return null;
        const clean = normalizeInput(input);
        const stamp = new Date().toISOString();
        set((s) => {
          const target = s.expenses.find((e) => e.id === id);
          if (!target) return;
          target.amount = clean.amount;
          target.category = clean.category;
          target.note = clean.note;
          target.date = clean.date;
          target.updatedAt = stamp;
          if (s.trackingSince === null || clean.date < s.trackingSince) {
            s.trackingSince = clean.date;
          }
        });
        return get().expenses.find((e) => e.id === id) ?? null;
      },

      deleteExpense: (id) => {
        const existing = get().expenses.find((e) => e.id === id);
        if (!existing) return null;
        set((s) => {
          s.expenses = s.expenses.filter((e) => e.id !== id);
        });
        return existing;
      },

      restoreExpense: (expense) =>
        set((s) => {
          if (s.expenses.some((e) => e.id === expense.id)) return;
          s.expenses.push({ ...expense });
          if (s.trackingSince === null || expense.date < s.trackingSince) {
            s.trackingSince = expense.date;
          }
        }),

      setBudget: (monthKey, amount) => {
        if (!MONTH_KEY_RE.test(monthKey)) return;
        if (!Number.isFinite(amount) || amount <= 0) return;
        const clean = Math.min(roundRupees(amount), MAX_MONTHLY_BUDGET);
        set((s) => {
          s.budgets[monthKey] = clean;
          // The alert thresholds moved with the budget, so allow them to fire again.
          delete s.alertsSent[monthKey];
        });
      },

      markAlertSent: (monthKey, level) =>
        set((s) => {
          s.alertsSent[monthKey] = level;
        }),

      startTracking: (todayKey) =>
        set((s) => {
          if (s.trackingSince === null && DATE_KEY_RE.test(todayKey)) {
            s.trackingSince = todayKey;
          }
        }),

      getMonthTotal: (monthKey) => monthTotal(get().expenses, monthKey),

      getMonthBudget: (monthKey) => resolveMonthBudget(get().budgets, monthKey),
    })),
    {
      name: 'warrior-os-expenses',
      partialize: (state) => ({
        expenses: state.expenses,
        budgets: state.budgets,
        alertsSent: state.alertsSent,
        trackingSince: state.trackingSince,
      }),
      merge: (persisted, current) => {
        if (!isRecord(persisted)) return current;
        const rawExpenses = persisted.expenses;
        const rawBudgets = persisted.budgets;
        const rawAlerts = persisted.alertsSent;

        const expenses = Array.isArray(rawExpenses)
          ? rawExpenses.map(sanitizeExpense).filter((e): e is Expense => e !== null)
          : current.expenses;

        const budgets: Record<string, number> = {};
        if (isRecord(rawBudgets)) {
          for (const [key, value] of Object.entries(rawBudgets)) {
            if (MONTH_KEY_RE.test(key) && typeof value === 'number' && Number.isFinite(value) && value > 0) {
              budgets[key] = Math.min(roundRupees(value), MAX_MONTHLY_BUDGET);
            }
          }
        }

        const alertsSent: Record<string, ExpenseAlertLevel> = {};
        if (isRecord(rawAlerts)) {
          for (const [key, value] of Object.entries(rawAlerts)) {
            if (!MONTH_KEY_RE.test(key)) continue;
            if (value === 80) alertsSent[key] = 80;
            else if (value === 100) alertsSent[key] = 100;
          }
        }

        const since = persisted.trackingSince;
        const trackingSince =
          typeof since === 'string' && DATE_KEY_RE.test(since) ? since : current.trackingSince;

        return { ...current, expenses, budgets, alertsSent, trackingSince };
      },
    }
  )
);
