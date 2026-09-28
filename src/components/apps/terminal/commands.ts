// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Terminal Commands
// All available terminal commands mapped to handlers
// ═══════════════════════════════════════════════════════════

import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import { useQuizHistoryStore } from '@/stores/useQuizHistoryStore';
import { collectDueCards, computeDeckMastery, useLearningStore } from '@/stores/useLearningStore';
import { OWNER } from '@/config/owner';
import { getVisitorMode } from '@/lib/visitor';
import { sendPendingEvent } from '@/components/achievements/pending-events';
import { useAchievementProgressStore } from '@/components/achievements/progress-store';
import { utcDayKey } from '@/components/achievements/award';
import { currentStreak } from '@/components/achievements/day-streak';
import { collectStudyDays } from '@/components/achievements/study-streak';
import {
  TRAINING_START_EVENT,
  deckTargetLabel,
  type TrainingLinkMode,
  type TrainingStartDetail,
} from '@/components/apps/training-grounds/deep-link';
import { NOTES_SEARCH_EVENT, type NotesSearchDetail } from '@/components/apps/notes-archive/deep-link';
import { parseStoredHabits } from '@/components/apps/habit-forge/streak';

export interface CommandResult {
  output: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'ascii';
}

type CommandHandler = (args: string[]) => CommandResult;

const helpCommand: CommandHandler = () => ({
  type: 'info',
  output: `Available commands:
  help          — Show this help message
  whoami        — Display current user
  neofetch      — System info
  clear         — Clear terminal
  echo <text>   — Print text
  date          — Current date/time
  uptime        — System uptime
  ls            — List installed apps
  xp            — Show XP and level
  stats         — Today's study summary
  train [mode] [deck]
                — Open Training Grounds (modes: start, review, mock, planner)
                  e.g. train start warrior os basics · train review
  decks         — List your learning decks with mastery and cards due
  notes [query] — Open Notes, searching for <query>
  quote         — Random warrior quote
  version       — OS version
  about         — About Warrior OS
  history       — Command history
  matrix        — Matrix rain (easter egg)
  cowsay <text> — ASCII cow says your text
  hack          — Fake hacking sequence
  motivate      — Get motivated!
  warrior       — Warrior ASCII art
  ...and a few secrets nobody lists.`,
});

function activeWorkspaceId(): string {
  return useWorkspaceStore.getState().activeWorkspaceId;
}

const TRAIN_MODE_WORDS = new Map<string, TrainingLinkMode>([
  ['start', 'quiz'],
  ['quiz', 'quiz'],
  ['mock', 'mock'],
  ['test', 'mock'],
  ['flashcards', 'flashcards'],
  ['cards', 'flashcards'],
  ['review', 'flashcards'],
  ['planner', 'planner'],
  ['plan', 'planner'],
]);

const TRAIN_MODE_LABELS: Record<TrainingLinkMode, string> = {
  quiz: 'Quiz',
  mock: 'Mock Test',
  flashcards: 'Flashcards (review due cards)',
  planner: 'Quest Planner',
};

/** `train [mode] [deck or topic]` — opens Training Grounds through its start deep link. */
const trainCommand: CommandHandler = (args) => {
  const explicitMode = TRAIN_MODE_WORDS.get(args[0]?.toLowerCase() ?? '');
  const mode: TrainingLinkMode = explicitMode ?? 'quiz';
  const subjectText = (explicitMode ? args.slice(1) : args).join(' ').trim();
  const focus = subjectText ? deckTargetLabel(subjectText, useLearningStore.getState().decks) : null;
  if (subjectText && !focus) {
    return {
      type: 'error',
      output: `train: no deck or topic matches "${subjectText}". Run 'decks' for the list.`,
    };
  }
  // The app resolves the same text against the same decks.
  const detail: TrainingStartDetail = subjectText ? { subject: subjectText, mode } : { mode };
  useAppStore.getState().launchApp('training-grounds', activeWorkspaceId());
  sendPendingEvent(TRAINING_START_EVENT, detail);
  return {
    type: 'success',
    output: `Opening Training Grounds → ${TRAIN_MODE_LABELS[mode]}${focus ? ` · ${focus}` : ''}`,
  };
};

