// ═══════════════════════════════════════════════════════════
// WARRIOR OS — NEXUS Core
//
// The brain. Takes natural language, resolves it locally first
// (lib/nexus-intent), executes real OS actions (open/close/focus
// apps, notes search, GATE quizzes, smart modes, wallpaper,
// pomodoro, breaks) and only falls back to Gemini (/api/ai) for
// what the parser cannot map. AI replies may carry one command
// (auto-run when safe) plus suggested action buttons.
//
// Used by: NexusChat / AI Assist, CommandPalette (Ctrl+K), voice,
// suggestion buttons.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useXPStore } from '@/stores/useXPStore';
import { useDecayStore } from '@/stores/useDecayStore';
import {
  commandKey,
  describeCommand,
  parseLocalIntent,
  resolveWireButton,
  resolveWireCommand,
  wallpaperName,
  type LocalIntent,
} from '@/lib/nexus-intent';
import { emitWarriorEvent, WARRIOR_EVENTS, type WarriorGateStartQuizDetail } from '@/lib/nexus/events';
import { centerWindow, findAppWindows, focusAppWindow, openOrFocusApp, snapWindow } from '@/lib/nexus/windows';
import {
  buildNexusContext,
  computeHabitStreak,
  findMatchingNotes,
  formatClock,
  getQuizInsights,
  loadHabitsLite,
  pomodoroRemainingMs,
} from '@/lib/nexus/context';
import { requestNexusAI } from '@/lib/nexus/ai-client';
import { checkHabitToday, listHabits, logExpense } from '@/lib/nexus/quick-actions';
import { NEXUS_LIMITS } from '@/lib/nexus/protocol';
import { speakNexus } from '@/lib/nexus/speech';
import { NEXUS_HELP_TEXT, NEXUS_LINES } from '@/data/nexus-personality';
import { WALLPAPER_OPTIONS } from '@/lib/constants';
import type { ExpenseCategory } from '@/types/expense';
import type {
  NexusActionButton,
  NexusChatTurn,
  NexusCommand,
  NexusCommandType,
  NexusGateMode,
  NexusInputChannel,
  NexusReplySource,
  NexusWorkspaceId,
} from '@/types/nexus';

export interface NexusCommandResult {
  ok: boolean;
  reply: string;
  followUps?: NexusActionButton[];
}

export interface NexusTurnResult {
  reply: string;
  source: NexusReplySource;
  actions: NexusActionButton[];
  intent?: LocalIntent;
}

/** Achievement ids NEXUS unlocks (definitions: data/achievements.ts). */
export const NEXUS_ACHIEVEMENTS = {
  firstChat: 'nexus-chat',
  firstVoice: 'nexus-voice-command',
  wakeWord: 'nexus-wake-word',
  smartMode: 'nexus-smart-mode',
  pomodoro: 'nexus-pomodoro',
  commandPalette: 'command-palette',
} as const;

/** Idempotent unlock (a no-op until the XP store is seeded with the id). */
export function unlockNexusAchievement(id: string): void {
  useXPStore.getState().unlockAchievement(id);
}

const STUDY_WALLPAPER = 'void';
const CHILL_WALLPAPER = 'aurora';

/** Commands an AI reply may run without a click (non-destructive only). */
const AI_AUTO_EXECUTE: ReadonlySet<NexusCommandType> = new Set<NexusCommandType>([
  'open_app',
  'focus_app',
  'search_notes',
  'start_quiz',
  'study_mode',
  'change_wallpaper',
  'start_pomodoro',
  'switch_workspace',
  'show_stats',
]);

// ─── Small helpers ───

