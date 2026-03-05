// ═══════════════════════════════════════════════════════════
// WARRIOR OS — App Types
// ═══════════════════════════════════════════════════════════

import type { ComponentType } from 'react';
import type { Size } from './window';

export type AppCategory = 'study' | 'build' | 'utility' | 'chill' | 'system';

export interface AppDefinition {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  component: ComponentType;
  defaultSize: Size;
  minSize: Size;
  category: AppCategory;
  shortcut?: string; // e.g. "Ctrl+Shift+N"
  description?: string;
  /** Whether the app allows multiple instances */
  singleton?: boolean;
}
