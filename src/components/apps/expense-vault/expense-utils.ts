// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Expense Vault utilities
// Rupee formatting with Indian digit grouping, category metadata,
// amount parsing and local date/month key helpers
// ═══════════════════════════════════════════════════════════

import { addMonths, format, isValid, parseISO } from 'date-fns';
import { BookOpen, Bus, Clapperboard, Package, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MAX_EXPENSE_AMOUNT } from '@/stores/useExpenseStore';
import { FG, VIZ } from '@/styles/tokens';
import type { ExpenseCategory } from '@/types/expense';

// ─── Categories ───

export interface ExpenseCategoryMeta {
  id: ExpenseCategory;
  label: string;
  /**
   * Series colour (viz palette in order, fixed per category so a filter
   * never repaints the survivors; "Other" is the neutral rest series).
   * Used by the donut, legend, chips and list icons.
   */
  color: string;
  Icon: LucideIcon;
}

export const EXPENSE_CATEGORY_MAP: Record<ExpenseCategory, ExpenseCategoryMeta> = {
  food: { id: 'food', label: 'Food', color: VIZ[0], Icon: UtensilsCrossed },
  transport: { id: 'transport', label: 'Transport', color: VIZ[1], Icon: Bus },
  books: { id: 'books', label: 'Books', color: VIZ[2], Icon: BookOpen },
  entertainment: { id: 'entertainment', label: 'Entertainment', color: VIZ[3], Icon: Clapperboard },
  other: { id: 'other', label: 'Other', color: FG.subtle, Icon: Package },
};

/** Categories in form / legend order. */
export const EXPENSE_CATEGORIES: readonly ExpenseCategoryMeta[] = [
  EXPENSE_CATEGORY_MAP.food,
  EXPENSE_CATEGORY_MAP.transport,
  EXPENSE_CATEGORY_MAP.books,
  EXPENSE_CATEGORY_MAP.entertainment,
  EXPENSE_CATEGORY_MAP.other,
];

// ─── Rupee formatting ───

/** Group an integer digit string the Indian way: 1234567 → 12,34,567. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${lastThree}`;
}

/**
 * Format rupees with Indian digit grouping: 123456.5 → "₹1,23,456.50".
 * paise: 'auto' shows the decimals only when non-zero, 'always' always shows
 * two decimals, 'never' rounds to whole rupees.
 */
export function formatINR(amount: number, paise: 'auto' | 'always' | 'never' = 'auto'): string {
  if (!Number.isFinite(amount)) return '₹0';
  const negative = amount < 0;
  const abs = Math.abs(amount);
  let rupees: number;
  let fraction: number;
  if (paise === 'never') {
    rupees = Math.round(abs);
    fraction = 0;
  } else {
    const totalPaise = Math.round(abs * 100);
    rupees = Math.floor(totalPaise / 100);
    fraction = totalPaise % 100;
  }
  const showFraction = paise === 'always' || (paise === 'auto' && fraction !== 0);
  const body = `${groupIndian(String(rupees))}${showFraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
  const sign = negative && (rupees > 0 || fraction > 0) ? '-' : '';
  return `${sign}₹${body}`;
}

function compactNumber(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '');
}

/** Short rupee label for chart axes: ₹950, ₹12.5k, ₹1.2L, ₹3Cr. */
export function formatINRCompact(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${sign}₹${compactNumber(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${compactNumber(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${compactNumber(abs / 1e3)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

export type AmountParseResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Parse what the user typed into an amount field. Accepts "1,250", "₹99.5",
 * ".75"; rejects negatives, zero, more than two decimals and values above max.
 */
export function parseAmountInput(raw: string, max: number = MAX_EXPENSE_AMOUNT): AmountParseResult {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (!cleaned) return { ok: false, error: 'Enter an amount.' };
  if (cleaned.startsWith('-')) return { ok: false, error: 'Amount must be more than ₹0.' };
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) {
    return { ok: false, error: 'Enter a number, like 250 or 99.50.' };
  }
  const decimals = cleaned.includes('.') ? cleaned.split('.')[1].length : 0;
  if (decimals > 2) return { ok: false, error: 'Use at most 2 decimal places (paise).' };
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'Amount must be more than ₹0.' };
  if (value > max) return { ok: false, error: `Amount can be at most ${formatINR(max)}.` };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

// ─── Local date / month keys ───

/** Oldest date the entry form accepts. */
export const EARLIEST_EXPENSE_DATE = '2000-01-01';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day in 'yyyy-MM-dd' form (rejects 2026-02-31). */
export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value;
}

/** Local day key 'yyyy-MM-dd'. */
export function toDateKey(value: Date | number): string {
  return format(value, 'yyyy-MM-dd');
}

/** Local midnight of the first day of a month key 'yyyy-MM'. */
export function monthStart(monthKey: string): Date {
  return parseISO(`${monthKey}-01`);
}

/** 'September 2026' */
export function monthLabel(monthKey: string): string {
  return format(monthStart(monthKey), 'MMMM yyyy');
}

/** 'Sep 2026' */
export function shortMonthLabel(monthKey: string): string {
  return format(monthStart(monthKey), 'MMM yyyy');
}

/** Month key moved by delta months. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  return format(addMonths(monthStart(monthKey), delta), 'yyyy-MM');
}

/** 'Mon, 28 Sep' */
export function dayLabel(dateKey: string): string {
  return format(parseISO(dateKey), 'EEE, d MMM');
}
