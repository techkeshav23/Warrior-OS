// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Constants
// ═══════════════════════════════════════════════════════════

import type { LevelInfo } from '@/types/achievement';

// ─── Boot Messages ───
export const BOOT_MESSAGES = [
  { time: '0.001', message: 'BIOS check', status: 'OK' },
  { time: '0.012', message: 'Memory: 16384 MB detected', status: 'OK' },
  { time: '0.034', message: 'Neural core v4.0 loading', status: 'OK' },
  { time: '0.089', message: 'Quantum state resolver', status: 'OK' },
  { time: '0.142', message: 'Firebase neural sync', status: 'OK' },
  { time: '0.201', message: 'Mounting knowledge drives', status: 'OK' },
  { time: '0.256', message: 'Sound engine initialization', status: 'OK' },
  { time: '0.312', message: 'Shader pipeline compilation', status: 'OK' },
  { time: '0.389', message: 'Window compositor ready', status: 'OK' },
  { time: '0.445', message: 'NEXUS AI companion awakening', status: 'OK' },
  { time: '0.512', message: 'Warrior creature sync', status: 'OK' },
  { time: '0.601', message: 'Achievement system online', status: 'OK' },
  { time: '0.678', message: 'Loading user profile', status: 'OK' },
  { time: '0.756', message: 'Desktop env ready', status: 'OK' },
  { time: '0.800', message: 'WARRIOR OS v4.0 — THE LIVING WORLD', status: 'READY' },
] as const;

// ─── Level Thresholds ───
export const LEVEL_THRESHOLDS: LevelInfo[] = [
  { level: 1, title: 'Recruit', minXP: 0, maxXP: 100 },
  { level: 2, title: 'Initiate', minXP: 100, maxXP: 250 },
  { level: 3, title: 'Apprentice', minXP: 250, maxXP: 500 },
  { level: 4, title: 'Fighter', minXP: 500, maxXP: 800 },
  { level: 5, title: 'Warrior', minXP: 800, maxXP: 1200 },
  { level: 6, title: 'Gladiator', minXP: 1200, maxXP: 1700 },
  { level: 7, title: 'Centurion', minXP: 1700, maxXP: 2300 },
  { level: 8, title: 'Champion', minXP: 2300, maxXP: 3000 },
  { level: 9, title: 'Commander', minXP: 3000, maxXP: 4000 },
  { level: 10, title: 'Warlord', minXP: 4000, maxXP: 5200 },
  { level: 11, title: 'Conqueror', minXP: 5200, maxXP: 6500 },
  { level: 12, title: 'Grandmaster', minXP: 6500, maxXP: 8000 },
  { level: 13, title: 'Legendary', minXP: 8000, maxXP: 10000 },
  { level: 14, title: 'Mythic', minXP: 10000, maxXP: 13000 },
  { level: 15, title: 'Immortal', minXP: 13000, maxXP: 17000 },
  { level: 16, title: 'Transcendent', minXP: 17000, maxXP: 22000 },
  { level: 17, title: 'Cosmic', minXP: 22000, maxXP: 28000 },
  { level: 18, title: 'Eternal', minXP: 28000, maxXP: 35000 },
  { level: 19, title: 'Godlike', minXP: 35000, maxXP: 45000 },
  { level: 20, title: 'Ascendant', minXP: 45000, maxXP: Infinity },
];

// ─── Keyboard Shortcuts ───
export const KEYBOARD_SHORTCUTS = {
  COMMAND_PALETTE: 'ctrl+k',
  WORKSPACE_1: 'ctrl+1',
  WORKSPACE_2: 'ctrl+2',
  WORKSPACE_3: 'ctrl+3',
  CLOSE_WINDOW: 'alt+f4',
  MINIMIZE_ALL: 'super+d',
  LOCK_SCREEN: 'ctrl+l',
  SEARCH: 'ctrl+shift+f',
  SETTINGS: 'ctrl+,',
  REFRESH: 'f5',
} as const;

// ─── OS Phases ───
export type OSPhase = 'dream' | 'boot' | 'lock' | 'desktop';

// ─── Sound Effects ───
export const SOUND_EFFECTS = {
  BOOT: '/sounds/boot.mp3',
  CLICK: '/sounds/click.mp3',
  HOVER: '/sounds/hover.mp3',
  OPEN_WINDOW: '/sounds/open.mp3',
  CLOSE_WINDOW: '/sounds/close.mp3',
  MINIMIZE: '/sounds/minimize.mp3',
  NOTIFICATION: '/sounds/notification.mp3',
  ACHIEVEMENT: '/sounds/achievement.mp3',
  ERROR: '/sounds/error.mp3',
  UNLOCK: '/sounds/unlock.mp3',
  STARTUP: '/sounds/startup.mp3',
  XP_GAIN: '/sounds/xp.mp3',
  LEVEL_UP: '/sounds/levelup.mp3',
} as const;

// ─── Wallpaper Names ───
export const WALLPAPER_OPTIONS = [
  { id: 'void', name: 'Void Minimal', category: 'dark' },
  { id: 'starfield', name: 'Star Field', category: 'dark' },
  { id: 'nebula', name: 'Nebula', category: 'shader' },
  { id: 'aurora', name: 'Aurora', category: 'shader' },
  { id: 'fluid', name: 'Fluid Simulation', category: 'shader' },
  { id: 'matrix', name: 'Cyberpunk Rain', category: 'dark' },
  { id: 'neural', name: 'Neural Network', category: 'shader' },
] as const;
