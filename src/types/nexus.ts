// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS AI Types
// Chat, executable commands, AI wire protocol, pomodoro, voice, nudges
// ═══════════════════════════════════════════════════════════

import type { ExpenseCategory } from './expense';

export type NexusRole = 'user' | 'nexus' | 'system';

/** Where a NEXUS reply came from. `offline` = AI route has no key configured. */
export type NexusReplySource = 'local' | 'ai' | 'error' | 'offline';

/** How a user message reached NEXUS. */
export type NexusInputChannel = 'text' | 'voice' | 'palette' | 'button';

export type NexusTone = 'info' | 'success' | 'warning' | 'danger';

export type NexusWorkspaceId = 'study' | 'build' | 'chill';

/**
 * Training Grounds launch modes understood by the 'warrior:training-start'
 * contract event. 'flashcards' is the spaced-repetition review of due cards.
 */
export type NexusTrainingMode = 'quiz' | 'mock' | 'flashcards' | 'planner';

/**
 * An executable OS command — the single currency of NexusCore.
 * Produced by the local intent parser, by AI replies (after client-side
 * resolution) and by suggestion buttons.
 */
export type NexusCommand =
  | { type: 'open_app'; appId: string; appName: string; newWindow?: boolean }
  | { type: 'focus_app'; appId: string; appName: string }
  | { type: 'close_app'; appId: string; appName: string }
  | { type: 'close_all' }
  | { type: 'switch_workspace'; workspaceId: NexusWorkspaceId }
  | { type: 'search_notes'; query: string }
  /** `subject` is free text naming one of the user's decks or topics. */
  | { type: 'start_quiz'; mode: NexusTrainingMode; subject?: string }
  /** Deck report: mastery and cards due per deck. */
  | { type: 'show_decks' }
  | { type: 'study_mode' }
  | { type: 'chill_mode' }
  | { type: 'change_wallpaper'; wallpaperId?: string }
  | { type: 'start_pomodoro'; focusMinutes?: number; breakMinutes?: number }
  | { type: 'pause_pomodoro' }
  | { type: 'resume_pomodoro' }
  | { type: 'stop_pomodoro' }
  | { type: 'show_stats' }
  | { type: 'take_break' }
  | { type: 'clear_chat' }
  | { type: 'new_chat' }
  | { type: 'add_expense'; amount: number; category: ExpenseCategory; note: string }
  | { type: 'check_habit'; habit: string };

export type NexusCommandType = NexusCommand['type'];

/** A button rendered under a NEXUS message or nudge. */
export type NexusActionButton =
  | { kind: 'command'; label: string; command: NexusCommand }
  | { kind: 'ask'; label: string; prompt: string };

export interface NexusMessage {
  id: string;
  role: NexusRole;
  content: string;
  timestamp: string;
  /** Optional action the message triggered (legacy shape) */
  action?: NexusAction;
  /** Where a NEXUS reply came from */
  source?: NexusReplySource;
  /** How a user message was entered */
  via?: NexusInputChannel;
  /** Suggested follow-up actions, rendered as buttons */
  actions?: NexusActionButton[];
}

export interface NexusConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: NexusMessage[];
}

/** Legacy action shape (kept for compatibility). */
export interface NexusAction {
  type: NexusActionType;
  payload: Record<string, unknown>;
}

export type NexusActionType =
  | 'open_app'
  | 'close_app'
  | 'focus_app'
  | 'close_all'
  | 'switch_workspace'
  | 'change_wallpaper'
  | 'start_quiz'
  | 'set_timer'
  | 'arrange_windows'
  | 'search_notes'
  | 'show_stats'
  | 'study_mode'
  | 'chill_mode'
  | 'suggest_topic'
  | 'start_pomodoro'
  | 'stop_pomodoro'
  | 'take_break';

