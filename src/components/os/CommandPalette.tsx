// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CommandPalette Component
// Spotlight/Ctrl+K command palette. Apps, quick actions and deck
// actions (quiz a deck, review the cards due) first; anything else is
// routed through NEXUS intent parsing (natural language → OS actions,
// e.g. "study mode", "quiz me on javascript", "review due cards",
// "notes on closures", "close terminal", "pomodoro 50"), with "Ask
// NEXUS" as the final fallback. Matching notes are listed too.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ArrowRight,
  Sparkles,
  WandSparkles,
  FileText,
  CircleCheck,
  IndianRupee,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { collectDueCards, useLearningStore } from '@/stores/useLearningStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { commandKey, describeIntent, isCommandIntent, parseLocalIntent, type LocalIntent } from '@/lib/nexus-intent';
import {
  executeNexusCommand,
  NEXUS_ACHIEVEMENTS,
  openNexusWindow,
  sendToNexus,
  unlockNexusAchievement,
  type NexusCommandResult,
} from '@/components/nexus/NexusCore';
import { findMatchingNotes, loadNotesLite, type NoteLite } from '@/lib/nexus/context';
import { emitWarriorEvent, WARRIOR_EVENTS } from '@/lib/nexus/events';
import { openOrFocusApp } from '@/lib/nexus/windows';
import { listHabits, type HabitRef } from '@/lib/nexus/quick-actions';
import { cn } from '@/lib/utils';
import type { NexusCommand } from '@/types/nexus';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type CommandKind = 'app' | 'action' | 'deck' | 'review' | 'nexus' | 'note' | 'habit' | 'ask';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  kind: CommandKind;
  action: () => void;
  /** The NEXUS command the row runs (lets a typed intent skip a duplicate row). */
  command?: NexusCommand;
}

/** Show the outcome of palette-run NEXUS commands as a toast. */
function toastResults(results: NexusCommandResult[]): void {
  if (results.length === 0) return;
  useNotificationStore.getState().addNotification({
    type: results.every((r) => r.ok) ? 'info' : 'warning',
    title: 'NEXUS',
    message: results
      .map((r) => r.reply)
      .join(' ')
      .slice(0, 300),
    icon: '🧠',
  });
}

const PALETTE_INPUT_ID = 'warrior-command-palette-input';

/** Re-focus the search box after a mouse click on a row. */
function focusPaletteInput(): void {
  if (typeof document === 'undefined') return;
  document.getElementById(PALETTE_INPUT_ID)?.focus();
}

const QUICK_ACTIONS: Array<{ id: string; label: string; command: NexusCommand }> = [
  { id: 'study-mode', label: 'Study Mode (Training Grounds + Notes, pomodoro)', command: { type: 'study_mode' } },
  { id: 'chill-mode', label: 'Chill Mode (music, aurora)', command: { type: 'chill_mode' } },
  { id: 'quiz', label: 'Quick Quiz (any deck)', command: { type: 'start_quiz', mode: 'quiz' } },
  { id: 'mock', label: 'Start Mock Test', command: { type: 'start_quiz', mode: 'mock' } },
  { id: 'planner', label: 'Quest Planner', command: { type: 'start_quiz', mode: 'planner' } },
  { id: 'pomodoro', label: 'Start Pomodoro (25 min)', command: { type: 'start_pomodoro' } },
  { id: 'pomodoro-stop', label: 'Stop Pomodoro', command: { type: 'stop_pomodoro' } },
  { id: 'notes-search', label: 'Search Notes', command: { type: 'search_notes', query: '' } },
  { id: 'stats', label: 'View Stats & XP', command: { type: 'show_stats' } },
  { id: 'break', label: 'Take a Break (breathing)', command: { type: 'take_break' } },
];

/** Deck rows listed in the palette (decks with the most cards due first). */
const MAX_DECK_ROWS = 8;

