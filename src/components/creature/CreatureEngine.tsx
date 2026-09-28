// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Creature Engine
// Stage state machine: egg → baby → teen → adult → legendary → mythic
//   Egg   day 0-2 (hatches on day 3 once it has 100 XP)
//   Baby  100 XP · Teen 500 · Adult 2 000 · Legendary 10 000 · Mythic 50 000
// Creature XP is fed by every user XP gain (6.22). The engine also
// tracks focused study vs coding minutes (the dominant activity that
// picks the evolution form), puts the creature to sleep after 2 idle
// hours, grants the golden aura after 5 focused hours, and fires the
// evolution FX + achievements.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useXPStore } from '@/stores/useXPStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import {
  CREATURE_FORMS,
  EGG_INCUBATION_DAYS,
  GOLDEN_AURA_MINUTES,
  getCreatureLevelProgress,
  getNextStageInfo,
  getStageInfo,
  getStageProgress,
  stageIndex,
  useCreatureStore,
} from '@/stores/useCreatureStore';
import type {
  CreatureActivityKind,
  CreatureDayLog,
  CreatureEvolutionEvent,
  CreatureForm,
  CreatureFormChangeEvent,
  CreatureFormInfo,
  CreatureMood,
  CreatureStage,
  CreatureStageInfo,
} from '@/types/creature';
import { reconcileDreamAchievements } from '@/components/dream/dreamJournal';
import { onAchievementsSeeded, sayViaNexus, unlockPhase6Achievement } from './osBridge';

export { EGG_INCUBATION_DAYS };

/** Idle window before the creature falls asleep (2 hours). */
export const IDLE_SLEEP_MS = 2 * 60 * 60 * 1000;
/** Input within this window counts the current minute as focused. */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export const CREATURE_ACHIEVEMENT_IDS = {
  firstPet: 'first-pet',
  growingUp: 'creature-growing-up',
  evolution: 'creature-evolution',
  legendary: 'creature-legendary',
  mythic: 'creature-mythic',
  happyPet: 'creature-happy-week',
} as const;

const HAPPY_PET_DAYS = 7;

function utcDayKey(ms: number = Date.now()): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetweenKeys(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

const EMPTY_DAY: CreatureDayLog = { xp: 0, studyMinutes: 0, codeMinutes: 0, focusMinutes: 0, wasSad: false };

export interface CreatureVitals {
  stage: CreatureStage;
  stageInfo: CreatureStageInfo;
  nextStageInfo: CreatureStageInfo | null;
  /** 0-100 toward the next stage. */
  stageProgress: number;
  form: CreatureForm;
  formInfo: CreatureFormInfo;
  mood: CreatureMood;
  /** Creature XP (fed by user XP gains). */
  xp: number;
  /** Creature level. */
  level: number;
  /** 0-100 toward the next creature level. */
  levelProgress: number;
  daysAlive: number;
  interactions: number;
  studyPoints: number;
  codePoints: number;
  dominant: CreatureActivityKind;
  hasGoldenAura: boolean;
  /** True once the creature has hatched (past egg). */
  isHatched: boolean;
  /** Incubation done + fed enough: the hatch cinematic may play. */
  eggReadyToHatch: boolean;
  /** Today's observed activity. */
  today: CreatureDayLog;
}

/**
 * Read-only view of the creature for UI. Derives stage info, progress,
 * days alive (re-evaluated every minute) and today's log.
 */
export function useCreatureVitals(): CreatureVitals {
  const stage = useCreatureStore((s) => s.stage);
  const form = useCreatureStore((s) => s.form);
  const mood = useCreatureStore((s) => s.mood);
  const xp = useCreatureStore((s) => s.xp);
  const level = useCreatureStore((s) => s.level);
  const birthDate = useCreatureStore((s) => s.birthDate);
  const interactions = useCreatureStore((s) => s.interactions);
  const studyPoints = useCreatureStore((s) => s.studyPoints);
  const codePoints = useCreatureStore((s) => s.codePoints);
  const dominant = useCreatureStore((s) => s.dominantActivity);
  const hasHatched = useCreatureStore((s) => s.hasHatched);
  const eggReady = useCreatureStore((s) => s.eggReady);
  const goldenAuraDate = useCreatureStore((s) => s.goldenAuraDate);
  const activityLog = useCreatureStore((s) => s.activityLog);

  // Minute clock so day-based values roll over without a store change.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  return useMemo<CreatureVitals>(() => {
    const today = utcDayKey(now);
    const born = Date.parse(birthDate);
    const daysAlive = Number.isNaN(born) ? 0 : Math.max(0, daysBetweenKeys(today, utcDayKey(born)));
    return {
      stage,
      stageInfo: getStageInfo(stage),
      nextStageInfo: getNextStageInfo(stage),
      stageProgress: getStageProgress(xp, stage),
      form,
      formInfo: CREATURE_FORMS[form],
      mood,
      xp,
      level,
      levelProgress: getCreatureLevelProgress(xp).pct,
      daysAlive,
      interactions,
      studyPoints,
      codePoints,
      dominant,
      hasGoldenAura: goldenAuraDate === today,
      isHatched: hasHatched,
      eggReadyToHatch: eggReady,
      today: activityLog[today] ?? EMPTY_DAY,
    };
  }, [
    now,
    birthDate,
    stage,
    xp,
    form,
    mood,
    level,
    interactions,
    studyPoints,
    codePoints,
    dominant,
    goldenAuraDate,
    hasHatched,
    eggReady,
    activityLog,
  ]);
}

