// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: action store
// A tiny zustand bus: anything (NEXUS, lock screen, achievements) can
// call playWarriorAction('punch') and every mounted warrior — or only
// the one whose stageId matches — performs it.
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import type { WarriorAction } from './types';

export interface WarriorActionRequest {
  action: WarriorAction;
  /** Increments on every request so the same action can be replayed. */
  seq: number;
  /** Only the stage with this stageId reacts; undefined = all stages. */
  target?: string;
  at: number;
}

interface WarriorActionStore {
  request: WarriorActionRequest | null;
  /** Latest action each stage is actually performing (for readouts). */
  current: Record<string, WarriorAction>;
  play: (action: WarriorAction, target?: string) => void;
  report: (stageId: string, action: WarriorAction) => void;
  /** Drop a stage's readout when it unmounts (so "has it reported?" means "is it live?"). */
  forget: (stageId: string) => void;
}

export const useWarriorActionStore = create<WarriorActionStore>()((set) => ({
  request: null,
  current: {},
  play: (action, target) =>
    set((s) => ({
      request: { action, target, seq: (s.request?.seq ?? 0) + 1, at: Date.now() },
    })),
  report: (stageId, action) =>
    set((s) => (s.current[stageId] === action ? s : { current: { ...s.current, [stageId]: action } })),
  forget: (stageId) =>
    set((s) => {
      if (!(stageId in s.current)) return s;
      const current = { ...s.current };
      delete current[stageId];
      return { current };
    }),
}));

/** Make the warrior(s) perform an action. `target` = a stageId to address one stage only. */
export function playWarriorAction(action: WarriorAction, target?: string): void {
  useWarriorActionStore.getState().play(action, target);
}