export interface NexusContext {
  openApps: string[];
  currentWorkspace: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | 'late-night';
  userLevel: number;
  currentStreak: number;
  lastQuizScore?: number;
  idleMinutes: number;
  studyHoursToday: number;
  /** Local wall-clock time, e.g. "21:40" */
  localTime?: string;
  /** Who is using this browser: the OS owner or a visitor exploring it */
  visitor?: 'owner' | 'guest';
  /** Names of the user's learning decks (Training Grounds), capped */
  decks?: string[];
  /** Cards due for spaced-repetition review right now (new cards excluded) */
  dueCards?: number;
  /** Deck to work on next: most cards due, else the weakest started one */
  focusDeck?: string;
  /** Multi-line OS-state summary, only sent when the context toggle is on */
  summary?: string;
}

export interface NexusMood {
  type: 'neutral' | 'proud' | 'worried' | 'excited' | 'sarcastic' | 'stern' | 'mentor';
  intensity: number; // 0-1
}

// ─── AI wire protocol (client ⇄ /api/ai) ───

/** Action types Gemini may return inside its JSON reply. */
export type NexusWireActionType =
  | 'open_app'
  | 'close_app'
  | 'focus_app'
  | 'search_notes'
  | 'start_quiz'
  | 'start_mock_test'
  | 'open_flashcards'
  | 'study_mode'
  | 'chill_mode'
  | 'change_wallpaper'
  | 'start_pomodoro'
  | 'stop_pomodoro'
  | 'switch_workspace'
  | 'show_stats'
  | 'show_decks'
  | 'take_break'
  | 'ask';

/** Raw (unresolved) action from the AI: targets are free text resolved on the client. */
export interface NexusWireAction {
  type: NexusWireActionType;
  target?: string;
  label?: string;
}

export interface NexusChatTurn {
  role: 'user' | 'nexus';
  content: string;
}

export interface NexusAIRequestBody {
  message: string;
  history?: NexusChatTurn[];
  context?: Partial<NexusContext>;
}

export interface NexusAIResponseBody {
  reply: string;
  command?: NexusWireAction | null;
  actions?: NexusWireAction[];
  model?: string;
  /** True when the rule-based offline brain answered (no Gemini key / Gemini unreachable). */
  offline?: boolean;
  error?: string;
  retryAfter?: number;
}

// ─── Pomodoro ───

export type NexusPomodoroPhase = 'idle' | 'focus' | 'break';

export interface NexusPomodoroState {
  phase: NexusPomodoroPhase;
  /** Epoch ms when the running phase ends; null while paused or idle */
  endsAt: number | null;
  /** Remaining ms while paused; null otherwise */
  pausedRemainingMs: number | null;
  /** Full length of the current phase in ms */
  phaseDurationMs: number;
  focusMinutes: number;
  breakMinutes: number;
  /** UTC day key (YYYY-MM-DD) the "today" counters belong to */
  dayKey: string;
  completedToday: number;
  focusMinutesToday: number;
  totalCompleted: number;
}

export interface NexusPomodoroTransition {
  completed: 'focus' | 'break';
  /** True when the phase ended long before the OS noticed (tab closed / asleep) */
  late: boolean;
  focusMinutes: number;
  breakMinutes: number;
}

// ─── Voice ───

export type NexusVoiceMode = 'off' | 'push' | 'wake';

export interface NexusVoiceState {
  /** null until feature detection ran in the browser */
  supported: boolean | null;
  mode: NexusVoiceMode;
  /** User opted into "Hey Warrior" wake mode this session */
  wakeEnabled: boolean;
  /** Microphone is currently capturing */
  micActive: boolean;
  /** Wake phrase heard, waiting for the command */
  capturing: boolean;
  /** A voice command is being processed */
  processing: boolean;
  /** SpeechSynthesis is speaking a reply */
  speaking: boolean;
  interim: string;
  lastHeard: string;
  /** Last reply to a voice command, shown briefly in the HUD */
  lastReply: string;
  error: string | null;
}

// ─── Proactive nudges ───

export interface NexusNudge {
  id: string;
  /** Suggestion rule id, or 'event' for 'warrior:nexus-say' messages */
  ruleId: string;
  text: string;
  tone: NexusTone;
  at: number;
  source: 'suggestion' | 'event';
  action?: NexusActionButton;
}
