// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Achievements Database
// All unlockable achievements organized by category
// ═══════════════════════════════════════════════════════════

import type { Achievement, AchievementCategory } from '@/types';
import { withPhase6Achievements } from './achievements-phase6';

const BASE_ACHIEVEMENTS: Achievement[] = [
  // ─── STUDY ACHIEVEMENTS ───
  {
    id: 'first-quiz',
    title: 'Quiz Initiate',
    description: 'Complete your first quiz in Training Grounds',
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
    description: 'Take a quiz in every subject in Training Grounds',
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

  // ─── PHASE 6 FEATURE ACHIEVEMENTS (exploration) ───
  {
    id: 'palace-architect',
    title: 'Palace Architect',
    description: 'Entered your Memory Palace and walked through a themed knowledge room for the first time.',
    category: 'exploration',
    icon: '🏛️',
    xpReward: 150,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'memory-cartographer',
    title: 'Memory Cartographer',
    description: 'Visited 5 or more subject rooms in a single Memory Palace session.',
    category: 'exploration',
    icon: '🗺️',
    xpReward: 250,
    rarity: 'epic',
    unlockedAt: null,
  },
  {
    id: 'ghost-first-cry',
    title: 'War Cry',
    description: 'Send your first anonymous war cry to the warriors around the campfire.',
    category: 'exploration',
    icon: '📣',
    xpReward: 50,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'ghost-campfire-bonfire',
    title: 'Bonfire Gathering',
    description: 'Be online when 10 or more warriors are studying at the same time.',
    category: 'exploration',
    icon: '🔥',
    xpReward: 100,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'ghost-not-alone',
    title: 'Never Alone',
    description: 'Discover the Ghost Warriors — open the leaderboard for the first time.',
    category: 'exploration',
    icon: '👻',
    xpReward: 40,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'os-composer',
    title: 'The OS Composer',
    description: 'Let Warrior OS compose procedural music for you across all four moods.',
    category: 'exploration',
    icon: '🎵',
    xpReward: 150,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'phantom-first-ghost',
    title: 'Ghost in the Machine',
    description: 'Watch a phantom of a closed window drift across your desktop for the first time.',
    category: 'exploration',
    icon: '👻',
    xpReward: 50,
    rarity: 'common',
    unlockedAt: null,
  },
  {
    id: 'phantom-resurrect',
    title: 'Necromancer',
    description: 'Resurrect a closed app by clicking its phantom before it dissolves.',
    category: 'exploration',
    icon: '🪄',
    xpReward: 100,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'biometrics-first-read',
    title: 'Self-Aware',
    description: 'The OS read your mental state from your typing for the first time.',
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

  // ─── PHASE 6 FEATURE ACHIEVEMENTS (special) ───
  {
    id: 'first-pet',
    title: 'First Pet',
    description: 'Your Warrior Creature hatched from its egg. A companion for the journey ahead.',
    category: 'special',
    icon: '🥚',
    xpReward: 100,
    rarity: 'uncommon',
    unlockedAt: null,
  },
  {
    id: 'ghost-of-knowledge',
    title: 'Ghost of Knowledge',
    description: 'Revived a note that had gone dark with cobwebs (unrevised for 30+ days) by opening its hologram.',
    category: 'special',
    icon: '🕸️',
    xpReward: 300,
    rarity: 'legendary',
    unlockedAt: null,
  },
  {
    id: 'decay-first-break',
    title: 'Know When to Rest',
    description: 'Complete your first NEXUS-forced recovery break.',
    category: 'special',
    icon: '🛡️',
    xpReward: 50,
    rarity: 'rare',
    unlockedAt: null,
  },
  {
    id: 'decay-legendary-focus',
    title: 'Mortal Body, Legendary Focus',
    description: 'Push continuous study into Stage 5 reality decay.',
    category: 'special',
    icon: '💀',
    xpReward: 100,
    rarity: 'epic',
    unlockedAt: null,
  },
  {
    id: 'biometrics-in-the-zone',
    title: 'In The Zone',
    description: 'Reached 90%+ focus while typing.',
    category: 'special',
    icon: '🎯',
    xpReward: 150,
    rarity: 'rare',
    unlockedAt: null,
  },
];

/**
 * Achievements unlocked by Phase 4-6 apps (Algo Lab, Calendar, Expense
 * Vault, Project Forge, Resume Builder, NEXUS, Reality Decay) that are
 * not part of the Phase 6 spec list. Ids match the feature code exactly.
 */
const INTEGRATION_ACHIEVEMENTS: Achievement[] = [
  // ─── ALGO LAB ───
  { id: 'algo-first-run', title: 'Algorithm Awakens', description: 'Run your first visualization in Algo Lab', category: 'study', icon: '📊', xpReward: 50, rarity: 'common', unlockedAt: null },
  { id: 'algo-all-sorts', title: 'Sorting Sensei', description: 'Visualize every sorting algorithm in Algo Lab', category: 'study', icon: '🧮', xpReward: 200, rarity: 'rare', unlockedAt: null },
  { id: 'algo-race-finished', title: 'Algorithm Race', description: 'Finish a side-by-side algorithm race', category: 'study', icon: '🏁', xpReward: 75, rarity: 'uncommon', unlockedAt: null },
  { id: 'algo-dijkstra-path', title: 'Shortest Path', description: "Trace a full shortest path with Dijkstra's algorithm", category: 'study', icon: '🗺️', xpReward: 100, rarity: 'uncommon', unlockedAt: null },
  { id: 'algo-avl-rotation', title: 'Balanced Mind', description: 'Trigger an AVL tree rotation', category: 'study', icon: '🌳', xpReward: 100, rarity: 'uncommon', unlockedAt: null },
  // ─── CALENDAR ───
  { id: 'calendar-ten-events', title: 'Master Planner', description: 'Plan 10 events in the Calendar', category: 'exploration', icon: '📅', xpReward: 100, rarity: 'uncommon', unlockedAt: null },
  // ─── EXPENSE VAULT ───
  { id: 'expense-first-log', title: 'Money Tracker', description: 'Log your first expense in Expense Vault', category: 'exploration', icon: '💰', xpReward: 50, rarity: 'common', unlockedAt: null },
  { id: 'expense-month-under-budget', title: 'Budget Guardian', description: 'Finish a month under budget', category: 'special', icon: '🛡️', xpReward: 200, rarity: 'rare', unlockedAt: null },
  // ─── PROJECT FORGE / RESUME ───
  { id: 'forge-10-hours', title: 'Deep Work Smith', description: 'Track 10 hours in Project Forge', category: 'build', icon: '⏱️', xpReward: 150, rarity: 'uncommon', unlockedAt: null },
  { id: 'forge-open-source', title: 'Open Source Warrior', description: 'Link a GitHub repo to a Forge project', category: 'build', icon: '🌐', xpReward: 75, rarity: 'common', unlockedAt: null },
  { id: 'resume-first-export', title: 'Paper Trail', description: 'Export your resume as PDF', category: 'build', icon: '📄', xpReward: 100, rarity: 'uncommon', unlockedAt: null },
  // ─── NEXUS ───
  { id: 'nexus-voice-command', title: 'Voice of Command', description: 'Give NEXUS your first voice command', category: 'exploration', icon: '🎙️', xpReward: 50, rarity: 'common', unlockedAt: null },
  { id: 'nexus-wake-word', title: 'Hey Warrior', description: 'Wake NEXUS with "Hey Warrior"', category: 'exploration', icon: '👂', xpReward: 75, rarity: 'uncommon', unlockedAt: null },
  { id: 'nexus-smart-mode', title: 'Mode Shifter', description: 'Activate study or chill mode through NEXUS', category: 'exploration', icon: '🔀', xpReward: 50, rarity: 'common', unlockedAt: null },
  { id: 'nexus-pomodoro', title: 'Tomato Timer', description: 'Finish your first NEXUS pomodoro', category: 'study', icon: '🍅', xpReward: 75, rarity: 'common', unlockedAt: null },
  // ─── REALITY DECAY ───
  { id: 'decay-legendary-focus', title: 'Legendary Focus', description: 'Study long enough to reach decay stage 5', category: 'special', icon: '🌀', xpReward: 200, rarity: 'epic', unlockedAt: null },
];

export const ACHIEVEMENTS: Achievement[] = withPhase6Achievements([
  ...BASE_ACHIEVEMENTS,
  ...INTEGRATION_ACHIEVEMENTS.filter((a) => !BASE_ACHIEVEMENTS.some((b) => b.id === a.id)),
]);

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
