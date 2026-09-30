// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Owner sync: reload stores after a pull
//
// Zustand persist stores read localStorage once at start-up. When a
// sync pull rewrites one of their keys, the matching store re-reads it
// here. Apps that keep a raw list (Notes, Files, Habit Forge) listen for
// the 'warrior:storage-sync' event instead (src/lib/storage-sync.ts).
// Keep this map in step with each store's persist `name`.
// ═══════════════════════════════════════════════════════════

'use client';

import { announceStorageWrite } from '@/lib/storage-sync';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useMusicGenStore } from '@/stores/useMusicGenStore';
import { useGhostStore } from '@/stores/useGhostStore';
import { useCalendarStore } from '@/stores/useCalendarStore';
import { useCreatureStore } from '@/stores/useCreatureStore';
import { useResumeStore } from '@/stores/useResumeStore';
import { useXPStore } from '@/stores/useXPStore';
import { useLearningStore, LEARNING_STORAGE_KEY } from '@/stores/useLearningStore';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useExpenseStore } from '@/stores/useExpenseStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { useDecayStore } from '@/stores/useDecayStore';
import { useJarvisStore } from '@/stores/useJarvisStore';
import { useReminderStore, REMINDER_STORAGE_KEY } from '@/stores/useReminderStore';
import { useEffectsStore } from '@/components/effects/useEffectsStore';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import {
  useQuestPlanStore,
  QUEST_PLAN_STORAGE_KEY,
} from '@/components/apps/training-grounds/practice/quest-plan-store';
import { useAlgoLabStore } from '@/components/apps/algo-lab/useAlgoLabStore';
import { useAchievementEventsStore } from '@/lib/achievement-events';

interface Rehydratable {
  persist: { rehydrate: () => Promise<void> | void };
}

const STORES: Record<string, Rehydratable> = {
  'warrior-os-settings': useSettingsStore,
  'warrior-os-musicgen': useMusicGenStore,
  'warrior-os-ghost': useGhostStore,
  'warrior-os-calendar': useCalendarStore,
  'warrior-os-creature': useCreatureStore,
  'warrior-os-resume': useResumeStore,
  'warrior-os-xp': useXPStore,
  [LEARNING_STORAGE_KEY]: useLearningStore,
  'warrior-os-project-forge': useProjectForgeStore,
  'warrior-os-nexus': useNexusStore,
  'warrior-os-expenses': useExpenseStore,
  'warrior-os-workspaces': useWorkspaceStore,
  'warrior-biometrics': useBiometricsStore,
  'warrior-os-quiz-history': useQuizHistoryStore,
  'warrior-os-decay': useDecayStore,
  'warrior-os-effects': useEffectsStore,
  'warrior-os-achievement-progress': useAchievementProgressStore,
  [QUEST_PLAN_STORAGE_KEY]: useQuestPlanStore,
  'warrior-os-algo-lab': useAlgoLabStore,
  'warrior-os-achievement-events': useAchievementEventsStore,
  'warrior-os-jarvis': useJarvisStore,
  [REMINDER_STORAGE_KEY]: useReminderStore,
};

/** Make the running app pick up keys a pull just rewrote. */
export async function refreshKeys(keys: string[]): Promise<void> {
  for (const key of keys) {
    const store = STORES[key];
    if (store) {
      try {
        await store.persist.rehydrate();
      } catch {
        // A store that rejects the value keeps its current state.
      }
    }
    announceStorageWrite(key);
  }
}
