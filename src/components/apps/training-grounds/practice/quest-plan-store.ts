// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Quest Plan Store
// The Quest Planner's saved plan (goal, target day, decks) and the
// quests ticked off by hand per day. The daily schedule itself is
// derived live from the learning store (see quest-plan.ts), so it
// always reflects what is actually due and still unseen.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const QUEST_PLAN_STORAGE_KEY = 'warrior-os-quest-plan';

const MAX_GOAL = 120;
const MAX_DECKS = 50;
/** Days of manual check-offs kept. */
const CHECKED_DAYS_KEPT = 45;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface QuestPlan {
  goal: string;
  /** UTC day key 'YYYY-MM-DD' of the target. */
  targetDate: string;
  /** Decks the plan covers. */
  deckIds: string[];
  /** UTC day key when the plan was first forged (drives the daily topic rotation). */
  startDate: string;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms of the last edit. */
  updatedAt: number;
}

export interface QuestPlanInput {
  goal: string;
  targetDate: string;
  deckIds: readonly string[];
}

interface QuestPlanStore {
  plan: QuestPlan | null;
  /** Quests ticked off by hand: UTC day key → quest ids. */
  checked: Record<string, string[]>;

  /** Create or update the plan; false when the input is unusable. `today` is a UTC day key. */
  savePlan: (input: QuestPlanInput, today: string) => boolean;
  clearPlan: () => void;
  /** Tick or untick one quest of a day; returns true when it is now ticked. */
  toggleQuest: (day: string, questId: string) => boolean;
}

type PersistedQuestPlan = Pick<QuestPlanStore, 'plan' | 'checked'>;

function cleanDeckIds(ids: readonly unknown[]): string[] {
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, MAX_DECKS);
}

function sanitizePlan(raw: unknown): QuestPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.targetDate !== 'string' || !DAY_KEY.test(p.targetDate)) return null;
  if (!Array.isArray(p.deckIds)) return null;
  const now = Date.now();
  return {
    goal: typeof p.goal === 'string' ? p.goal.slice(0, MAX_GOAL) : '',
    targetDate: p.targetDate,
    deckIds: cleanDeckIds(p.deckIds),
    startDate: typeof p.startDate === 'string' && DAY_KEY.test(p.startDate) ? p.startDate : p.targetDate,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : now,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : now,
  };
}

function sanitizeChecked(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [day, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (DAY_KEY.test(day) && Array.isArray(ids)) out[day] = ids.filter((id): id is string => typeof id === 'string');
  }
  return out;
}

/** Keep the most recent CHECKED_DAYS_KEPT days. */
function pruneChecked(checked: Record<string, string[]>): Record<string, string[]> {
  const days = Object.keys(checked).sort();
  if (days.length <= CHECKED_DAYS_KEPT) return checked;
  const keep = new Set(days.slice(-CHECKED_DAYS_KEPT));
  return Object.fromEntries(Object.entries(checked).filter(([day]) => keep.has(day)));
}

export const useQuestPlanStore = create<QuestPlanStore>()(
  persist(
    (set, get) => ({
      plan: null,
      checked: {},

      savePlan: (input, today) => {
        const deckIds = cleanDeckIds(input.deckIds);
        if (!DAY_KEY.test(input.targetDate) || !DAY_KEY.test(today) || deckIds.length === 0) return false;
        const now = Date.now();
        // Editing a running plan keeps its start; one forged after the old target passed starts fresh.
        const previous = get().plan;
        const continuing = previous !== null && previous.targetDate >= today;
        set({
          plan: {
            goal: input.goal.trim().slice(0, MAX_GOAL),
            targetDate: input.targetDate,
            deckIds,
            startDate: continuing ? previous.startDate : today,
            createdAt: continuing ? previous.createdAt : now,
            updatedAt: now,
          },
        });
        return true;
      },

      clearPlan: () => set({ plan: null, checked: {} }),

      toggleQuest: (day, questId) => {
        const current = get().checked[day] ?? [];
        const ticked = !current.includes(questId);
        const next = ticked ? [...current, questId] : current.filter((id) => id !== questId);
        set({ checked: pruneChecked({ ...get().checked, [day]: next }) });
        return ticked;
      },
    }),
    {
      name: QUEST_PLAN_STORAGE_KEY,
      version: 1,
      partialize: (state): PersistedQuestPlan => ({ plan: state.plan, checked: state.checked }),
      // Shape-check saved state so a corrupted key can never crash the planner.
      merge: (persisted, current) => {
        const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
        return { ...current, plan: sanitizePlan(p.plan), checked: sanitizeChecked(p.checked) };
      },
    }
  )
);
