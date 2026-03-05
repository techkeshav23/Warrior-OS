// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Types
// ═══════════════════════════════════════════════════════════

export type NexusRole = 'user' | 'nexus' | 'system';

export interface NexusMessage {
  id: string;
  role: NexusRole;
  content: string;
  timestamp: string;
  /** Optional action the message triggered */
  action?: NexusAction;
}

export interface NexusAction {
  type: NexusActionType;
  payload: Record<string, unknown>;
}

export type NexusActionType =
  | 'open_app'
  | 'close_app'
  | 'switch_workspace'
  | 'change_wallpaper'
  | 'start_quiz'
  | 'set_timer'
  | 'arrange_windows'
  | 'search_notes'
  | 'show_stats'
  | 'study_mode'
  | 'chill_mode'
  | 'suggest_topic';

export interface NexusContext {
  openApps: string[];
  currentWorkspace: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late-night';
  userLevel: number;
  currentStreak: number;
  lastQuizScore?: number;
  idleMinutes: number;
  studyHoursToday: number;
}

export interface NexusMood {
  type: 'neutral' | 'proud' | 'worried' | 'excited' | 'sarcastic' | 'stern' | 'mentor';
  intensity: number; // 0-1
}
