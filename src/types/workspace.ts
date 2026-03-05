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

export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'study',
    name: 'Study',
    accentColor: '#00f0ff',
    wallpaper: 'nebula',
    openWindowIds: [],
    icon: 'GraduationCap',
  },
  {
    id: 'build',
    name: 'Build',
    accentColor: '#00e676',
    wallpaper: 'matrix',
    openWindowIds: [],
    icon: 'Code2',
  },
  {
    id: 'chill',
    name: 'Chill',
    accentColor: '#7b61ff',
    wallpaper: 'aurora',
    openWindowIds: [],
    icon: 'Music',
  },
];
