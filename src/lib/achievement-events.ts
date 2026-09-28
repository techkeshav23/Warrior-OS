// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Events
// One call for any feature that wants achievements without owning
// counters:   trackEvent('phantom_resurrected')
//             trackEvent('typing_wpm', { value: 104 })
//             trackEvent('dream_subject', { key: 'DBMS' })
//             trackEvent('music_listen_seconds', { amount: 60 })
// Each event keeps durable stats (count, sum of amounts, max value,
// distinct keys) in localStorage, then every rule for that event is
// checked and met rules unlock their achievement. Unlocks are
// idempotent and wait until the XP store is hydrated and its catalogue
// seeded, so calling this at boot, offline or twice is always safe.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useXPStore } from '@/stores/useXPStore';
import { ensureCatalogueSeeded, whenXPStoreReady } from '@/components/achievements/award';

/** Distinct keys kept per event (enough for 365 days + subjects). */
const MAX_DISTINCT_KEYS = 400;

export type EventMetric = 'count' | 'sum' | 'max' | 'distinct';

export interface AchievementRule {
  /** Achievement id in the catalogue. */
  id: string;
  metric: EventMetric;
  /** Unlocks once the metric is >= threshold. */
  threshold: number;
}

/** Event → rules. Features may track any event name; unknown ones only count. */
export const ACHIEVEMENT_EVENT_RULES = {
  // Creature (6.69)
  creature_hatched: [{ id: 'first-pet', metric: 'count', threshold: 1 }],
  creature_teen: [{ id: 'creature-growing-up', metric: 'count', threshold: 1 }],
  creature_form_changed: [{ id: 'creature-evolution', metric: 'count', threshold: 1 }],
  creature_legendary: [{ id: 'creature-legendary', metric: 'count', threshold: 1 }],
  creature_mythic: [{ id: 'creature-mythic', metric: 'count', threshold: 1 }],
  /** value = consecutive happy days */
  creature_happy_streak: [{ id: 'creature-happy-week', metric: 'max', threshold: 7 }],

  // Ghost warriors (6.70)
  /** value = other real warriors online right now */
  ghost_others_online: [{ id: 'ghost-not-alone', metric: 'max', threshold: 1 }],
  ghost_war_cry_sent: [{ id: 'ghost-first-cry', metric: 'count', threshold: 1 }],
  /** value = warriors online right now (including you) */
  ghost_online: [{ id: 'ghost-campfire-bonfire', metric: 'max', threshold: 10 }],
  ghost_rank_first: [{ id: 'ghost-top-warrior', metric: 'count', threshold: 1 }],
  /** amount = minutes online with other warriors */
  ghost_minutes_together: [{ id: 'ghost-band-of-brothers', metric: 'sum', threshold: 50 * 60 }],

  // Memory palace (6.71)
  palace_entered: [{ id: 'palace-architect', metric: 'count', threshold: 1 }],
  /** value = knowledge objects in the palace */
  palace_objects: [{ id: 'palace-grand-library', metric: 'max', threshold: 50 }],
  /** value = 1 once every subject room has been visited */
  palace_all_rooms_visited: [{ id: 'palace-of-wisdom', metric: 'count', threshold: 1 }],
  palace_object_revised: [{ id: 'palace-curator', metric: 'count', threshold: 100 }],

  // Biometrics (6.72)
  biometrics_read: [{ id: 'biometrics-first-read', metric: 'count', threshold: 1 }],
  /** key = day ('YYYY-MM-DD') the history was checked */
  biometrics_checked: [{ id: 'biometrics-self-aware', metric: 'distinct', threshold: 30 }],
  /** value = minutes focus has stayed above 95% */
  biometrics_zone_minutes: [{ id: 'biometrics-zone-hour', metric: 'max', threshold: 60 }],
  /** value = minutes stress has stayed below 10% */
  biometrics_calm_minutes: [{ id: 'biometrics-zen-master', metric: 'max', threshold: 120 }],
  /** value = words per minute */
  typing_wpm: [{ id: 'biometrics-speedster', metric: 'max', threshold: 100 }],

  // Decay + breaks (6.73)
  decay_stage_reached: [{ id: 'decay-mortal', metric: 'count', threshold: 1 }],
  decay_full: [
    { id: 'decay-legendary-focus', metric: 'count', threshold: 1 },
    { id: 'decay-iron-body', metric: 'count', threshold: 10 },
  ],
  decay_forced_break: [
    { id: 'decay-first-break', metric: 'count', threshold: 1 },
    { id: 'decay-balanced-warrior', metric: 'count', threshold: 50 },
  ],
  decay_machine_day: [{ id: 'decay-the-machine', metric: 'count', threshold: 1 }],

  // Dreams (6.74)
  dream_seen: [{ id: 'dream-first', metric: 'count', threshold: 1 }],
  /** key = day the dream played */
  dream_day: [{ id: 'dream-lucid', metric: 'distinct', threshold: 30 }],
  dream_void_seen: [{ id: 'dream-nightmare', metric: 'count', threshold: 1 }],
  /** key = dream subject */
  dream_subject: [{ id: 'dream-walker', metric: 'distinct', threshold: 5 }],

  // Phantom windows (6.75)
  phantom_spawned: [{ id: 'phantom-first-ghost', metric: 'count', threshold: 1 }],
  phantom_resurrected: [
    { id: 'phantom-resurrect', metric: 'count', threshold: 1 },
    { id: 'phantom-necromancer', metric: 'count', threshold: 50 },
  ],
  phantom_dissolved: [{ id: 'phantom-let-it-go', metric: 'count', threshold: 100 }],

  // Procedural music (6.76)
  /** amount = seconds listened (any mode) */
  music_listen_seconds: [{ id: 'music-composer', metric: 'sum', threshold: 10 * 60 * 60 }],
  /** amount = seconds listened in Typing Rhythm mode */
  music_rhythm_seconds: [{ id: 'music-rhythm-master', metric: 'sum', threshold: 5 * 60 * 60 }],
  music_night_past_midnight: [{ id: 'music-night-music', metric: 'count', threshold: 1 }],
  /** value = distinct modes used today */
  music_modes_today: [{ id: 'music-full-orchestra', metric: 'max', threshold: 4 }],

  // Core
  note_created: [{ id: 'first-note', metric: 'count', threshold: 1 }],
  achievement_gallery_opened: [{ id: 'trophy-room', metric: 'count', threshold: 1 }],
  daily_target_met: [{ id: 'target-crushed', metric: 'count', threshold: 1 }],
  pwa_installed: [{ id: 'pwa-installed', metric: 'count', threshold: 1 }],
} as const satisfies Record<string, readonly AchievementRule[]>;

