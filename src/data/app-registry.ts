// ═══════════════════════════════════════════════════════════
// WARRIOR OS — App Registry
// All registered applications with metadata
// ═══════════════════════════════════════════════════════════

import type { AppDefinition } from '@/types';
import { MusicApp } from '@/components/apps/music-player/MusicApp';
import { GateArenaApp } from '@/components/apps/gate-arena/GateArenaApp';
import { NotesApp } from '@/components/apps/notes-archive/NotesApp';
import { HabitForgeApp } from '@/components/apps/habit-forge/HabitForgeApp';
import { StatsCenterApp } from '@/components/apps/stats-center/StatsCenterApp';
import { SettingsApp } from '@/components/apps/settings/SettingsApp';
import { TerminalApp } from '@/components/apps/terminal/TerminalApp';
import { AIAssistApp } from '@/components/apps/ai-assist/AIAssistApp';
import { CalculatorApp } from '@/components/apps/calculator/CalculatorApp';
import { WeatherApp } from '@/components/apps/weather/WeatherApp';
import { FilesApp } from '@/components/apps/files/FilesApp';
import { ProjectsApp } from '@/components/apps/projects/ProjectsApp';
import { CodeLabApp } from '@/components/apps/code-lab/CodeLabApp';
import { MemoryPalaceApp } from '@/components/apps/memory-palace';

/**
 * Master registry of all WARRIOR OS applications.
 * Components will be replaced with actual implementations
 * as each app is built in subsequent phases.
 */
export const APP_REGISTRY: AppDefinition[] = [
  // ─── STUDY APPS ───
  {
    id: 'gate-prep',
    name: 'GATE Prep',
    icon: '🎯',
    component: GateArenaApp,
    defaultSize: { width: 900, height: 650 },
    minSize: { width: 600, height: 400 },
    category: 'study',
    description: 'GATE CS/IT exam preparation with AI-powered quizzes',
    shortcut: 'ctrl+g',
  },
  {
    id: 'study-planner',
    name: 'Habit Forge',
    icon: '🔥',
    component: HabitForgeApp,
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 500, height: 350 },
    category: 'study',
    description: 'Daily habit tracking, routines, and streak system',
  },
  {
    id: 'flashcards',
    name: 'Flashcards',
    icon: '🃏',
    component: GateArenaApp,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    category: 'study',
    description: 'Spaced repetition flashcard system',
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: '📝',
    component: NotesApp,
    defaultSize: { width: 750, height: 550 },
    minSize: { width: 400, height: 300 },
    category: 'study',
    description: 'Rich markdown note-taking with auto-save',
  },
  {
    id: 'memory-palace',
    name: 'Memory Palace',
    icon: '🏛️',
    component: MemoryPalaceApp,
    defaultSize: { width: 960, height: 680 },
    minSize: { width: 640, height: 460 },
    category: 'study',
    description: '3D walkable knowledge space — explore your notes as glowing objects',
    shortcut: 'ctrl+shift+m',
    singleton: true,
  },

  // ─── BUILD APPS ───
  {
    id: 'code-editor',
    name: 'Code Lab',
    icon: '💻',
    component: CodeLabApp,
    defaultSize: { width: 950, height: 700 },
    minSize: { width: 600, height: 400 },
    category: 'build',
    description: 'Monaco-based code editor with live preview',
    shortcut: 'ctrl+shift+c',
  },
  {
    id: 'project-tracker',
    name: 'Projects',
    icon: '🚀',
    component: ProjectsApp,
    defaultSize: { width: 850, height: 600 },
    minSize: { width: 500, height: 350 },
    category: 'build',
    description: 'Kanban project management board',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    icon: '⚡',
    component: TerminalApp,
    defaultSize: { width: 700, height: 450 },
    minSize: { width: 400, height: 250 },
    category: 'build',
    description: 'Command-line interface with custom commands',
    shortcut: 'ctrl+`',
  },

  // ─── UTILITY APPS ───
  {
    id: 'nexus-ai',
    name: 'NEXUS AI',
    icon: '🧠',
    component: AIAssistApp,
    defaultSize: { width: 450, height: 600 },
    minSize: { width: 350, height: 400 },
    category: 'utility',
    description: 'AI assistant powered by Gemini',
    shortcut: 'ctrl+n',
    singleton: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    component: SettingsApp,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 450, height: 350 },
    category: 'utility',
    description: 'System preferences and customization',
    singleton: true,
  },
  {
    id: 'file-manager',
    name: 'Files',
    icon: '📁',
    component: FilesApp,
    defaultSize: { width: 800, height: 550 },
    minSize: { width: 500, height: 350 },
    category: 'utility',
    description: 'File explorer and document manager',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    icon: '🔢',
    component: CalculatorApp,
    defaultSize: { width: 350, height: 500 },
    minSize: { width: 280, height: 400 },
    category: 'utility',
    description: 'Scientific calculator',
  },

  // ─── CHILL APPS ───
  {
    id: 'music-player',
    name: 'WarBeats',
    icon: '🎵',
    component: MusicApp,
    defaultSize: { width: 400, height: 500 },
    minSize: { width: 300, height: 350 },
    category: 'chill',
    description: 'Lo-fi beats and focus music player',
    shortcut: 'ctrl+m',
    singleton: true,
  },
  {
    id: 'weather',
    name: 'Weather',
    icon: '🌤️',
    component: WeatherApp,
    defaultSize: { width: 400, height: 450 },
    minSize: { width: 300, height: 300 },
    category: 'chill',
    description: 'Weather forecast widget',
    singleton: true,
  },
  {
    id: 'warrior-profile',
    name: 'Profile',
    icon: '🛡️',
    component: StatsCenterApp,
    defaultSize: { width: 600, height: 500 },
    minSize: { width: 400, height: 350 },
    category: 'chill',
    description: 'Warrior profile, stats, and achievements',
    singleton: true,
  },
];

/**
 * Get app definition by ID
 */
export function getAppById(id: string): AppDefinition | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}

/**
 * Get apps filtered by category
 */
export function getAppsByCategory(category: AppDefinition['category']): AppDefinition[] {
  return APP_REGISTRY.filter((app) => app.category === category);
}