/** Commands whose multi-line reply reads better in the NEXUS chat than in a toast. */
function opensInChat(intent: LocalIntent): boolean {
  return intent.type === 'help' || intent.type === 'easter_egg' || intent.type === 'show_decks';
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notes, setNotes] = useState<NoteLite[]>([]);
  const [habits, setHabits] = useState<HabitRef[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  // Due dates are compared against the moment the palette opened.
  const [openedAt, setOpenedAt] = useState(() => Date.now());

  // Deck + topic names, so "review <deck>" is understood.
  const deckNames = useMemo(() => decks.flatMap((d) => [d.name, ...d.topics.map((t) => t.name)]), [decks]);

  // Decks with cards, most due first; the total drives the "Review Due Cards" row.
  const deckRows = useMemo(() => {
    const due = collectDueCards(decks, reviews, { now: openedAt, includeNew: false });
    const dueByDeck = new Map<string, number>();
    for (const card of due) dueByDeck.set(card.deckId, (dueByDeck.get(card.deckId) ?? 0) + 1);
    const rows = decks
      .filter((d) => d.topics.some((t) => t.cards.length > 0))
      .map((d) => ({ id: d.id, name: d.name, due: dueByDeck.get(d.id) ?? 0 }))
      .sort((a, b) => b.due - a.due)
      .slice(0, MAX_DECK_ROWS);
    return { totalDue: due.length, rows };
  }, [decks, reviews, openedAt]);

  // Build the static command list (apps + quick actions + deck actions).
  const commands = useMemo<CommandItem[]>(() => {
    const markUsed = () => unlockNexusAchievement(NEXUS_ACHIEVEMENTS.commandPalette);
    const runCommand = (command: NexusCommand) => () => {
      markUsed();
      toastResults([executeNexusCommand(command)]);
      onClose();
    };
    const cmds: CommandItem[] = registeredApps.map((app): CommandItem => ({
      id: `launch-${app.id}`,
      label: `Open ${app.name}`,
      category: 'Applications',
      kind: 'app',
      action: () => {
        markUsed();
        launchApp(app.id, activeWorkspaceId);
        onClose();
      },
    }));

    QUICK_ACTIONS.forEach((qa) => {
      cmds.push({
        id: `action-${qa.id}`,
        label: qa.label,
        category: 'Quick Action',
        kind: 'action',
        command: qa.command,
        action: runCommand(qa.command),
      });
    });

    // Training: review what is due, quiz (or review) one deck.
    const reviewAll: NexusCommand = { type: 'start_quiz', mode: 'flashcards' };
    cmds.push({
      id: 'training-review-due',
      label: deckRows.totalDue > 0 ? `Review Due Cards (${deckRows.totalDue} due)` : 'Review Flashcards',
      category: 'Training',
      kind: 'review',
      command: reviewAll,
      action: runCommand(reviewAll),
    });
    deckRows.rows.forEach((deck) => {
      const quizDeck: NexusCommand = { type: 'start_quiz', mode: 'quiz', subject: deck.name };
      cmds.push({
        id: `training-quiz-${deck.id}`,
        label: `Quiz: ${deck.name}`,
        category: 'Training',
        kind: 'deck',
        command: quizDeck,
        action: runCommand(quizDeck),
      });
      if (deck.due > 0) {
        const reviewDeck: NexusCommand = { type: 'start_quiz', mode: 'flashcards', subject: deck.name };
        cmds.push({
          id: `training-review-${deck.id}`,
          label: `Review: ${deck.name} (${deck.due} due)`,
          category: 'Training',
          kind: 'review',
          command: reviewDeck,
          action: runCommand(reviewDeck),
        });
      }
    });
    cmds.push({
      id: 'training-decks',
      label: 'Deck Report (mastery, cards due)',
      category: 'Training',
      kind: 'deck',
      command: { type: 'show_decks' },
      action: () => {
        markUsed();
        openNexusWindow();
        void sendToNexus('my decks', { via: 'palette' });
        onClose();
      },
    });

    cmds.push({
      id: 'action-new-note',
      label: 'New Note',
      category: 'Quick Action',
      kind: 'action',
      action: () => {
        markUsed();
        launchApp('notes', activeWorkspaceId);
        onClose();
      },
    });
    cmds.push({
      id: 'action-expense',
      label: 'Log Expense (type: add expense 120 chai)',
      category: 'Quick Action',
      kind: 'action',
      action: () => {
        markUsed();
        setQuery('add expense ');
        focusPaletteInput();
      },
    });
    cmds.push({
      id: 'action-nexus',
      label: 'Ask NEXUS (open chat)',
      category: 'NEXUS',
      kind: 'action',
      action: () => {
        markUsed();
        openNexusWindow();
        onClose();
      },
    });

    return cmds;
  }, [registeredApps, launchApp, activeWorkspaceId, deckRows, onClose]);

  // Filter + NEXUS intent + note matches + Ask fallback.
  const filtered = useMemo<CommandItem[]>(() => {
    const q = query.trim();
    if (!q) return commands;
    const lower = q.toLowerCase();
    const markUsed = () => unlockNexusAchievement(NEXUS_ACHIEVEMENTS.commandPalette);

    const matches = commands.filter(
      (c) => c.label.toLowerCase().includes(lower) || c.category.toLowerCase().includes(lower)
    );

    const askItem: CommandItem = {
      id: 'nexus-ask',
      label: `Ask NEXUS: ${q.length > 60 ? `${q.slice(0, 60)}…` : q}`,
      category: 'NEXUS',
      kind: 'ask',
      action: () => {
        markUsed();
        openNexusWindow();
        void sendToNexus(q, { via: 'palette' });
        onClose();
      },
    };

    // Natural language → NEXUS intent (skip when a listed row already runs the same thing).
    const intent: LocalIntent = parseLocalIntent(
      q,
      registeredApps,
      habits.map((h) => h.name),
      deckNames
    );
    const singleKey = isCommandIntent(intent) ? commandKey(intent) : null;
    const redundant =
      (intent.type === 'open_app' && !intent.newWindow && matches.some((m) => m.id === `launch-${intent.appId}`)) ||
      (singleKey !== null && matches.some((m) => m.command !== undefined && commandKey(m.command) === singleKey));
    let intentItem: CommandItem | null = null;
    if (intent.type !== 'none' && !redundant) {
      const showInChat = opensInChat(intent);
      const askLabel = intent.type === 'help' || intent.type === 'easter_egg';
      intentItem = {
        id: 'nexus-intent',
        label: `NEXUS: ${askLabel ? `ask "${q}"` : describeIntent(intent)}`,
        category: 'NEXUS',
        kind: 'nexus',
        action: () => {
          markUsed();
          if (showInChat) {
            openNexusWindow();
            void sendToNexus(q, { via: 'palette' });
          } else if (intent.type === 'multi') {
            toastResults(intent.commands.map(executeNexusCommand));
          } else if (isCommandIntent(intent)) {
            toastResults([executeNexusCommand(intent)]);
          }
          onClose();
        },
      };
    }

    const noteItems: CommandItem[] =
      q.length >= 2
        ? findMatchingNotes(q, notes)
            .slice(0, 3)
            .map((note): CommandItem => ({
              id: `note-${note.id || note.title}`,
              label: `Note: ${note.title}`,
              category: 'Notes',
              kind: 'note',
              action: () => {
                markUsed();
                openOrFocusApp('notes');
                emitWarriorEvent(WARRIOR_EVENTS.notesSearch, { query: note.title });
                onClose();
              },
            }))
        : [];

    // Habits due today whose name matches ("read", "gym", "habit" lists all).
    const listAllHabits = /^(?:habits?|check\s+habits?)$/.test(lower);
    const habitQuery = lower.replace(/^(?:check|tick|mark)\s+(?:habit\s+)?/, '').trim();
    const habitItems: CommandItem[] =
      q.length >= 2
        ? habits
            .filter((h) => !h.doneToday && (listAllHabits || (habitQuery.length >= 2 && h.name.toLowerCase().includes(habitQuery))))
            .filter((h) => !(intent.type === 'check_habit' && h.name.toLowerCase().includes(intent.habit)))
            .slice(0, 4)
            .map((h): CommandItem => ({
              id: `habit-${h.id}`,
              label: `Check habit: ${h.icon ? `${h.icon} ` : ''}${h.name}`,
              category: 'Habits',
              kind: 'habit',
              action: () => {
                markUsed();
                toastResults([executeNexusCommand({ type: 'check_habit', habit: h.name })]);
                onClose();
              },
            }))
        : [];

    const items: CommandItem[] = [];
    if (intentItem) items.push(intentItem);
    items.push(...matches);
    items.push(...habitItems);
    // Nothing matched: asking NEXUS becomes the default (first) choice.
    if (!intentItem && matches.length === 0 && habitItems.length === 0) items.push(askItem);
    items.push(...noteItems);
    if (intentItem || matches.length > 0 || habitItems.length > 0) items.push(askItem);
    return items;
  }, [commands, query, registeredApps, notes, habits, deckNames, onClose]);

  // Reset selectedIndex when the filter query changes — using the "store info from
  // previous render" pattern instead of setState-in-effect to avoid an extra render.
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  // Reset query when the palette opens (snapshot pattern for the same reason)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) setQuery('');
  }

  // On open: focus the input and refresh notes, habits and due dates (async, not in render).
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
      setNotes(loadNotesLite());
      setHabits(listHabits());
      setOpenedAt(Date.now());
    }, 50);
    return () => clearTimeout(id);
  }, [isOpen]);

  // Keep the highlighted row visible while arrowing through results.
  useEffect(() => {
    if (!isOpen) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          if (e.isComposing) return;
          e.preventDefault();
          filtered[selectedIndex]?.action();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, filtered, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 flex items-start justify-center pt-[15vh]"
          style={{ zIndex: 'var(--z-command-palette)' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            data-tour="command-bar"
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg rounded-[var(--radius-lg)] overflow-hidden mx-4"
            style={{
              background: 'rgba(12, 12, 20, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 16px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,240,255,0.03)',
            }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
              <input
                ref={inputRef}
                id={PALETTE_INPUT_ID}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search apps, or tell NEXUS: "study mode", "review due cards", "quiz me on <deck>"…'
                aria-label="Command palette"
                className="flex-1 bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted outline-none"
              />
              <kbd className="text-[9px] font-mono text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-center text-xs font-mono text-text-muted py-8">
                  No results found
                </p>
              ) : (
                filtered.map((cmd, i) => {
                  const nexusRow = cmd.kind === 'nexus' || cmd.kind === 'ask';
                  return (
                    <button
                      key={cmd.id}
                      data-index={i}
                      onClick={cmd.action}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left',
                        'transition-colors duration-75',
                        i === selectedIndex
                          ? nexusRow
                            ? 'bg-cyan-500/10 text-cyan-300'
                            : 'bg-accent-primary/10 text-accent-primary'
                          : 'text-text-secondary hover:bg-white/5'
                      )}
                    >
                      {cmd.kind === 'ask' ? (
                        <Sparkles className="w-3 h-3 flex-shrink-0 opacity-80 text-cyan-400" />
                      ) : cmd.kind === 'nexus' ? (
                        <WandSparkles className="w-3 h-3 flex-shrink-0 opacity-90 text-cyan-300" />
                      ) : cmd.kind === 'note' ? (
                        <FileText className="w-3 h-3 flex-shrink-0 opacity-70" />
                      ) : cmd.kind === 'habit' ? (
                        <CircleCheck className="w-3 h-3 flex-shrink-0 opacity-80 text-emerald-300" />
                      ) : cmd.kind === 'deck' ? (
                        <GraduationCap className="w-3 h-3 flex-shrink-0 opacity-80 text-violet-300" />
                      ) : cmd.kind === 'review' ? (
                        <Layers className="w-3 h-3 flex-shrink-0 opacity-80 text-amber-300" />
                      ) : cmd.id === 'action-expense' ? (
                        <IndianRupee className="w-3 h-3 flex-shrink-0 opacity-70" />
                      ) : (
                        <ArrowRight className="w-3 h-3 flex-shrink-0 opacity-50" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono truncate">{cmd.label}</p>
                      </div>
                      <span className="text-[9px] font-mono text-text-muted">
                        {cmd.category}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/5 px-4 py-1.5 text-[9px] font-mono text-text-muted">
              <span>↑↓ navigate · Enter run · Esc close</span>
              <span className="text-cyan-300/60">NEXUS understands English + Hinglish</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