function appLabel(appId: string, fallback: string): string {
  return useAppStore.getState().getApp(appId)?.name ?? fallback;
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function button(command: NexusCommand, label?: string): NexusActionButton {
  return { kind: 'command', label: label ?? describeCommand(command), command };
}

/**
 * Set a wallpaper that survives a workspace switch: WorkspaceManager
 * re-applies the workspace default in an effect right after a switch,
 * so re-assert ours once when that happens.
 */
function applyWallpaper(wallpaperId: string, workspaceSwitched: boolean): void {
  useSettingsStore.getState().setWallpaper(wallpaperId);
  if (!workspaceSwitched || typeof window === 'undefined') return;
  const guard = { done: false, timeoutId: 0 };
  const unsubscribe = useSettingsStore.subscribe((state, prev) => {
    if (guard.done || state.wallpaper === prev.wallpaper || state.wallpaper === wallpaperId) return;
    guard.done = true;
    unsubscribe();
    window.clearTimeout(guard.timeoutId);
    useSettingsStore.getState().setWallpaper(wallpaperId);
  });
  guard.timeoutId = window.setTimeout(() => {
    if (guard.done) return;
    guard.done = true;
    unsubscribe();
  }, 1500);
}

// ─── Executors ───

function runOpenApp(appId: string, appName: string, newWindow: boolean): NexusCommandResult {
  // NEXUS chat state lives in a store, so its window can simply move here.
  const result = openOrFocusApp(appId, { forceNew: newWindow, relocate: appId === 'nexus-ai' });
  const name = appLabel(appId, appName);
  if (!result) return { ok: false, reply: `${name} is OS mein registered nahi hai.` };
  if (result.created) return { ok: true, reply: `${name} khol diya.` };
  if (result.switchedWorkspace) return { ok: true, reply: `${name} dusre workspace mein khula tha — wahan le gaya.` };
  return { ok: true, reply: `${name} pehle se khula tha — front pe le aaya.` };
}

function runFocusApp(appId: string, appName: string): NexusCommandResult {
  const name = appLabel(appId, appName);
  const focused = focusAppWindow(appId);
  if (focused) {
    return {
      ok: true,
      reply: focused.switchedWorkspace ? `${name} front pe (workspace switch kiya).` : `${name} front pe.`,
    };
  }
  const opened = runOpenApp(appId, appName, false);
  return opened.ok ? { ...opened, reply: `${name} khula nahi tha — khol diya.` } : opened;
}

function runCloseApp(appId: string, appName: string): NexusCommandResult {
  const name = appLabel(appId, appName);
  const all = findAppWindows(appId);
  if (all.length === 0) return { ok: false, reply: `${name} khula hi nahi hai.` };
  const activeWs = useWorkspaceStore.getState().activeWorkspaceId;
  const here = all.filter((w) => w.workspaceId === activeWs);
  const targets = here.length > 0 ? here : all;
  const windowStore = useWindowStore.getState();
  targets.forEach((w) => windowStore.closeWindow(w.id));
  return { ok: true, reply: targets.length > 1 ? `${name} ki ${targets.length} windows band.` : `${name} band.` };
}

function runCloseAll(): NexusCommandResult {
  const activeWs = useWorkspaceStore.getState().activeWorkspaceId;
  const targets = useWindowStore.getState().windows.filter((w) => w.workspaceId === activeWs);
  if (targets.length === 0) return { ok: true, reply: 'Is workspace mein koi window khuli nahi hai.' };
  const windowStore = useWindowStore.getState();
  targets.forEach((w) => windowStore.closeWindow(w.id));
  return { ok: true, reply: `${titleCase(activeWs)} workspace ki ${plural(targets.length, 'window')} band. Fresh start.` };
}

function runSwitchWorkspace(workspaceId: NexusWorkspaceId): NexusCommandResult {
  const ws = useWorkspaceStore.getState();
  if (ws.activeWorkspaceId === workspaceId) {
    return { ok: true, reply: `Already ${titleCase(workspaceId)} workspace mein hai.` };
  }
  ws.switchWorkspace(workspaceId);
  return { ok: true, reply: `${titleCase(workspaceId)} workspace pe aa gaye.` };
}

function runSearchNotes(query: string): NexusCommandResult {
  const opened = openOrFocusApp('notes');
  if (!opened) return { ok: false, reply: 'Notes app registered nahi hai.' };
  const q = query.trim().slice(0, 100);
  // Notes consumes this on mount (pending key) or live if already open.
  emitWarriorEvent(WARRIOR_EVENTS.notesSearch, { query: q });
  if (!q) return { ok: true, reply: 'Notes search khol diya — kya dhundhna hai?' };
  const matches = findMatchingNotes(q);
  if (matches.length === 0) {
    return {
      ok: true,
      reply: `Notes mein "${q}" ka koi match nahi. Naya note bana de — likha hua concept yaad rehta hai.`,
      followUps: [{ kind: 'ask', label: `Explain ${q.length > 18 ? `${q.slice(0, 17)}…` : q}`, prompt: `Explain ${q} for GATE — short and sharp.` }],
    };
  }
  const titles = matches
    .slice(0, 3)
    .map((n) => `**${n.title}**`)
    .join(', ');
  return {
    ok: true,
    reply: `Notes mein "${q}" search kiya — ${plural(matches.length, 'match', 'matches')}: ${titles}${matches.length > 3 ? ', …' : ''}.`,
  };
}

function runStartQuiz(mode: NexusGateMode, subject?: string): NexusCommandResult {
  const opened = openOrFocusApp('gate-prep');
  if (!opened) return { ok: false, reply: 'GATE Prep app registered nahi hai.' };
  const detail: WarriorGateStartQuizDetail = subject ? { mode, subject } : { mode };
  emitWarriorEvent(WARRIOR_EVENTS.gateStartQuiz, detail);

  const pomodoroIdle = useNexusStore.getState().pomodoro.phase === 'idle';
  const followUps: NexusActionButton[] = [];
  if (mode === 'quiz' && pomodoroIdle) followUps.push(button({ type: 'start_pomodoro' }));
  if (mode === 'quiz' && subject) followUps.push(button({ type: 'start_quiz', mode: 'flashcards', subject }));

  switch (mode) {
    case 'mock':
      return {
        ok: true,
        reply: `Mock test${subject ? ` (${subject})` : ''} ready. Full exam conditions — timer on, koi googling nahi.`,
        followUps,
      };
    case 'flashcards':
      return { ok: true, reply: `${subject ?? 'Formula'} flashcards khol diye. Ek ek karke revise kar.`, followUps };
    case 'planner':
      return { ok: true, reply: 'GATE study planner khol diya. Aaj ka target set kar.', followUps };
    case 'quiz':
      return {
        ok: true,
        reply: subject
          ? `GATE Arena: ${subject} quiz ready. Focus, no googling.`
          : 'GATE Arena khol diya — subject chun aur quiz shuru kar.',
        followUps,
      };
  }
}

function runStartPomodoro(focusMinutes?: number, breakMinutes?: number): NexusCommandResult {
  const store = useNexusStore.getState();
  const p = store.pomodoro;
  const controls = [button({ type: 'pause_pomodoro' }), button({ type: 'stop_pomodoro' })];
  if (p.phase === 'focus' && focusMinutes === undefined) {
    if (p.pausedRemainingMs !== null) {
      store.resumePomodoro();
      return { ok: true, reply: `Paused pomodoro resume — ${formatClock(p.pausedRemainingMs)} baaki.`, followUps: controls };
    }
    const left = pomodoroRemainingMs(p, Date.now());
    return { ok: true, reply: `Pomodoro already chal raha hai — ${formatClock(left)} baaki. Focus.`, followUps: controls };
  }
  store.startPomodoro(focusMinutes, breakMinutes);
  const next = useNexusStore.getState().pomodoro;
  return {
    ok: true,
    reply: `${next.focusMinutes} min focus pomodoro shuru (${next.breakMinutes} min break baad mein). Phone door rakh.`,
    followUps: controls,
  };
}

function runPausePomodoro(): NexusCommandResult {
  const store = useNexusStore.getState();
  const p = store.pomodoro;
  if (p.phase === 'idle') return { ok: false, reply: 'Koi pomodoro chal nahi raha.' };
  if (p.pausedRemainingMs !== null) return { ok: true, reply: 'Pomodoro already paused hai.' };
  store.pausePomodoro();
  const left = useNexusStore.getState().pomodoro.pausedRemainingMs ?? 0;
  return {
    ok: true,
    reply: `Pomodoro paused — ${formatClock(left)} baaki. Jaldi wapas aa.`,
    followUps: [button({ type: 'resume_pomodoro' })],
  };
}

function runResumePomodoro(): NexusCommandResult {
  const store = useNexusStore.getState();
  const p = store.pomodoro;
  if (p.phase === 'idle') return { ok: false, reply: 'Koi pomodoro paused nahi hai. "start pomodoro" bol.' };
  if (p.pausedRemainingMs === null) return { ok: true, reply: 'Pomodoro chal hi raha hai.' };
  const left = p.pausedRemainingMs;
  store.resumePomodoro();
  return { ok: true, reply: `Pomodoro resume — ${formatClock(left)} baaki.` };
}

function runStopPomodoro(): NexusCommandResult {
  const store = useNexusStore.getState();
  if (store.pomodoro.phase === 'idle') return { ok: false, reply: 'Koi pomodoro chal nahi raha.' };
  store.stopPomodoro();
  return { ok: true, reply: 'Pomodoro stop.' };
}

function runStudyMode(): NexusCommandResult {
  const workspaceStore = useWorkspaceStore.getState();
  const switched = workspaceStore.activeWorkspaceId !== 'study';
  if (switched) workspaceStore.switchWorkspace('study');

  // Distractions off: minimise everything else in the study workspace.
  const keep = new Set(['gate-prep', 'notes', 'nexus-ai']);
  const windowStore = useWindowStore.getState();
  const distractions = windowStore.windows.filter(
    (w) => w.workspaceId === 'study' && !w.isMinimized && !keep.has(w.appId)
  );
  distractions.forEach((w) => windowStore.minimizeWindow(w.id));

  // GATE Arena left, Notes right.
  const gate = openOrFocusApp('gate-prep');
  const notes = openOrFocusApp('notes');
  if (gate) snapWindow(gate.windowId, 'left');
  if (notes) snapWindow(notes.windowId, 'right');

  // Pomodoro.
  const store = useNexusStore.getState();
  const p = store.pomodoro;
  let pomodoroText: string;
  if (p.phase === 'focus' && p.pausedRemainingMs !== null) {
    store.resumePomodoro();
    pomodoroText = `paused pomodoro resume (${formatClock(p.pausedRemainingMs)} baaki)`;
  } else if (p.phase === 'focus') {
    pomodoroText = `pomodoro chal raha hai (${formatClock(pomodoroRemainingMs(p, Date.now()))} baaki)`;
  } else {
    store.startPomodoro();
    pomodoroText = `${useNexusStore.getState().pomodoro.focusMinutes} min pomodoro chalu`;
  }

  applyWallpaper(STUDY_WALLPAPER, switched);
  unlockNexusAchievement(NEXUS_ACHIEVEMENTS.smartMode);

  const layout = [
    gate ? `${appLabel('gate-prep', 'GATE Prep')} left` : null,
    notes ? `${appLabel('notes', 'Notes')} right` : null,
  ].filter((part): part is string => part !== null);
  const pieces = [
    ...layout,
    pomodoroText,
    `${wallpaperName(STUDY_WALLPAPER)} focus wallpaper`,
    ...(distractions.length > 0 ? [`${plural(distractions.length, 'distraction')} minimized`] : []),
  ];
  return {
    ok: true,
    reply: `Study mode on: ${pieces.join(', ')}. Padh le.`,
    followUps: [button({ type: 'stop_pomodoro' }), button({ type: 'chill_mode' })],
  };
}

function runChillMode(): NexusCommandResult {
  // Close every study app, in every workspace.
  const studyIds = new Set(
    useAppStore
      .getState()
      .registeredApps.filter((a) => a.category === 'study')
      .map((a) => a.id)
  );
  const windowStore = useWindowStore.getState();
  const toClose = windowStore.windows.filter((w) => studyIds.has(w.appId));
  toClose.forEach((w) => windowStore.closeWindow(w.id));

  const store = useNexusStore.getState();
  const stoppedPomodoro = store.pomodoro.phase !== 'idle';
  if (stoppedPomodoro) store.stopPomodoro();

  const workspaceStore = useWorkspaceStore.getState();
  const switched = workspaceStore.activeWorkspaceId !== 'chill';
  if (switched) workspaceStore.switchWorkspace('chill');

  const music = openOrFocusApp('music-player', { relocate: true });
  if (music) centerWindow(music.windowId, 1.15);

  applyWallpaper(CHILL_WALLPAPER, switched);
  unlockNexusAchievement(NEXUS_ACHIEVEMENTS.smartMode);

  const pieces = [
    ...(toClose.length > 0 ? [`${plural(toClose.length, 'study app')} band`] : []),
    ...(music ? [`${appLabel('music-player', 'Music')} center mein`] : []),
    `${wallpaperName(CHILL_WALLPAPER)} wallpaper`,
    ...(stoppedPomodoro ? ['pomodoro stop'] : []),
  ];
  return {
    ok: true,
    reply: `Chill mode: ${pieces.join(', ')}. Saans le, fir wapas.`,
    followUps: [button({ type: 'study_mode' })],
  };
}

function runChangeWallpaper(wallpaperId?: string): NexusCommandResult {
  const valid: string[] = WALLPAPER_OPTIONS.map((w) => w.id);
  const settings = useSettingsStore.getState();
  const target = wallpaperId ?? valid[(valid.indexOf(settings.wallpaper) + 1) % valid.length];
  if (!valid.includes(target)) {
    return { ok: false, reply: `"${target}" wallpaper nahi hai. Options: ${valid.join(', ')}.` };
  }
  settings.setWallpaper(target);
  const adaptiveNote = settings.adaptiveWallpaper
    ? ' (Adaptive wallpaper on hai — agle time-bracket pe auto badal sakta hai.)'
    : '';
  return { ok: true, reply: `Wallpaper → ${wallpaperName(target)}.${adaptiveNote}` };
}

function runShowStats(): NexusCommandResult {
  const opened = openOrFocusApp('warrior-profile');
  const xp = useXPStore.getState();
  const quiz = getQuizInsights();
  const streak = computeHabitStreak(loadHabitsLite(), Date.now());
  const toNext = xp.getXPForNextLevel();
  const parts = [
    `Lvl ${xp.level} (${xp.getLevelTitle()}), ${xp.xp} XP${toNext > 0 ? ` — ${toNext} XP to next level` : ''}`,
    `streak ${streak}d`,
    plural(quiz.totalAttempts, 'quiz attempt'),
  ];
  if (quiz.last) parts.push(`last ${quiz.last.subject} ${quiz.last.pct}%`);
  if (quiz.weakest) parts.push(`weakest ${quiz.weakest.subject} (${quiz.weakest.accuracy}%)`);
  const followUps = quiz.weakest
    ? [button({ type: 'start_quiz', mode: 'quiz', subject: quiz.weakest.subject }, `Fix ${quiz.weakest.subject}`)]
    : [button({ type: 'start_quiz', mode: 'quiz' })];
  return {
    ok: true,
    reply: `${parts.join(', ')}.${opened ? ` ${appLabel('warrior-profile', 'Profile')} khul gaya.` : ''}`,
    followUps,
  };
}

function runTakeBreak(): NexusCommandResult {
  const decay = useDecayStore.getState();
  if (!decay.enabled) {
    return {
      ok: false,
      reply: 'Reality Decay off hai, isliye break overlay nahi chalega. Khud 5 min uth, stretch kar, paani pee.',
    };
  }
  if (decay.isOnBreak) return { ok: true, reply: 'Break already chal raha hai.' };
  decay.triggerBreak();
  return { ok: true, reply: `${decay.breakDuration} min break shuru. 4-7-8 breathing follow kar — screen se nazar hata.` };
}

function runAddExpense(amount: number, category: ExpenseCategory, note: string): NexusCommandResult {
  const result = logExpense(amount, category, note);
  const vault = useAppStore
    .getState()
    .registeredApps.find((a) => a.id === 'expense-vault' || a.name.toLowerCase() === 'expense vault');
  return {
    ok: result.ok,
    reply: result.reply,
    followUps: vault ? [button({ type: 'open_app', appId: vault.id, appName: vault.name }, 'Open Expense Vault')] : [],
  };
}

function runCheckHabit(habit: string): NexusCommandResult {
  const result = checkHabitToday(habit);
  const forge = useAppStore.getState().getApp('study-planner');
  return {
    ok: result.ok,
    reply: result.reply,
    followUps: forge ? [button({ type: 'open_app', appId: forge.id, appName: forge.name }, `Open ${forge.name}`)] : [],
  };
}

/** Execute one command against the real OS stores. Never throws. */
export function executeNexusCommand(command: NexusCommand): NexusCommandResult {
  try {
    switch (command.type) {
      case 'open_app':
        return runOpenApp(command.appId, command.appName, command.newWindow === true);
      case 'focus_app':
        return runFocusApp(command.appId, command.appName);
      case 'close_app':
        return runCloseApp(command.appId, command.appName);
      case 'close_all':
        return runCloseAll();
      case 'switch_workspace':
        return runSwitchWorkspace(command.workspaceId);
      case 'search_notes':
        return runSearchNotes(command.query);
      case 'start_quiz':
        return runStartQuiz(command.mode, command.subject);
      case 'study_mode':
        return runStudyMode();
      case 'chill_mode':
        return runChillMode();
      case 'change_wallpaper':
        return runChangeWallpaper(command.wallpaperId);
      case 'start_pomodoro':
        return runStartPomodoro(command.focusMinutes, command.breakMinutes);
      case 'pause_pomodoro':
        return runPausePomodoro();
      case 'resume_pomodoro':
        return runResumePomodoro();
      case 'stop_pomodoro':
        return runStopPomodoro();
      case 'show_stats':
        return runShowStats();
      case 'take_break':
        return runTakeBreak();
      case 'clear_chat':
        useNexusStore.getState().clearConversation();
        return { ok: true, reply: 'Chat saaf.' };
      case 'new_chat':
        useNexusStore.getState().newConversation();
        return { ok: true, reply: 'Naya chat khol diya.' };
      case 'add_expense':
        return runAddExpense(command.amount, command.category, command.note);
      case 'check_habit':
        return runCheckHabit(command.habit);
      default:
        return { ok: false, reply: 'Ye command samajh nahi aaya.' };
    }
  } catch {
    return { ok: false, reply: 'Command chalate waqt kuch toot gaya. Dobara try kar.' };
  }
}

// ─── Pipeline ───

const HELP_ACTIONS: NexusActionButton[] = [
  button({ type: 'study_mode' }),
  button({ type: 'start_quiz', mode: 'quiz', subject: 'DBMS' }),
  button({ type: 'start_pomodoro' }),
];

function dedupeButtons(buttons: NexusActionButton[], exclude: Set<string> = new Set()): NexusActionButton[] {
  const seen = new Set(exclude);
  const out: NexusActionButton[] = [];
  for (const b of buttons) {
    const key = b.kind === 'ask' ? `ask:${b.prompt}` : commandKey(b.command);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out.slice(0, NEXUS_LIMITS.actions);
}

/** Chat history for the AI: recent user/NEXUS turns, failures excluded. */
function historyFor(conversationId: string): NexusChatTurn[] {
  const conv = useNexusStore.getState().conversations.find((c) => c.id === conversationId);
  if (!conv) return [];
  const turns: NexusChatTurn[] = [];
  for (const m of conv.messages) {
    if (m.role === 'user') turns.push({ role: 'user', content: m.content.slice(0, 2000) });
    else if (m.role === 'nexus' && m.source !== 'error' && m.source !== 'offline') {
      turns.push({ role: 'nexus', content: m.content.slice(0, 2000) });
    }
  }
  return turns.slice(-NEXUS_LIMITS.historyTurns);
}

/**
 * Resolve one user input to a reply: local intent first, Gemini second.
 * Runs OS side effects but does not touch the chat transcript.
 */
export async function processNexusInput(
  text: string,
  options: { history?: NexusChatTurn[] } = {}
): Promise<NexusTurnResult> {
  const message = text.trim().slice(0, NEXUS_LIMITS.messageChars);
  if (!message) return { reply: NEXUS_LINES.empty, source: 'local', actions: [] };

  const apps = useAppStore.getState().registeredApps;
  const intent = parseLocalIntent(
    message,
    apps,
    listHabits().map((h) => h.name)
  );

  if (intent.type === 'help') return { reply: NEXUS_HELP_TEXT, source: 'local', actions: HELP_ACTIONS, intent };
  if (intent.type === 'easter_egg') return { reply: intent.reply, source: 'local', actions: [], intent };
  if (intent.type === 'multi') {
    const results = intent.commands.map(executeNexusCommand);
    return {
      reply: results.map((r) => `- ${r.reply}`).join('\n'),
      source: 'local',
      actions: dedupeButtons(results.flatMap((r) => r.followUps ?? [])),
      intent,
    };
  }
  if (intent.type !== 'none') {
    const result = executeNexusCommand(intent);
    return { reply: result.reply, source: 'local', actions: dedupeButtons(result.followUps ?? []), intent };
  }

  // ── Fallback: Gemini ──
  const context = useNexusStore.getState().contextEnabled ? buildNexusContext({ detailed: true }) : undefined;
  const ai = await requestNexusAI({ message, history: options.history ?? [], context });
  if (!ai.ok) {
    return {
      reply: ai.reply,
      source: ai.offline ? 'offline' : 'error',
      actions: ai.offline ? [{ kind: 'ask', label: 'What can you do?', prompt: 'help' }] : [],
      intent,
    };
  }

  let reply = ai.reply;
  const pendingCommand: NexusActionButton[] = [];
  const executionFollowUps: NexusActionButton[] = [];
  const executedKeys = new Set<string>();
  if (ai.command) {
    const command = resolveWireCommand(ai.command, apps);
    if (command && AI_AUTO_EXECUTE.has(command.type)) {
      const result = executeNexusCommand(command);
      executedKeys.add(commandKey(command));
      reply = `${reply}\n\n> ${result.reply}`;
      executionFollowUps.push(...(result.followUps ?? []));
    } else if (command) {
      // Destructive or disruptive commands (close app, chill mode, forced break) need a click.
      pendingCommand.push(button(command, ai.command.label));
    }
  }
  const suggested = ai.actions
    .map((wire) => resolveWireButton(wire, apps))
    .filter((b): b is NexusActionButton => b !== null);
  return {
    reply,
    source: ai.offline ? 'offline' : 'ai',
    actions: dedupeButtons([...pendingCommand, ...suggested, ...executionFollowUps], executedKeys),
    intent,
  };
}

export interface SendToNexusOptions {
  via?: NexusInputChannel;
  /** Target conversation; defaults to the active one (created if needed). */
  conversationId?: string;
}

/**
 * Full chat turn: records the user message, processes it, records the
 * reply (with action buttons), unlocks achievements and speaks voice replies.
 */
export async function sendToNexus(text: string, options: SendToNexusOptions = {}): Promise<NexusTurnResult | null> {
  const message = text.trim().slice(0, NEXUS_LIMITS.messageChars);
  if (!message) return null;

  const store = useNexusStore.getState();
  const conversationId =
    options.conversationId && store.conversations.some((c) => c.id === options.conversationId)
      ? options.conversationId
      : store.ensureConversation();

  const history = historyFor(conversationId);
  const via = options.via ?? 'text';
  useNexusStore.getState().appendMessage(conversationId, { role: 'user', content: message, via });
  useNexusStore.getState().beginRequest(conversationId);

  let result: NexusTurnResult;
  try {
    result = await processNexusInput(message, { history });
  } catch {
    result = { reply: NEXUS_LINES.networkDown, source: 'error', actions: [] };
  } finally {
    useNexusStore.getState().endRequest(conversationId);
  }

  useNexusStore.getState().appendMessage(conversationId, {
    role: 'nexus',
    content: result.reply,
    source: result.source,
    actions: result.actions,
  });

  if (result.source !== 'error') {
    unlockNexusAchievement(NEXUS_ACHIEVEMENTS.firstChat);
  }
  if (via === 'voice') speakNexus(result.reply);
  return result;
}

/**
 * Run a message/nudge action button. Ask-buttons become a chat turn;
 * command buttons execute and (when a conversation is given) leave a
 * short system note in the transcript.
 */
export async function runNexusButton(
  action: NexusActionButton,
  conversationId?: string
): Promise<NexusCommandResult> {
  if (action.kind === 'ask') {
    const turn = await sendToNexus(action.prompt, { via: 'button', conversationId });
    return { ok: turn !== null && turn.source !== 'error', reply: turn?.reply ?? '' };
  }
  const result = executeNexusCommand(action.command);
  if (conversationId) {
    useNexusStore.getState().appendMessage(conversationId, {
      role: 'system',
      content: result.reply,
      source: result.ok ? 'local' : 'error',
      actions: result.followUps,
    });
  }
  return result;
}

/** Open (or bring here) the NEXUS AI window. */
export function openNexusWindow(): boolean {
  return openOrFocusApp('nexus-ai', { relocate: true }) !== null;
}

/**
 * Hook for components. `ask` keeps the original contract
 * (message + history → { reply, source, intent }) without touching the
 * transcript; `send` records a full chat turn.
 */
export function useNexusCore() {
  const registeredApps = useAppStore((s) => s.registeredApps);

  const ask = useCallback(async (message: string, history: NexusChatTurn[] = []) => {
    const turn = await processNexusInput(message, { history });
    return { reply: turn.reply, source: turn.source, intent: turn.intent };
  }, []);

  return {
    ask,
    send: sendToNexus,
    execute: executeNexusCommand,
    runButton: runNexusButton,
    registeredApps,
  };
}
