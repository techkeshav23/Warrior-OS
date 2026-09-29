// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace Types
// ═══════════════════════════════════════════════════════════

export interface Workspace {
  id: string;
  name: string;
  accentColor: string;
  wallpaper: string;
  openWindowIds: string[];
  icon: string; // Lucide icon name
}

export type WorkspaceId = 'study' | 'build' | 'chill';

/** The parts of a workspace a user can change (Settings, the desktop menu). */
export type WorkspacePatch = Partial<Pick<Workspace, 'name' | 'accentColor' | 'wallpaper' | 'icon'>>;

/** Default looks use the FORGED ARMOR palette (see src/styles/tokens.ts). */
export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'study',
    name: 'Study',
    accentColor: '#ff8a3d', // Ember (the brand)
    wallpaper: 'void', // Forge Night
    openWindowIds: [],
    icon: 'GraduationCap',
  },
  {
    id: 'build',
    name: 'Build',
    accentColor: '#3ddc97', // Mint
    wallpaper: 'matrix',
    openWindowIds: [],
    icon: 'Code2',
  },
  {
    id: 'chill',
    name: 'Chill',
    accentColor: '#a78bfa', // Violet
    wallpaper: 'aurora',
    openWindowIds: [],
    icon: 'Music',
  },
];
