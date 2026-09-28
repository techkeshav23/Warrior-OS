// ═══════════════════════════════════════════════════════════
// WARRIOR OS — App Registry
// All registered applications with metadata
// ═══════════════════════════════════════════════════════════

import dynamic from 'next/dynamic';
import type { AppDefinition } from '@/types';
import { AppLoading } from '@/components/os/AppLoading';

// ─── Lazy app components (TASK 5.23 / 5.25) ───
// Every app is its own client-only chunk, fetched the first time its
// window opens. ssr:false keeps browser-only code (three.js, Tone.js,
// Monaco, Web Audio, localStorage) out of the server render.
const MusicApp = dynamic(
  () => import('@/components/apps/music-player/MusicApp').then((m) => m.MusicApp),
  { ssr: false, loading: AppLoading }
);
const TrainingGroundsApp = dynamic(
  () => import('@/components/apps/training-grounds/TrainingGroundsApp').then((m) => m.TrainingGroundsApp),
  { ssr: false, loading: AppLoading }
);
const FlashcardsApp = dynamic(
  () => import('@/components/apps/training-grounds/FlashcardsApp').then((m) => m.FlashcardsApp),
  { ssr: false, loading: AppLoading }
);
const NotesApp = dynamic(
  () => import('@/components/apps/notes-archive/NotesApp').then((m) => m.NotesApp),
  { ssr: false, loading: AppLoading }
);
const HabitForgeApp = dynamic(
  () => import('@/components/apps/habit-forge/HabitForgeApp').then((m) => m.HabitForgeApp),
  { ssr: false, loading: AppLoading }
);
const StatsCenterApp = dynamic(
  () => import('@/components/apps/stats-center/StatsCenterApp').then((m) => m.StatsCenterApp),
  { ssr: false, loading: AppLoading }
);
const SettingsApp = dynamic(
  () => import('@/components/apps/settings/SettingsApp').then((m) => m.SettingsApp),
  { ssr: false, loading: AppLoading }
);
const TerminalApp = dynamic(
  () => import('@/components/apps/terminal/TerminalApp').then((m) => m.TerminalApp),
  { ssr: false, loading: AppLoading }
);
const AIAssistApp = dynamic(
  () => import('@/components/apps/ai-assist/AIAssistApp').then((m) => m.AIAssistApp),
  { ssr: false, loading: AppLoading }
);
const CalculatorApp = dynamic(
  () => import('@/components/apps/calculator/CalculatorApp').then((m) => m.CalculatorApp),
  { ssr: false, loading: AppLoading }
);
const WeatherApp = dynamic(
  () => import('@/components/apps/weather/WeatherApp').then((m) => m.WeatherApp),
  { ssr: false, loading: AppLoading }
);
const FilesApp = dynamic(
  () => import('@/components/apps/files/FilesApp').then((m) => m.FilesApp),
  { ssr: false, loading: AppLoading }
);
const ProjectForgeApp = dynamic(
  () => import('@/components/apps/project-forge/ProjectForgeApp').then((m) => m.ProjectForgeApp),
  { ssr: false, loading: AppLoading }
);
const CodeLabApp = dynamic(
  () => import('@/components/apps/code-lab/CodeLabApp').then((m) => m.CodeLabApp),
  { ssr: false, loading: AppLoading }
);
const MemoryPalaceApp = dynamic(
  () => import('@/components/apps/memory-palace/MemoryPalaceApp').then((m) => m.MemoryPalaceApp),
  { ssr: false, loading: AppLoading }
);
const AlgoLabApp = dynamic(
  () => import('@/components/apps/algo-lab/AlgoLabApp').then((m) => m.AlgoLabApp),
  { ssr: false, loading: AppLoading }
);
const CalendarApp = dynamic(
  () => import('@/components/apps/calendar/CalendarApp').then((m) => m.CalendarApp),
  { ssr: false, loading: AppLoading }
);
const ExpenseVaultApp = dynamic(
  () => import('@/components/apps/expense-vault/ExpenseVaultApp').then((m) => m.ExpenseVaultApp),
  { ssr: false, loading: AppLoading }
);
const ResumeApp = dynamic(
  () => import('@/components/apps/resume-builder/ResumeApp').then((m) => m.ResumeApp),
  { ssr: false, loading: AppLoading }
);

