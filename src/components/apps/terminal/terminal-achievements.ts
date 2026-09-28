// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Terminal Achievements
// Terminal Warrior (50 commands), easter-egg discovery XP, and the
// hidden-easter-egg achievement
// ═══════════════════════════════════════════════════════════

import { useXPStore } from '@/stores/useXPStore';
import { unlock } from '@/components/achievements/award';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';

/** "Terminal Warrior": recognised commands executed (lifetime). */
export const TERMINAL_WARRIOR_TARGET = 50;
/** XP for discovering an easter egg — paid once per egg, not per run. */
export const EASTER_EGG_XP = 5;

/** Count one recognised command; returns the lifetime total. */
export function recordTerminalCommand(): number {
  const total = useAchievementProgressStore.getState().incrementTerminalCommands();
  if (total >= TERMINAL_WARRIOR_TARGET) unlock('terminal-warrior');
  return total;
}

export interface EggDiscovery {
  /** XP paid by this run (0 when the egg was found before). */
  xp: number;
  /** True when this run unlocked the hidden-easter-egg achievement. */
  achievementUnlocked: boolean;
}

/** Record an easter egg run. Secret (unlisted) eggs unlock the "???" achievement. */
export function discoverEasterEgg(eggId: string, secret: boolean): EggDiscovery {
  const firstTime = useAchievementProgressStore.getState().addEggFound(eggId);
  if (firstTime) useXPStore.getState().addXP(EASTER_EGG_XP, 'easter-egg');
  const achievementUnlocked = secret ? unlock('easter-egg') : false;
  return { xp: firstTime ? EASTER_EGG_XP : 0, achievementUnlocked };
}
