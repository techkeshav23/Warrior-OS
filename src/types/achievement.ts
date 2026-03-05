// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievement Types
// ═══════════════════════════════════════════════════════════

export type AchievementCategory =
  | 'study'        // Study achievements
  | 'build'        // Project achievements
  | 'streak'       // Streak milestones
  | 'exploration'  // Discovery achievements
  | 'special';     // Rare / hidden achievements

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xpReward: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** Condition check function identifier */
  conditionId?: string;
  /** Whether this achievement is hidden until unlocked */
  hidden?: boolean;
  /** Unlock timestamp (null = locked) */
  unlockedAt: string | null;
}

export interface LevelInfo {
  level: number;
  title: string;
  minXP: number;
  maxXP: number;
}
