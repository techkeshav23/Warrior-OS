// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Types
// Expense Vault: logged expenses, spending categories, monthly budgets
// ═══════════════════════════════════════════════════════════

/** Spending categories offered by the Expense Vault quick-add form. */
export type ExpenseCategory = 'food' | 'transport' | 'books' | 'entertainment' | 'other';

export interface Expense {
  id: string;
  /** Amount in rupees: positive, at most two decimal places. */
  amount: number;
  category: ExpenseCategory;
  /** Free-text note ('' when the user left it empty). */
  note: string;
  /** Local calendar day the money was spent, 'yyyy-MM-dd'. */
  date: string;
  /** ISO timestamp of when the entry was logged. */
  createdAt: string;
  /** ISO timestamp of the last edit (equals createdAt until edited). */
  updatedAt: string;
}

/** The user-editable fields of an expense. */
export type ExpenseInput = Pick<Expense, 'amount' | 'category' | 'note' | 'date'>;

/**
 * Where a month's budget figure comes from:
 * - explicit:  the user set a budget for that very month
 * - inherited: carried forward from the latest earlier month the user set
 * - default:   the user has never set a budget on or before that month
 */
export type ExpenseBudgetSource = 'explicit' | 'inherited' | 'default';

export interface ExpenseMonthBudget {
  /** Budget in rupees (always > 0). */
  amount: number;
  source: ExpenseBudgetSource;
  /** Month key ('yyyy-MM') the figure was set for; null for the default. */
  setFor: string | null;
}

/** Budget-usage alert thresholds, in percent of the month's budget. */
export type ExpenseAlertLevel = 80 | 100;
