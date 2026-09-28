// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Ghost presence: local simulation
// Used when no Realtime Database is configured (or it is unreachable).
// Every simulated warrior carries isSimulated: true and the UI labels
// the whole feature as simulated — these are never passed off as real.
// War cries are not broadcast in this mode.
// ═══════════════════════════════════════════════════════════

import type { GhostWarrior, WarCry } from '@/types/ghost';
import type { GhostTransport } from './transport';
import { makeWarriorId } from './identity';

const SIM_MIN = 3;
const SIM_MAX = 12;
const TICK_MS = 15_000;

interface SimWarrior {
  anonymousId: string;
  seed: number;
  baseStudy: number;
  baseQuizzes: number;
  streak: number;
}

function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function buildRoster(selfId: string): SimWarrior[] {
  const count = SIM_MIN + Math.floor(Math.random() * (SIM_MAX - SIM_MIN + 1));
  const used = new Set<string>([selfId]);
  const roster: SimWarrior[] = [];
  for (let i = 0; i < count; i++) {
    let id = makeWarriorId();
    while (used.has(id)) id = makeWarriorId();
    used.add(id);
    const seed = Math.floor(Math.random() * 10_000) + 1;
    roster.push({
      anonymousId: id,
      seed,
      baseStudy: 0.5 + seeded(seed) * 7.5,
      baseQuizzes: Math.floor(seeded(seed * 2) * 12),
      streak: 1 + Math.floor(seeded(seed * 3) * 60),
    });
  }
  return roster;
}

function presenceFor(roster: SimWarrior[]): GhostWarrior[] {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const minute = Math.floor(now / 60_000);
  return roster.map((r) => ({
    anonymousId: r.anonymousId,
    studyHoursToday: Math.round(Math.max(0, r.baseStudy + seeded(r.seed + minute) * 0.6 - 0.3) * 10) / 10,
    quizzesToday: r.baseQuizzes + Math.floor(seeded(r.seed + minute * 3) * 2),
    streak: r.streak,
    isOnline: seeded(r.seed * 7 + Math.floor(minute / 4)) > 0.12,
    lastSeen: iso,
    isSimulated: true,
  }));
}

export interface SimulationOptions {
  selfId: string;
  onWarriors: (warriors: GhostWarrior[]) => void;
  onWarCry: (cry: WarCry) => void;
}

export function startSimulation(options: SimulationOptions): GhostTransport {
  let roster = buildRoster(options.selfId);
  options.onWarriors(presenceFor(roster));
  const interval = setInterval(() => {
    // Occasionally reshuffle to simulate joins/leaves.
    if (Math.random() < 0.25) roster = buildRoster(options.selfId);
    options.onWarriors(presenceFor(roster));
  }, TICK_MS);

  return {
    kind: 'simulated',
    broadcasts: false,
    createWarCryId: () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    publishWarCry: async () => undefined,
    stop: () => clearInterval(interval),
  };
}