/** `decks` — the learning decks with card counts, mastery and cards due. */
const decksCommand: CommandHandler = () => {
  const { decks, reviews } = useLearningStore.getState();
  if (decks.length === 0) {
    return { type: 'info', output: 'No decks yet. Open Training Grounds to create one.' };
  }
  const now = Date.now();
  const rows = decks.map((deck, i) => {
    const mastery = computeDeckMastery(deck, reviews);
    const due = collectDueCards([deck], reviews, { now, includeNew: false }).length;
    const cards = `${mastery.total} card${mastery.total === 1 ? '' : 's'}`;
    return `  ${i + 1}. ${deck.name} — ${cards}, ${Math.round(mastery.value * 100)}% mastery${due > 0 ? `, ${due} due` : ''}`;
  });
  return {
    type: 'info',
    output: `Your decks:\n${rows.join('\n')}\n\n'train <deck>' starts a quiz · 'train review <deck>' reviews the cards due`,
  };
};

/** `notes [search] <query>` — opens Notes through the 'warrior:notes-search' deep link. */
const notesCommand: CommandHandler = (args) => {
  const words = args[0]?.toLowerCase() === 'search' ? args.slice(1) : args;
  const query = words.join(' ').trim();
  useAppStore.getState().launchApp('notes', activeWorkspaceId());
  if (!query) return { type: 'success', output: 'Opening Notes.' };
  const detail: NotesSearchDetail = { query };
  sendPendingEvent(NOTES_SEARCH_EVENT, detail);
  return { type: 'success', output: `Opening Notes → searching "${query}"` };
};

function readStoredJSON(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as unknown;
  } catch {
    return null;
  }
}

/** `stats` — today's numbers from the real stores (UTC day, like habits). */
const statsCommand: CommandHandler = () => {
  const today = utcDayKey();
  const { xp, level, achievements, getLevelTitle, getXPForNextLevel } = useXPStore.getState();

  const minutes = useAchievementProgressStore.getState().getStudyMinutes(today);
  const quizRows = useQuizHistoryStore
    .getState()
    .attempts.filter(
      (a) => Number.isFinite(a.timestamp) && utcDayKey(new Date(a.timestamp)) === today
    );
  const questions = quizRows.reduce((sum, a) => sum + a.totalQuestions, 0);
  const correct = quizRows.reduce((sum, a) => sum + a.correctAnswers, 0);

  const habits = parseStoredHabits(readStoredJSON('warrior-habits'));
  const habitsDone = habits.filter((h) => h.completions.includes(today)).length;
  const streak = currentStreak(collectStudyDays(), today);

  const unlocked = achievements.filter((a) => a.unlockedAt).length;
  const toNext = getXPForNextLevel();

  return {
    type: 'info',
    output: `TODAY — ${today} (UTC)
  Level         ${level} · ${getLevelTitle()} · ${xp} XP${toNext > 0 ? ` (${toNext} to next level)` : ''}
  Study time    ${Math.floor(minutes / 60)}h ${minutes % 60}m in study apps
  Questions     ${correct}/${questions} correct
  Habits        ${habitsDone}/${habits.length} done
  Study streak  ${streak} day${streak === 1 ? '' : 's'}
  Achievements  ${unlocked}/${achievements.length} unlocked`,
  };
};

const whoamiCommand: CommandHandler = () => {
  const mode = getVisitorMode();
  if (mode === 'guest') {
    return { type: 'info', output: `guest@warrior-os — visiting ${OWNER.shortName}'s OS. Make yourself at home.` };
  }
  const user = mode === 'owner' ? OWNER.handle || OWNER.shortName.toLowerCase() : 'warrior';
  return { type: 'info', output: `${user}@warrior-os` };
};

