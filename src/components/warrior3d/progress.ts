// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: progression → look
// Reads the owner's real data straight from the stores:
//   level / title   ← useXPStore (LEVEL_THRESHOLDS)
//   streak          ← habits in localStorage (NEXUS computeHabitStreak)
//   decay stage     ← useDecayStore
// and turns it into a WarriorLook (trim colour, glow, aura, damage).
// ═══════════════════════════════════════════════════════════

import { useMemo, useSyncExternalStore } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { LEVEL_THRESHOLDS } from '@/lib/constants';
import { computeHabitStreak, loadHabitsLite } from '@/lib/nexus/context';
import type { WarriorLook, WarriorProgress, WarriorTier } from './types';

export interface WarriorTierInfo {
  tier: WarriorTier;
  /** Rank title (reused from LEVEL_THRESHOLDS) that opens the bracket. */
  name: string;
  minLevel: number;
  maxLevel: number;
  trim: string;
  accent: string;
  glow: number;
}

/** Level brackets → armor tiers. Names are the app's own rank titles. */
export const WARRIOR_TIERS: readonly WarriorTierInfo[] = [
  { tier: 1, name: 'Recruit', minLevel: 1, maxLevel: 4, trim: '#2fd6f5', accent: '#0b8fad', glow: 1.0 },
  { tier: 2, name: 'Warrior', minLevel: 5, maxLevel: 7, trim: '#ff8a3d', accent: '#2fd6f5', glow: 1.1 },
  { tier: 3, name: 'Champion', minLevel: 8, maxLevel: 12, trim: '#ff6a1a', accent: '#ffb27a', glow: 1.2 },
  { tier: 4, name: 'Legendary', minLevel: 13, maxLevel: 16, trim: '#f5c04a', accent: '#ff8a3d', glow: 1.3 },
  { tier: 5, name: 'Ascendant', minLevel: 17, maxLevel: 20, trim: '#ffd89a', accent: '#7ce7fb', glow: 1.4 },
];

export function tierInfo(tier: WarriorTier): WarriorTierInfo {
  return WARRIOR_TIERS[tier - 1];
}

export function tierForLevel(level: number): WarriorTier {
  for (let i = WARRIOR_TIERS.length - 1; i >= 0; i--) {
    if (level >= WARRIOR_TIERS[i].minLevel) return WARRIOR_TIERS[i].tier;
  }
  return 1;
}

function titleForLevel(level: number): string {
  return LEVEL_THRESHOLDS.find((l) => l.level === level)?.title ?? 'Recruit';
}

// ─── Habit streak (localStorage) as a tiny external store ───

const STREAK_POLL_MS = 30_000;
let streakCache = { value: 0, at: 0 };

function readStreak(): number {
  const now = Date.now();
  if (now - streakCache.at > 5_000) {
    let value = 0;
    try {
      value = computeHabitStreak(loadHabitsLite(), now);
    } catch {
      value = 0;
    }
    streakCache = { value, at: now };
  }
  return streakCache.value;
}

function subscribeStreak(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const refresh = () => {
    streakCache.at = 0;
    onChange();
  };
  const id = window.setInterval(refresh, STREAK_POLL_MS);
  window.addEventListener('storage', refresh);
  window.addEventListener('focus', refresh);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('storage', refresh);
    window.removeEventListener('focus', refresh);
  };
}

const serverStreak = () => 0;

/** Current habit streak in days (re-reads localStorage every 30 s / on focus). */
export function useHabitStreak(): number {
  return useSyncExternalStore(subscribeStreak, readStreak, serverStreak);
}

export interface WarriorProgressOverrides {
  /** Preview a tier regardless of level. */
  forceTier?: WarriorTier;
  forceLevel?: number;
  forceStreak?: number;
  forceDecay?: number;
}

/** The owner's live progression, with optional preview overrides. */
export function useWarriorProgress(overrides: WarriorProgressOverrides = {}): WarriorProgress {
  const storeLevel = useXPStore((s) => s.level);
  const storeDecay = useDecayStore((s) => s.decayStage);
  const storeStreak = useHabitStreak();
  const { forceTier, forceLevel, forceStreak, forceDecay } = overrides;

  return useMemo(() => {
    const tier = forceTier ?? tierForLevel(forceLevel ?? storeLevel);
    const level = forceLevel ?? (forceTier ? Math.max(storeLevel, tierInfo(forceTier).minLevel) : storeLevel);
    return {
      level,
      levelTitle: titleForLevel(level),
      tier,
      tierName: tierInfo(tier).name,
      streakDays: Math.max(0, forceStreak ?? storeStreak),
      decayStage: Math.max(0, Math.min(5, Math.round(forceDecay ?? storeDecay))),
    };
  }, [forceTier, forceLevel, forceStreak, forceDecay, storeLevel, storeDecay, storeStreak]);
}

/** Progress → visual parameters. */
export function lookForProgress(p: WarriorProgress): WarriorLook {
  const info = tierInfo(p.tier);
  const aura = p.streakDays >= 3 ? Math.min(1.3, 0.45 + (p.streakDays - 3) * 0.08) : 0;
  const damage = p.decayStage >= 2 ? Math.min(1, (p.decayStage - 1) / 4) : 0;
  const dim = 1 - damage * 0.45;
  return {
    tier: p.tier,
    trim: info.trim,
    accent: info.accent,
    glow: info.glow * (p.decayStage >= 2 ? 0.85 : 1),
    aura: aura * dim,
    damage,
    critical: p.decayStage >= 5,
  };
}
