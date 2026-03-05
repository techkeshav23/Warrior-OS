// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievements Database
// All unlockable achievements organized by category
// ═══════════════════════════════════════════════════════════

import type { Achievement, AchievementCategory } from '@/types';

export const ACHIEVEMENTS: Achievement[] = [
  // ─── STUDY ACHIEVEMENTS ───
  {
    id: 'first-quiz',
    title: 'Quiz Initiate',
    description: 'Complete your first GATE quiz',
    category: 'study',
    icon: '📝',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'quiz-streak-5',
    title: 'Knowledge Streak',
    description: 'Get 5 correct answers in a row',
    category: 'study',
    icon: '🔥',
    xpReward: 100,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'perfect-quiz',
    title: 'Perfect Score',
    description: 'Score 100% on a quiz with 10+ questions',
    category: 'study',
    icon: '💯',
    xpReward: 200,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'all-subjects',
    title: 'Renaissance Warrior',
    description: 'Attempt quizzes in all 12 GATE subjects',
    category: 'study',
    icon: '🎓',
    xpReward: 300,
    rarity: 'epic',
    unlockedAt: null,
  },
  {
    id: 'quiz-master',
    title: 'Quiz Grandmaster',
    description: 'Complete 100 quizzes',
    category: 'study',
    icon: '👑',
    xpReward: 500,
    rarity: 'legendary',
    unlockedAt: null,
  },
  {
    id: 'study-1hr',
    title: 'Focused Mind',
    description: 'Study for 1 hour straight',
    category: 'study',
    icon: '⏱️',
    xpReward: 75,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'study-marathon',
    title: 'Study Marathon',
    description: 'Study for 5 hours in a single day',
    category: 'study',
    icon: '🏃',
    xpReward: 250,
    rarity: 'rare',
    unlockedAt: null,
  },

  // ─── BUILD ACHIEVEMENTS ───
  {
    id: 'first-project',
    title: 'Builder Awakens',
    description: 'Create your first project',
    category: 'build',
    icon: '🔨',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'code-100-lines',
    title: 'Centurion Coder',
    description: 'Write 100 lines of code in Code Lab',
    category: 'build',
    icon: '💻',
    xpReward: 100,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'project-complete',
    title: 'Ship It!',
    description: 'Complete a project from start to finish',
    category: 'build',
    icon: '🚀',
    xpReward: 200,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'five-projects',
    title: 'Portfolio Builder',
    description: 'Complete 5 projects',
    category: 'build',
    icon: '📦',
    xpReward: 350,
    rarity: 'epic',
    unlockedAt: null,
  },
  {
    id: 'terminal-warrior',
    title: 'Terminal Warrior',
    description: 'Execute 50 commands in the terminal',
    category: 'build',
    icon: '⚡',
    xpReward: 75,
    rarity: 'uncommon',
    unlockedAt: null,
  },

  // ─── STREAK ACHIEVEMENTS ───
  {
    id: 'streak-3',
    title: 'Rising Warrior',
    description: 'Maintain a 3-day streak',
    category: 'streak',
    icon: '🌟',
    xpReward: 75,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'streak-7',
    title: 'Consistent Fighter',
    description: 'Maintain a 7-day streak',
    category: 'streak',
    icon: '⚔️',
    xpReward: 150,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'streak-30',
    title: 'Iron Discipline',
    description: 'Maintain a 30-day streak',
    category: 'streak',
    icon: '🏆',
    xpReward: 500,
    rarity: 'epic',
    unlockedAt: null,
  },
  {
    id: 'streak-100',
    title: 'Legendary Dedication',
    description: '100-day streak — You are unstoppable',
    category: 'streak',
    icon: '💎',
    xpReward: 1000,
    rarity: 'legendary',
    unlockedAt: null,
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Start studying before 7 AM',
    category: 'streak',
    icon: '🌅',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Study past midnight',
    category: 'streak',
    icon: '🦉',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },

  // ─── EXPLORATION ACHIEVEMENTS ───
  {
    id: 'first-boot',
    title: 'System Online',
    description: 'Boot WARRIOR OS for the first time',
    category: 'exploration',
    icon: '🖥️',
    xpReward: 25,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'all-apps',
    title: 'App Explorer',
    description: 'Open every app at least once',
    category: 'exploration',
    icon: '🗺️',
    xpReward: 150,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'all-workspaces',
    title: 'Space Traveler',
    description: 'Visit all 3 workspaces',
    category: 'exploration',
    icon: '🌌',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'command-palette',
    title: 'Power User',
    description: 'Use the Command Palette (Ctrl+K)',
    category: 'exploration',
    icon: '⌨️',
    xpReward: 30,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'customize-os',
    title: 'Make It Yours',
    description: 'Change 3 settings in the OS',
    category: 'exploration',
    icon: '🎨',
    xpReward: 75,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'nexus-chat',
    title: 'AI Companion',
    description: 'Have your first conversation with NEXUS AI',
    category: 'exploration',
    icon: '🧠',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },

  // ─── SPECIAL ACHIEVEMENTS ───
  {
    id: 'level-5',
    title: 'Rising Warrior',
    description: 'Reach Level 5',
    category: 'special',
    icon: '⬆️',
    xpReward: 100,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'level-10',
    title: 'Battle Hardened',
    description: 'Reach Level 10',
    category: 'special',
    icon: '🏅',
    xpReward: 250,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'level-20',
    title: 'The Ascendant',
    description: 'Reach Level 20 — Maximum power',
    category: 'special',
    icon: '🌟',
    xpReward: 1000,
    rarity: 'legendary',
    unlockedAt: null,
  },
  {
    id: 'multi-window',
    title: 'Multitasker',
    description: 'Have 5 windows open simultaneously',
    category: 'special',
    icon: '🪟',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'easter-egg',
    title: '???',
    description: 'Find the hidden easter egg',
    category: 'special',
    icon: '🥚',
    xpReward: 500,
    rarity: 'legendary',
    unlockedAt: null,
  },
  {
    id: 'warrior-complete',
    title: 'True Warrior',
    description: 'Unlock all other achievements',
    category: 'special',
    icon: '🛡️',
    xpReward: 2000,
    rarity: 'legendary',
    unlockedAt: null,
  },
];

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(
  category: AchievementCategory
): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

/**
 * Get achievement by ID
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get total possible XP from all achievements
 */
export function getTotalAchievementXP(): number {
  return ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0);
}