const neofetchCommand: CommandHandler = () => ({
  type: 'ascii',
  output: `
 ██╗    ██╗ █████╗ ██████╗ ██████╗ ██╗  ██████╗ ██████╗
 ██║    ██║██╔══██╗██╔══██╗██╔══██╗██║ ██╔═══██╗██╔══██╗
 ██║ █╗ ██║███████║██████╔╝██████╔╝██║ ██║   ██║██████╔╝
 ██║███╗██║██╔══██║██╔══██╗██╔══██╗██║ ██║   ██║██╔══██╗
 ╚███╔███╔╝██║  ██║██║  ██║██║  ██║██║ ╚██████╔╝██║  ██║
  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═════╝ ╚═╝  ╚═╝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OS:       Warrior OS v4.0
  Kernel:   The Living World
  Shell:    warrior-bash 1.0
  Owner:    ${OWNER.name}${OWNER.handle ? ` (@${OWNER.handle})` : ''}
  Stack:    Next.js 16 + React 19 + TypeScript
  UI:       Tailwind CSS 4 + Framer Motion
  State:    Zustand + Immer
  AI:       NEXUS (offline brain, Gemini optional)
  Storage:  Offline-first, this browser
  Host:     Browser${OWNER.repo ? `\n  Source:   ${OWNER.repo}` : ''}`,
});

const dateCommand: CommandHandler = () => ({
  type: 'info',
  output: new Date().toLocaleString(),
});

const uptimeCommand: CommandHandler = () => {
  const start = performance.timeOrigin;
  const elapsed = Math.floor((Date.now() - start) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return {
    type: 'info',
    output: `up ${h}h ${m}m ${s}s`,
  };
};

/** `ls` — the installed apps, as directories. */
const lsCommand: CommandHandler = () => {
  const dirs = useAppStore
    .getState()
    .registeredApps.map((app) => `${app.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}/`);
  const rows: string[] = [];
  for (let i = 0; i < dirs.length; i += 5) rows.push(dirs.slice(i, i + 5).join('  '));
  return { type: 'info', output: rows.join('\n') || '(no apps installed)' };
};

const echoCommand: CommandHandler = (args) => ({
  type: 'info',
  output: args.join(' ') || '',
});

const versionCommand: CommandHandler = () => ({
  type: 'success',
  output: 'Warrior OS v4.0.0 — The Living World',
});

const aboutCommand: CommandHandler = () => ({
  type: 'info',
  output: `Warrior OS v4.0 — The Living World
${OWNER.shortName}'s personal OS in the browser: a sci-fi command center,
a discipline machine and a creative playground.
Built by ${OWNER.name} with Next.js 16, React 19, and passion.
"Every warrior was once a beginner who refused to give up."
(Old gamers say the desktop still remembers a certain code. Try 'konami'.)`,
});

const QUOTES = [
  'The only way to do great work is to love what you do.',
  'Hard work beats talent when talent doesn\'t work hard.',
  'Success is not final, failure is not fatal: courage to continue counts.',
  'The pain you feel today will be the strength you feel tomorrow.',
  'Don\'t watch the clock; do what it does. Keep going.',
  'Discipline is choosing between what you want now and what you want most.',
  'A warrior is not about perfection. It is about effort.',
  'Knowledge compounds. One card a day beats a cram session a month.',
  'Every expert was once a beginner. Start now.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
];

const quoteCommand: CommandHandler = () => ({
  type: 'success',
  output: `"${QUOTES[Math.floor(Math.random() * QUOTES.length)]}"`,
});

export const COMMANDS: Record<string, CommandHandler> = {
  help: helpCommand,
  whoami: whoamiCommand,
  neofetch: neofetchCommand,
  date: dateCommand,
  uptime: uptimeCommand,
  ls: lsCommand,
  echo: echoCommand,
  decks: decksCommand,
  version: versionCommand,
  about: aboutCommand,
  quote: quoteCommand,
  stats: statsCommand,
  train: trainCommand,
  learn: trainCommand,
  notes: notesCommand,
  note: notesCommand,
};
