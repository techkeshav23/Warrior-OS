// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Engine
// Stage state machine: egg → baby → teen → adult → legendary → mythic
// Derives the live stage from user XP (+ egg day-gating) and exposes
// a single hook other creature components consume.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import {
  CREATURE_FORMS,
  getNextStageInfo,
  getStageForXP,
  getStageInfo,
  getStageProgress,
  useCreatureStore,
} from '@/stores/useCreatureStore';
import type {
  CreatureForm,
  CreatureMood,
  CreatureStage,
  FormInfo,
  StageInfo,
} from '@/types/creature';

/** Days the egg must incubate before it is allowed to hatch. */
export const EGG_INCUBATION_DAYS = 2;
/** Idle window before the creature falls asleep (2 hours). */
export const IDLE_SLEEP_MS = 2 * 60 * 60 * 1000;

export interface CreatureVitals {
  stage: CreatureStage;
  stageInfo: StageInfo;
  nextStageInfo: StageInfo | null;
  stageProgress: number; // 0-100 toward next stage
  form: CreatureForm;
  formInfo: FormInfo;
  mood: CreatureMood;
  xp: number;
  level: number;
  daysAlive: number;
  interactions: number;
  studyPoints: number;
  codePoints: number;
  dominant: 'study' | 'code' | 'balanced';
  hasGoldenAura: boolean;
  /** True once the creature has visually hatched (past egg). */
  isHatched: boolean;
  /** True when the egg is ready to crack (incubation complete, not yet hatched). */
  eggReadyToHatch: boolean;
}

/**
 * Central engine hook. Reads XP + creature store, resolves the current
 * stage, and drives idle→sleep transitions. Pure derivation + a couple of
 * self-scheduling effects; safe to call from multiple mounted components.
 */
export function useCreatureVitals(): CreatureVitals {
  const xp = useXPStore((s) => s.xp);
  const level = useXPStore((s) => s.level);

  const mood = useCreatureStore((s) => s.mood);
  const interactions = useCreatureStore((s) => s.interactions);
  const studyPoints = useCreatureStore((s) => s.studyPoints);
  const codePoints = useCreatureStore((s) => s.codePoints);
  const hasHatched = useCreatureStore((s) => s.hasHatched);
  const bornAt = useCreatureStore((s) => s.bornAt);

  const getDominant = useCreatureStore((s) => s.getDominantActivity);
  const getForm = useCreatureStore((s) => s.getForm);
  const getDaysAlive = useCreatureStore((s) => s.getDaysAlive);
  const hasGoldenAura = useCreatureStore((s) => s.hasGoldenAura);

  // Raw stage purely from XP.
  const xpStage = getStageForXP(xp);
  const daysAlive = getDaysAlive();

  // Egg gating: even with XP, the creature only appears past-egg once the
  // egg has incubated for EGG_INCUBATION_DAYS AND has been hatched.
  const eggReadyToHatch = xpStage !== 'egg' && daysAlive >= EGG_INCUBATION_DAYS && !hasHatched;

  const stage: CreatureStage = hasHatched ? xpStage : 'egg';

  const stageInfo = getStageInfo(stage);
  const nextStageInfo = getNextStageInfo(stage);
  const stageProgress = getStageProgress(xp, stage);
  const form = getForm();
  const dominant = getDominant();

  return useMemo<CreatureVitals>(
    () => ({
      stage,
      stageInfo,
      nextStageInfo,
      stageProgress,
      form,
      formInfo: CREATURE_FORMS[form],
      mood,
      xp,
      level,
      daysAlive,
      interactions,
      studyPoints,
      codePoints,
      dominant,
      hasGoldenAura: hasGoldenAura(),
      isHatched: hasHatched,
      eggReadyToHatch,
    }),
    // Recompute whenever any input changes. bornAt included for day rollover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      stage,
      stageProgress,
      form,
      mood,
      xp,
      level,
      daysAlive,
      interactions,
      studyPoints,
      codePoints,
      dominant,
      hasHatched,
      eggReadyToHatch,
      bornAt,
    ]
  );
}

/**
 * Drives passive idle → sleep transitions. Mounted once by <WarriorCreature/>.
 * Renders nothing.
 */
export function CreatureEngine() {
  const setMood = useCreatureStore((s) => s.setMood);
  const lastCheckedStage = useRef<CreatureStage | null>(null);
  const xp = useXPStore((s) => s.xp);

  // Idle-sleep watcher.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = setInterval(() => {
      const st = useCreatureStore.getState();
      const idleFor = Date.now() - new Date(st.lastActiveAt).getTime();
      if (idleFor >= IDLE_SLEEP_MS && st.mood === 'idle') {
        setMood('sleeping');
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [setMood]);

  // Stage-up celebration: when XP crosses into a new stage, do a happy hop.
  useEffect(() => {
    const st = getStageForXP(xp);
    if (lastCheckedStage.current && lastCheckedStage.current !== st) {
      if (useCreatureStore.getState().hasHatched) {
        setMood('dance', 4000);
      }
    }
    lastCheckedStage.current = st;
  }, [xp, setMood]);

  return null;
}
