// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useGhostPresence Hook
// LOCAL SIMULATION of anonymous multiplayer presence.
//
// No Firebase keys are configured, so this simulates 3-12 anonymous
// warriors with jittered stats plus the local user's own presence.
// If Firebase Realtime Database is wired later, swap the internals of
// this hook (write to /presence, onDisconnect().remove(), listen for
// changes) while keeping the same return contract.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGhostStore } from '@/stores/useGhostStore';
import type { GhostWarrior } from '@/types/ghost';

const SIM_MIN = 3;
const SIM_MAX = 12;
const TICK_MS = 15_000; // re-jitter every 15s so avatars/count feel alive

/** Stable per-session self id, persisted via the store. */
function makeSelfId(): string {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return `Warrior#${n}`;
}

/** Deterministic-ish pseudo-random in [0,1) seeded by a number. */
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

interface SimWarrior {
  anonymousId: string;
  seed: number;
  baseStudy: number;
  baseQuizzes: number;
  streak: number;
}

/** Build a fresh roster of simulated ghost warriors. */
function buildRoster(): SimWarrior[] {
  const count = SIM_MIN + Math.floor(Math.random() * (SIM_MAX - SIM_MIN + 1));
  const roster: SimWarrior[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    let id = makeSelfId();
    while (used.has(id)) id = makeSelfId();
    used.add(id);
    const seed = i + 1;
    roster.push({
      anonymousId: id,
      seed,
      baseStudy: 0.5 + seeded(seed) * 7.5,       // 0.5 - 8h
      baseQuizzes: Math.floor(seeded(seed * 2) * 12),
      streak: 1 + Math.floor(seeded(seed * 3) * 60),
    });
  }
  return roster;
}

export interface UseGhostPresenceResult {
  onlineCount: number;
  warriors: GhostWarrior[];
  selfId: string | null;
}

/**
 * Simulates anonymous presence and keeps the ghost store in sync.
 * Mount ONCE at the desktop layer (GhostLayer handles this).
 */
export function useGhostPresence(): UseGhostPresenceResult {
  const setSelfId = useGhostStore((s) => s.setSelfId);
  const updatePresence = useGhostStore((s) => s.updatePresence);
  const onlineWarriors = useGhostStore((s) => s.onlineWarriors);
  const selfId = useGhostStore((s) => s.selfId);

  const rosterRef = useRef<SimWarrior[] | null>(null);
  const selfRef = useRef<string | null>(null);

  const buildPresence = useCallback((): GhostWarrior[] => {
    const roster = rosterRef.current ?? [];
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const t = now / 60000; // minute-scale time for gentle drift

    const ghosts: GhostWarrior[] = roster.map((r) => {
      // gentle jitter around the base so stats slowly evolve
      const drift = seeded(r.seed + Math.floor(t)) * 0.6 - 0.3;
      const study = Math.max(0, r.baseStudy + drift);
      // occasionally a warrior appears offline (drops out of the roster view)
      const isOnline = seeded(r.seed * 7 + Math.floor(t / 4)) > 0.12;
      return {
        anonymousId: r.anonymousId,
        studyHoursToday: Math.round(study * 10) / 10,
        quizzesToday: r.baseQuizzes + Math.floor(seeded(r.seed + t) * 2),
        streak: r.streak,
        isOnline,
        lastSeen: nowIso,
      };
    });

    // Local user's own presence — pulls light stats if available, else seeds them.
    const self = selfRef.current;
    if (self) {
      const existingSelf = onlineWarriors.find((w) => w.anonymousId === self);
      ghosts.unshift({
        anonymousId: self,
        studyHoursToday: existingSelf?.studyHoursToday ?? 0,
        quizzesToday: existingSelf?.quizzesToday ?? 0,
        streak: existingSelf?.streak ?? 1,
        isOnline: true,
        lastSeen: nowIso,
        isSelf: true,
      });
    }

    return ghosts;
  }, [onlineWarriors]);

  useEffect(() => {
    // Establish self id (reuse persisted one if present).
    const persisted = useGhostStore.getState().selfId;
    const id = persisted ?? makeSelfId();
    selfRef.current = id;
    if (!persisted) setSelfId(id);
    else if (persisted !== selfId) setSelfId(persisted);

    rosterRef.current = buildRoster();
    updatePresence(buildPresence());

    const interval = setInterval(() => {
      // occasionally reshuffle the roster to simulate joins/leaves
      if (Math.random() < 0.25) rosterRef.current = buildRoster();
      updatePresence(buildPresence());
    }, TICK_MS);

    return () => clearInterval(interval);
    // buildPresence intentionally excluded: we call the latest via ref-driven logic;
    // re-running on its identity would reset the roster each stat change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSelfId, updatePresence]);

  return {
    onlineCount: onlineWarriors.filter((w) => w.isOnline).length,
    warriors: onlineWarriors,
    selfId,
  };
}