/** Re-apply every creature achievement whose condition is met (idempotent). */
export function reconcileCreatureAchievements(): void {
  const c = useCreatureStore.getState();
  if (!c.hasHatched) return;
  unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.firstPet);
  const idx = stageIndex(c.stage);
  if (idx >= stageIndex('teen')) unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.growingUp);
  if (idx >= stageIndex('legendary')) unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.legendary);
  if (idx >= stageIndex('mythic')) unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.mythic);
  if (c.formChanges >= 1) unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.evolution);
  if (c.getHappyStreak() >= HAPPY_PET_DAYS) unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.happyPet);
}

/** Which kind of work the focused window represents right now. */
function focusedActivityKind(): 'study' | 'code' | null {
  const win = useWindowStore.getState().getFocusedWindow();
  if (!win || win.isMinimized) return null;
  if (win.workspaceId !== useWorkspaceStore.getState().activeWorkspaceId) return null;
  const app = useAppStore.getState().getApp(win.appId);
  if (!app) return null;
  if (app.category === 'study') return 'study';
  if (app.category === 'build') return 'code';
  return null;
}

function onEvolution(ev: CreatureEvolutionEvent): void {
  reconcileCreatureAchievements();
  // Egg → first stage is covered by the hatch cinematic; catch-ups stay quiet.
  if (ev.silent || ev.from === 'egg') return;
  if (stageIndex(ev.to) <= stageIndex(ev.from)) return;
  const c = useCreatureStore.getState();
  c.setMood('dance', 5000);
  const info = getStageInfo(ev.to);
  sayViaNexus(
    `${c.name} evolved into a ${info.label} ${CREATURE_FORMS[c.form].name}. Your work made it stronger.`,
    'success'
  );
}

function onFormChange(ev: CreatureFormChangeEvent): void {
  unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.evolution);
  const c = useCreatureStore.getState();
  const why =
    ev.to === 'phoenix' ? 'your study sessions' : ev.to === 'serpent' ? 'your coding sessions' : 'your balanced grind';
  sayViaNexus(`${c.name} transformed into a ${CREATURE_FORMS[ev.to].name}, shaped by ${why}.`, 'success');
  c.setMood('dance', 5000);
}

/**
 * Background systems. Mounted once by <WarriorCreature/>; renders nothing.
 */
export function CreatureEngine() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const creature = () => useCreatureStore.getState();

    // ── Boot: session day, XP catch-up, evolution + achievements ──
    const firstMeeting = creature().lastSyncedUserXP === null && !creature().hasHatched;
    creature().touchToday();
    creature().syncUserXP(useXPStore.getState().xp, { silent: true });
    creature().checkEvolution({ silent: true });
    reconcileCreatureAchievements();
    // Dreams play before the desktop; re-apply their unlocks here too.
    reconcileDreamAchievements();
    if (firstMeeting) {
      sayViaNexus(
        'A glowing egg appeared on your taskbar. It feeds on the XP you earn and hatches on day 3.',
        'info'
      );
    }

    // ── Input tracking (focus minutes + idle sleep) ──
    let lastInput = Date.now();
    let lastMarked = 0;
    const onInput = () => {
      const now = Date.now();
      lastInput = now;
      const c = creature();
      if (c.mood === 'sleeping') {
        lastMarked = now;
        c.markActive();
      } else if (now - lastMarked > 60_000) {
        lastMarked = now;
        c.markActive();
      }
    };
    const inputEvents = ['pointerdown', 'keydown', 'wheel', 'pointermove'] as const;
    inputEvents.forEach((e) => window.addEventListener(e, onInput, { passive: true }));

    // ── Every user XP gain feeds the creature ──
    const unsubXP = useXPStore.subscribe((s, prev) => {
      if (s.xp !== prev.xp) creature().syncUserXP(s.xp);
    });

    // ── Evolution / form FX + achievements ──
    const unsubCreature = useCreatureStore.subscribe((s, prev) => {
      if (s.lastEvolution && s.lastEvolution !== prev.lastEvolution) onEvolution(s.lastEvolution);
      if (s.lastFormChange && s.lastFormChange !== prev.lastFormChange) onFormChange(s.lastFormChange);
      if (s.xp !== prev.xp && s.getHappyStreak() >= HAPPY_PET_DAYS) {
        unlockPhase6Achievement(CREATURE_ACHIEVEMENT_IDS.happyPet);
      }
    });

    // Achievements attempted before the XP store was seeded get re-applied.
    const unsubSeed = onAchievementsSeeded(() => {
      reconcileCreatureAchievements();
      reconcileDreamAchievements();
    });

    // ── Minute tick ──
    let day = utcDayKey();
    const tick = () => {
      const now = Date.now();
      const c = creature();
      const today = utcDayKey(now);
      if (today !== day) {
        day = today;
        c.touchToday();
      }
      const active = document.visibilityState === 'visible' && now - lastInput < ACTIVE_WINDOW_MS;
      if (active) {
        c.logFocusMinute(focusedActivityKind());
        const log = creature().getTodayLog();
        if (log.studyMinutes + log.codeMinutes >= GOLDEN_AURA_MINUTES && !creature().hasGoldenAura()) {
          creature().grantGoldenAura();
          creature().setMood('dance', 4500);
          sayViaNexus(
            `Five focused hours today. ${c.name} is wrapped in a golden aura for the rest of the day.`,
            'success'
          );
        }
      }
      if (now - lastInput >= IDLE_SLEEP_MS && creature().mood === 'idle') {
        creature().setMood('sleeping');
      }
      // Day-gated egg readiness can flip while the OS stays open.
      creature().checkEvolution();
    };
    const interval = setInterval(tick, 60_000);

    return () => {
      inputEvents.forEach((e) => window.removeEventListener(e, onInput));
      unsubXP();
      unsubCreature();
      unsubSeed();
      clearInterval(interval);
    };
  }, []);

  return null;
}
