// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Sound Registry
// Maps sound names to file paths in public/sounds/
// ═══════════════════════════════════════════════════════════

export interface SoundEntry {
  id: string;
  name: string;
  path: string;
  category: 'ui' | 'system' | 'achievement' | 'ambient';
}

/**
 * Sound effect registry — maps names to paths.
 * Actual .mp3 files should be placed in public/sounds/
 * For now these are placeholders — the files will be added later.
 */
export const SOUND_REGISTRY: SoundEntry[] = [
  // UI Sounds
  { id: 'click', name: 'Click', path: '/sounds/click.mp3', category: 'ui' },
  { id: 'hover', name: 'Hover', path: '/sounds/hover.mp3', category: 'ui' },
  { id: 'toggle', name: 'Toggle', path: '/sounds/toggle.mp3', category: 'ui' },
  { id: 'type', name: 'Type', path: '/sounds/type.mp3', category: 'ui' },

  // System Sounds
  { id: 'boot', name: 'Boot', path: '/sounds/boot.mp3', category: 'system' },
  { id: 'unlock', name: 'Unlock', path: '/sounds/unlock.mp3', category: 'system' },
  { id: 'startup', name: 'Startup', path: '/sounds/startup.mp3', category: 'system' },
  { id: 'open', name: 'Open Window', path: '/sounds/open.mp3', category: 'system' },
  { id: 'close', name: 'Close Window', path: '/sounds/close.mp3', category: 'system' },
  { id: 'minimize', name: 'Minimize', path: '/sounds/minimize.mp3', category: 'system' },
  { id: 'notification', name: 'Notification', path: '/sounds/notification.mp3', category: 'system' },
  { id: 'error', name: 'Error', path: '/sounds/error.mp3', category: 'system' },

  // Achievement Sounds
  { id: 'achievement', name: 'Achievement', path: '/sounds/achievement.mp3', category: 'achievement' },
  { id: 'xp', name: 'XP Gain', path: '/sounds/xp.mp3', category: 'achievement' },
  { id: 'levelup', name: 'Level Up', path: '/sounds/levelup.mp3', category: 'achievement' },
];

/**
 * Lookup table for quick access by id
 */
export const SOUND_MAP = Object.fromEntries(
  SOUND_REGISTRY.map((s) => [s.id, s.path])
) as Record<string, string>;

/**
 * Get sound path by id
 */
export function getSoundPath(id: string): string | undefined {
  return SOUND_MAP[id];
}
