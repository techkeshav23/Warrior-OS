// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: SIMULATED anonymous warriors
// Used only in offline/local mode (no Realtime Database configured, or
// it is unreachable). Every warrior produced here is SIMULATED: it
// carries isSimulated: true and the UI tags it "SIM" — these are never
// passed off as real people.
//
// The simulation is fully DETERMINISTIC: the roster is derived from the
// current UTC day, online/offline flips per 10-minute slot and stats
// grow with the time of day, all via a seeded hash. Every open tab (and
// every reload) therefore sees exactly the same simulated campfire, and
// simulated war cries fire on a fixed schedule with stable ids.
// ═══════════════════════════════════════════════════════════

import type { GhostWarrior, WarCry } from '@/types/ghost';

/** Number of simulated warriors in the daily roster (some are offline at any time). */
export const SIM_ROSTER_SIZE = 9;
/** Online/offline status re-rolls on this cadence. */
const SIM_PRESENCE_SLOT_MS = 10 * 60_000;
/** A simulated war cry may fire once per slot of this length. */
const SIM_WARCRY_SLOT_MS = 4 * 60_000;
/** Chance (0..1) that a war-cry slot actually contains a simulated cry. */
const SIM_WARCRY_CHANCE = 0.35;

const SIM_WARCRY_LINES = [
  "LET'S GO! 🔥",
  'Never give up! ⚔️',
  'OS done! 📚',
  'Grinding hard 💪',
  'Focus mode 🎯',
  'One more chapter 📖',
  'DBMS finally clicked 🧠',
  'Mock test cleared ✅',
  'Hydrate, warriors 💧',
  'Graphs > sleep 🌙',
] as const;

/** 32-bit FNV-1a hash of a string. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic 0..1 value for a key. */
function unit(key: string): number {
  // mulberry32 finaliser over the hash for a better spread
  let t = (hash(key) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

interface SimProfile {
  anonymousId: string;
  /** Study hours this warrior reaches by the end of the (UTC) day. */
  dailyHours: number;
  /** Quizzes by the end of the day. */
  dailyQuizzes: number;
  streak: number;
  /** Probability of being online in any 10-minute slot. */
  presence: number;
}

/** The deterministic simulated roster for a UTC day. Ids never collide with `selfId`. */
export function simulatedRoster(now: number, selfId: string | null): SimProfile[] {
  const day = utcDay(now);
  const used = new Set<string>(selfId ? [selfId] : []);
  const roster: SimProfile[] = [];
  for (let i = 0; i < SIM_ROSTER_SIZE; i++) {
    let n = 0;
    let id = '';
    do {
      id = `Warrior#${1000 + Math.floor(unit(`${day}:id:${i}:${n}`) * 9000)}`;
      n += 1;
    } while (used.has(id));
    used.add(id);
    roster.push({
      anonymousId: id,
      dailyHours: 2 + unit(`${day}:h:${i}`) * 8,
      dailyQuizzes: Math.floor(unit(`${day}:q:${i}`) * 14),
      streak: 1 + Math.floor(unit(`sim-streak:${i}`) * 45),
      presence: 0.55 + unit(`${day}:p:${i}`) * 0.4,
    });
  }
  return roster;
}

/** Fraction (0..1) of the UTC day elapsed. */
function dayProgress(now: number): number {
  const d = new Date(now);
  return (d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) / 86_400;
}

/** Simulated warriors as presence rows for `now` (online and offline). */
export function simulatedWarriors(now: number, selfId: string | null): GhostWarrior[] {
  const slot = Math.floor(now / SIM_PRESENCE_SLOT_MS);
  // Warriors study through the day: an S-curve so evenings look busy.
  const p = dayProgress(now);
  const progress = Math.min(1, Math.max(0.05, p * p * (3 - 2 * p)));
  const iso = new Date(now).toISOString();
  return simulatedRoster(now, selfId).map((w, i) => ({
    anonymousId: w.anonymousId,
    studyHoursToday: Math.round(w.dailyHours * progress * 10) / 10,
    quizzesToday: Math.round(w.dailyQuizzes * progress),
    streak: w.streak,
    // At least three are always around the fire.
    isOnline: i < 3 || unit(`${w.anonymousId}:slot:${slot}`) < w.presence,
    lastSeen: iso,
    isSimulated: true,
  }));
}

/**
 * Simulated war cries whose scheduled time falls in (fromMs, toMs].
 * Ids are stable, so every tab shows the same cry once.
 */
export function simulatedWarCries(fromMs: number, toMs: number, selfId: string | null): WarCry[] {
  if (toMs <= fromMs) return [];
  const out: WarCry[] = [];
  const first = Math.floor(fromMs / SIM_WARCRY_SLOT_MS);
  const last = Math.floor(toMs / SIM_WARCRY_SLOT_MS);
  // Never replay a long backlog (e.g. after the tab slept).
  for (let slot = Math.max(first, last - 2); slot <= last; slot++) {
    if (unit(`cry:${slot}`) >= SIM_WARCRY_CHANCE) continue;
    const at = slot * SIM_WARCRY_SLOT_MS + Math.floor(unit(`cry-at:${slot}`) * SIM_WARCRY_SLOT_MS);
    if (at <= fromMs || at > toMs) continue;
    const online = simulatedWarriors(at, selfId).filter((w) => w.isOnline);
    if (online.length === 0) continue;
    const sender = online[Math.floor(unit(`cry-who:${slot}`) * online.length)];
    const line = SIM_WARCRY_LINES[Math.floor(unit(`cry-msg:${slot}`) * SIM_WARCRY_LINES.length)];
    out.push({
      id: `sim-cry-${slot}`,
      message: line,
      timestamp: new Date(at).toISOString(),
      anonymousId: sender.anonymousId,
      isSimulated: true,
      isLocalOnly: true,
    });
  }
  return out;
}
