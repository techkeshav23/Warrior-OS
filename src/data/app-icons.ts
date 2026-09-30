// ═══════════════════════════════════════════════════════════
// WARRIOR OS — App icon map (FORGED ARMOR insignia)
// One distinct lucide glyph + hue per app, hue chosen by family:
//   Learn       plasma / violet   (Training Grounds, Flashcards, Memory Palace, Algo Lab)
//   Build       mint / lime / steel / ember (Code Lab, Terminal, Files, Project Forge)
//   Discipline  ember / amber / gold (Habit Forge, Calendar, Profile, Warrior Hall)
//   Life        lavender / azure / rose (Notes + Expense Vault, Weather + Resume, WarBeats)
//   System      plasma / steel (NEXUS AI, Settings) + Calculator (lime)
// Render with <AppIcon appId size /> (src/components/ui/AppIcon.tsx) —
// desktop, start menu, taskbar, window title, palette and tour all use it.
// ═══════════════════════════════════════════════════════════

import {
  AppWindow,
  AudioLines,
  BrainCircuit,
  Calculator,
  CalendarDays,
  CloudSun,
  CodeXml,
  FileUser,
  Flame,
  FolderOpen,
  GalleryVerticalEnd,
  Anvil,
  Landmark,
  Network,
  NotebookPen,
  Settings,
  ShieldUser,
  Swords,
  SquareTerminal,
  Target,
  Vault,
  type LucideIcon,
} from 'lucide-react';

export type AppIconFamily = 'learn' | 'build' | 'discipline' | 'life' | 'system';

export type AppHue =
  | 'plasma'
  | 'violet'
  | 'mint'
  | 'lime'
  | 'steel'
  | 'ember'
  | 'amber'
  | 'gold'
  | 'azure'
  | 'rose'
  | 'lavender';

/**
 * Icon hues. These are the icon palette itself (data, not component
 * styling); plasma/ember/gold match the brand tokens, the rest are the
 * viz palette + two extras tuned for the ink tile.
 */
export const APP_HUES: Readonly<Record<AppHue, string>> = {
  plasma: '#2fd6f5',
  violet: '#a78bfa',
  mint: '#3ddc97',
  lime: '#b8e068',
  steel: '#9fb2cc',
  ember: '#ff8a3d',
  amber: '#ffb27a',
  gold: '#f5c04a',
  azure: '#6aa8ff',
  rose: '#ff6b8a',
  lavender: '#d3a6ff',
};

export interface AppIconSpec {
  icon: LucideIcon;
  hue: AppHue;
  family: AppIconFamily;
  /** lucide glyph name, for docs / the design-system page. */
  glyph: string;
}

export const APP_ICONS: Readonly<Record<string, AppIconSpec>> = {
  // Learn
  'training-grounds': { icon: Target, glyph: 'Target', hue: 'plasma', family: 'learn' },
  flashcards: { icon: GalleryVerticalEnd, glyph: 'GalleryVerticalEnd', hue: 'violet', family: 'learn' },
  'memory-palace': { icon: Landmark, glyph: 'Landmark', hue: 'plasma', family: 'learn' },
  'algo-lab': { icon: Network, glyph: 'Network', hue: 'violet', family: 'learn' },
  // Build
  'code-editor': { icon: CodeXml, glyph: 'CodeXml', hue: 'mint', family: 'build' },
  terminal: { icon: SquareTerminal, glyph: 'SquareTerminal', hue: 'lime', family: 'build' },
  'project-tracker': { icon: Anvil, glyph: 'Anvil', hue: 'ember', family: 'build' },
  'file-manager': { icon: FolderOpen, glyph: 'FolderOpen', hue: 'steel', family: 'build' },
  // Discipline
  'study-planner': { icon: Flame, glyph: 'Flame', hue: 'ember', family: 'discipline' },
  'warrior-profile': { icon: ShieldUser, glyph: 'ShieldUser', hue: 'gold', family: 'discipline' },
  calendar: { icon: CalendarDays, glyph: 'CalendarDays', hue: 'amber', family: 'discipline' },
  'warrior-hall': { icon: Swords, glyph: 'Swords', hue: 'ember', family: 'discipline' },
  // Life
  notes: { icon: NotebookPen, glyph: 'NotebookPen', hue: 'lavender', family: 'life' },
  'expense-vault': { icon: Vault, glyph: 'Vault', hue: 'lavender', family: 'life' },
  weather: { icon: CloudSun, glyph: 'CloudSun', hue: 'azure', family: 'life' },
  'music-player': { icon: AudioLines, glyph: 'AudioLines', hue: 'rose', family: 'life' },
  'resume-builder': { icon: FileUser, glyph: 'FileUser', hue: 'azure', family: 'life' },
  // System
  'nexus-ai': { icon: BrainCircuit, glyph: 'BrainCircuit', hue: 'plasma', family: 'system' },
  settings: { icon: Settings, glyph: 'Settings', hue: 'steel', family: 'system' },
  calculator: { icon: Calculator, glyph: 'Calculator', hue: 'lime', family: 'system' },
};

/** Used for unknown / future app ids. */
export const FALLBACK_APP_ICON: AppIconSpec = { icon: AppWindow, glyph: 'AppWindow', hue: 'steel', family: 'system' };

/** Retired ids that saved state may still hold. */
const LEGACY_IDS: Readonly<Record<string, string>> = { 'gate-prep': 'training-grounds' };

/** Icon spec for an app id (retired ids resolve; unknown ids get the fallback). */
export function getAppIconSpec(appId: string | null | undefined): AppIconSpec {
  if (!appId) return FALLBACK_APP_ICON;
  const id = Object.prototype.hasOwnProperty.call(LEGACY_IDS, appId) ? LEGACY_IDS[appId] : appId;
  return Object.prototype.hasOwnProperty.call(APP_ICONS, id) ? APP_ICONS[id] : FALLBACK_APP_ICON;
}

/** The hue color (hex) for an app id. */
export function getAppHue(appId: string | null | undefined): string {
  return APP_HUES[getAppIconSpec(appId).hue];
}