export type AchievementEventName = keyof typeof ACHIEVEMENT_EVENT_RULES;

export interface EventDetail {
  /** Added to the event's running sum (default 0). */
  amount?: number;
  /** Compared against the event's max. */
  value?: number;
  /** Added to the event's distinct-key set. */
  key?: string;
}

export interface EventStats {
  count: number;
  sum: number;
  max: number;
  keys: string[];
}

const EMPTY_STATS: EventStats = { count: 0, sum: 0, max: 0, keys: [] };

interface AchievementEventsState {
  events: Record<string, EventStats>;
  record: (name: string, detail: EventDetail) => EventStats;
  reset: () => void;
}

function finite(n: number | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export const useAchievementEventsStore = create<AchievementEventsState>()(
  persist(
    (set, get) => ({
      events: {},
      record: (name, detail) => {
        const prev = get().events[name] ?? EMPTY_STATS;
        const amount = finite(detail.amount);
        const value = finite(detail.value);
        const key = typeof detail.key === 'string' ? detail.key.trim().slice(0, 80) : '';
        let keys = prev.keys;
        if (key && !keys.includes(key)) {
          keys = [...keys, key];
          if (keys.length > MAX_DISTINCT_KEYS) keys = keys.slice(keys.length - MAX_DISTINCT_KEYS);
        }
        const next: EventStats = {
          count: prev.count + 1,
          sum: prev.sum + (amount !== null && amount > 0 ? amount : 0),
          max: value !== null ? Math.max(prev.max, value) : prev.max,
          keys,
        };
        set({ events: { ...get().events, [name]: next } });
        return next;
      },
      reset: () => set({ events: {} }),
    }),
    {
      name: 'warrior-os-achievement-events',
      partialize: (state) => ({ events: state.events }),
    }
  )
);

function metricValue(stats: EventStats, metric: EventMetric): number {
  switch (metric) {
    case 'count':
      return stats.count;
    case 'sum':
      return stats.sum;
    case 'max':
      return stats.max;
    case 'distinct':
      return stats.keys.length;
  }
}

function rulesFor(name: string): readonly AchievementRule[] {
  return (ACHIEVEMENT_EVENT_RULES as Record<string, readonly AchievementRule[]>)[name] ?? [];
}

function isUnlocked(id: string): boolean {
  return Boolean(useXPStore.getState().achievements.find((a) => a.id === id)?.unlockedAt);
}

/** Unlock after hydration + seeding; a no-op for ids the catalogue does not list. */
function unlockWhenReady(id: string): void {
  whenXPStoreReady(() => {
    try {
      ensureCatalogueSeeded();
      if (!isUnlocked(id)) useXPStore.getState().unlockAchievement(id);
    } catch {
      /* an achievement must never break the feature that tracked it */
    }
  });
}

/** Unlock every rule of `name` whose threshold `stats` meets. Returns the ids met. */
function applyRules(name: string, stats: EventStats): string[] {
  const met: string[] = [];
  for (const rule of rulesFor(name)) {
    if (metricValue(stats, rule.metric) >= rule.threshold) {
      met.push(rule.id);
      if (!isUnlocked(rule.id)) unlockWhenReady(rule.id);
    }
  }
  return met;
}

/**
 * Record one occurrence of `name` and unlock any achievement it earns.
 * SSR-safe (a no-op on the server). Returns the updated stats.
 */
export function trackEvent(name: AchievementEventName | (string & {}), detail: EventDetail = {}): EventStats {
  if (typeof window === 'undefined') return EMPTY_STATS;
  try {
    const run = () => applyRules(name, useAchievementEventsStore.getState().record(name, detail));
    if (useAchievementEventsStore.persist.hasHydrated()) {
      run();
    } else {
      // Record after rehydration so a persisted total is never overwritten.
      const unsub = useAchievementEventsStore.persist.onFinishHydration(() => {
        unsub();
        run();
      });
    }
  } catch {
    /* storage blocked or similar: achievements are an enhancement */
  }
  return getEventStats(name);
}

/** Current stats for `name` (zeros when never tracked). */
export function getEventStats(name: string): EventStats {
  return useAchievementEventsStore.getState().events[name] ?? EMPTY_STATS;
}

/**
 * Re-check every rule against the saved stats (e.g. after the catalogue
 * gained new definitions). Call once at startup; idempotent.
 */
export function reconcileAchievementEvents(): void {
  if (typeof window === 'undefined') return;
  const run = () => {
    const { events } = useAchievementEventsStore.getState();
    for (const [name, stats] of Object.entries(events)) applyRules(name, stats);
  };
  if (useAchievementEventsStore.persist.hasHydrated()) run();
  else {
    const unsub = useAchievementEventsStore.persist.onFinishHydration(() => {
      unsub();
      run();
    });
  }
}