/**
 * Master registry of all WARRIOR OS applications.
 * Components are lazy (next/dynamic, ssr:false) — see above.
 */
export const APP_REGISTRY: AppDefinition[] = [
  // ─── STUDY APPS ───
  {
    id: 'training-grounds',
    name: 'Training Grounds',
    icon: '🎯',
    component: TrainingGroundsApp,
    defaultSize: { width: 900, height: 650 },
    minSize: { width: 600, height: 400 },
    category: 'study',
    description: 'Learn anything: your own decks, quizzes, flashcards, skill tree and mock tests',
    shortcut: 'ctrl+g',
  },
  {
    // id kept as 'study-planner' (saved state and older links use it).
    id: 'study-planner',
    name: 'Quest Planner',
    icon: '🔥',
    component: HabitForgeApp,
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 500, height: 350 },
    category: 'study',
    description: 'Daily quests, habits, routines and streaks',
  },
  {
    id: 'flashcards',
    name: 'Flashcards',
    icon: '🃏',
    component: FlashcardsApp,
    defaultSize: { width: 700, height: 500 },
    minSize: { width: 400, height: 300 },
    category: 'study',
    description: 'Spaced-repetition review of your decks',
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
    // id kept as 'project-tracker' (Resume Builder + older saves launch it);
    // replaces the legacy 'Projects' board, whose data Forge migrates.
    id: 'project-tracker',
    name: 'Project Forge',
    icon: '🔨',
    component: ProjectForgeApp,
    defaultSize: { width: 1000, height: 680 },
    minSize: { width: 640, height: 420 },
    category: 'build',
    description: 'Kanban project board with time tracking and shipping rewards',
  },
  {
    id: 'algo-lab',
    name: 'Algo Lab',
    icon: '📊',
    component: AlgoLabApp,
    defaultSize: { width: 1050, height: 700 },
    minSize: { width: 640, height: 440 },
    category: 'build',
    description: 'Step-by-step sorting, graph and tree algorithm visualizer',
  },
  {
    id: 'resume-builder',
    name: 'Resume Builder',
    icon: '📄',
    component: ResumeApp,
    defaultSize: { width: 1100, height: 720 },
    minSize: { width: 560, height: 420 },
    category: 'build',
    description: 'Resume editor with live preview, auto-filled from Project Forge, PDF export',
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

  {
    id: 'calendar',
    name: 'Calendar',
    icon: '📅',
    component: CalendarApp,
    defaultSize: { width: 900, height: 640 },
    minSize: { width: 560, height: 420 },
    category: 'utility',
    description: 'Month view, agenda and reminders',
    singleton: true,
  },
  {
    id: 'expense-vault',
    name: 'Expense Vault',
    icon: '💰',
    component: ExpenseVaultApp,
    defaultSize: { width: 950, height: 660 },
    minSize: { width: 560, height: 420 },
    category: 'utility',
    description: 'Expense log, monthly budget and spending trends',
    singleton: true,
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
 * Retired app ids → their current id. Saved state (achievement progress,
 * NEXUS chat buttons, links) may still hold an old id.
 */
export const LEGACY_APP_IDS: Readonly<Record<string, string>> = {
  'gate-prep': 'training-grounds',
};

/** Current id for an app id that may be a retired one. */
export function resolveAppId(id: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_APP_IDS, id) ? LEGACY_APP_IDS[id] : id;
}

/**
 * Get app definition by ID (retired ids resolve to their replacement)
 */
export function getAppById(id: string): AppDefinition | undefined {
  const current = resolveAppId(id);
  return APP_REGISTRY.find((app) => app.id === current);
}

/**
 * Get apps filtered by category
 */
export function getAppsByCategory(category: AppDefinition['category']): AppDefinition[] {
  return APP_REGISTRY.filter((app) => app.category === category);
}
