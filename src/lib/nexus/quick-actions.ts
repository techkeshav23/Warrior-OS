// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Quick Actions (expenses + habits)
// Data-writing actions NEXUS and the Command Palette can run
// without opening an app: log an expense into Expense Vault and
// check off a Habit Forge habit for today (with its XP reward).
// All persistence is local (zustand persist / localStorage).
// ═══════════════════════════════════════════════════════════

import { useExpenseStore, MAX_EXPENSE_AMOUNT } from '@/stores/useExpenseStore';
import { rewardHabitCompletion } from '@/components/apps/habit-forge/streak';
import { utcDayKey } from '@/components/achievements/award';
import type { ExpenseCategory } from '@/types/expense';

export { guessExpenseCategory } from '@/lib/nexus-intent';

// ─── Expenses ───

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: 'Food',
  transport: 'Transport',
  books: 'Books',
  entertainment: 'Entertainment',
  other: 'Other',
};

/** Local calendar day 'yyyy-MM-dd' (Expense Vault days are local). */
function localDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface QuickActionResult {
  ok: boolean;
  reply: string;
}

/** Log an expense for today. */
export function logExpense(amount: number, category: ExpenseCategory, note: string): QuickActionResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reply: 'Amount samajh nahi aaya. Aise bol: "add expense 120 chai".' };
  }
  if (amount > MAX_EXPENSE_AMOUNT) {
    return { ok: false, reply: `${formatRupees(amount)}? Itna bada single expense vault nahi leta.` };
  }
  const store = useExpenseStore.getState();
  const today = localDayKey();
  store.startTracking(today);
  const expense = store.addExpense({ amount, category, note, date: today });

  const month = today.slice(0, 7);
  const spent = store.getMonthTotal(month);
  const budget = store.getMonthBudget(month).amount;
  const left = budget - spent;
  const budgetLine =
    left >= 0
      ? `Is mahine ${formatRupees(spent)} / ${formatRupees(budget)} — ${formatRupees(left)} bacha.`
      : `Budget ${formatRupees(-left)} se cross ho gaya. Haath rok.`;
  const noteText = expense.note ? ` (${expense.note})` : '';
  return {
    ok: true,
    reply: `${formatRupees(expense.amount)} ${EXPENSE_CATEGORY_LABELS[expense.category]}${noteText} log ho gaya. ${budgetLine}`,
  };
}

// ─── Habits (Habit Forge, localStorage 'warrior-habits') ───

const HABITS_KEY = 'warrior-habits';

export interface HabitRef {
  id: string;
  name: string;
  icon: string;
  doneToday: boolean;
}

type StoredHabit = Record<string, unknown> & { id: string; name?: unknown; icon?: unknown; completions: string[] };

function readStoredHabits(): StoredHabit[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HABITS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (h): h is StoredHabit =>
        !!h && typeof h === 'object' && typeof (h as StoredHabit).id === 'string' && Array.isArray((h as StoredHabit).completions)
    );
  } catch {
    return [];
  }
}

/** Habit Forge habits with today's completion state. */
export function listHabits(): HabitRef[] {
  const today = utcDayKey();
  return readStoredHabits().map((h) => ({
    id: h.id,
    name: typeof h.name === 'string' && h.name ? h.name : 'Habit',
    icon: typeof h.icon === 'string' ? h.icon : '',
    doneToday: h.completions.includes(today),
  }));
}

/** Resolve a free-text habit name (exact → prefix → substring → token overlap). */
export function findHabit(query: string, habits: HabitRef[] = listHabits()): HabitRef | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const byName = (pred: (name: string) => boolean) => habits.find((h) => pred(h.name.toLowerCase()));
  const exact = byName((n) => n === q);
  if (exact) return exact;
  const prefix = byName((n) => n.startsWith(q));
  if (prefix) return prefix;
  const sub = byName((n) => n.includes(q) || (n.length >= 4 && q.includes(n)));
  if (sub) return sub;
  const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
  let best: HabitRef | null = null;
  let bestScore = 0;
  for (const h of habits) {
    const words = h.name.toLowerCase().split(/\s+/);
    const score = tokens.filter((t) => words.some((w) => w.startsWith(t))).length;
    if (score > bestScore) {
      best = h;
      bestScore = score;
    }
  }
  return best;
}

/** Check a habit off for today, persist it and pay the Habit Forge reward. */
export function checkHabitToday(query: string): QuickActionResult {
  const habits = listHabits();
  if (habits.length === 0) {
    return { ok: false, reply: 'Habit Forge mein abhi koi habit nahi hai. Pehle ek habit bana.' };
  }
  const habit = findHabit(query, habits);
  if (!habit) {
    const names = habits.slice(0, 5).map((h) => h.name).join(', ');
    return { ok: false, reply: `"${query}" naam ki habit nahi mili. Habits: ${names}.` };
  }
  if (habit.doneToday) return { ok: true, reply: `${habit.icon ? `${habit.icon} ` : ''}${habit.name} aaj already done hai.` };

  const today = utcDayKey();
  const stored = readStoredHabits();
  const updated = stored.map((h) => (h.id === habit.id ? { ...h, completions: [...h.completions, today] } : h));
  try {
    window.localStorage.setItem(HABITS_KEY, JSON.stringify(updated));
  } catch {
    return { ok: false, reply: 'Habit save nahi ho paayi (storage full ya blocked).' };
  }
  // Let an open Habit Forge window (or widgets) re-read the list.
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: HABITS_KEY }));
  } catch {
    /* StorageEvent constructor unavailable — the app re-reads on next mount */
  }

  const reward = rewardHabitCompletion(habit.id);
  const parts: string[] = [];
  if (reward.habitXp > 0) parts.push(`+${reward.habitXp} XP`);
  if (reward.streakBonus > 0) parts.push(`streak bonus +${reward.streakBonus} XP`);
  parts.push(`streak ${reward.streak}d`);
  return { ok: true, reply: `${habit.icon ? `${habit.icon} ` : ''}${habit.name} done for today — ${parts.join(', ')}.` };
}
