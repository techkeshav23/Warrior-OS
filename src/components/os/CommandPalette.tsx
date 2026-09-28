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

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Search,
  Sparkles,
  WandSparkles,
  FileText,
  CircleCheck,
  IndianRupee,
  GraduationCap,
  Layers,
  CornerDownLeft,
  Zap,
  Headphones,
  CircleQuestionMark,
  ClipboardCheck,
  Map as MapIcon,
  Timer,
  TimerOff,
  FileSearch,
  ChartColumn,
  Coffee,
  SquarePen,
  BrainCircuit,
  FileChartColumn,
  SearchX,
  type LucideIcon,
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
import { AppIcon } from '@/components/ui/AppIcon';
import { Kbd } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
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
  /** App rows: the app id (drawn as its AppIcon). */
  appId?: string;
  /** App rows: the registry shortcut ("ctrl+shift+m"), shown as a key hint. */
  shortcut?: string;
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

// ─── Visual layer helpers ───

const EASE = [0.16, 1, 0.3, 1] as const;

/** Group heading for a row (rows stay in `filtered` order; a heading shows when the group changes). */
function groupOf(cmd: CommandItem): string {
  if (cmd.kind === 'nexus') return 'Suggested';
  if (cmd.kind === 'ask') return 'Ask NEXUS';
  if (cmd.category === 'Quick Action') return 'Quick actions';
  return cmd.category;
}

/** Glyph per quick action id (falls back to the row kind). */
const ACTION_ICON: Record<string, LucideIcon> = {
  'action-study-mode': GraduationCap,
  'action-chill-mode': Headphones,
  'action-quiz': CircleQuestionMark,
  'action-mock': ClipboardCheck,
  'action-planner': MapIcon,
  'action-pomodoro': Timer,
  'action-pomodoro-stop': TimerOff,
  'action-notes-search': FileSearch,
  'action-stats': ChartColumn,
  'action-break': Coffee,
  'action-new-note': SquarePen,
  'action-expense': IndianRupee,
  'action-nexus': BrainCircuit,
  'training-decks': FileChartColumn,
};

const KIND_ICON: Record<CommandKind, { icon: LucideIcon; tint: string }> = {
  app: { icon: Zap, tint: 'text-fg-muted' },
  action: { icon: Zap, tint: 'text-fg-muted' },
  deck: { icon: GraduationCap, tint: 'text-viz-3' },
  review: { icon: Layers, tint: 'text-gold' },
  nexus: { icon: WandSparkles, tint: 'text-accent' },
  note: { icon: FileText, tint: 'text-fg-muted' },
  habit: { icon: CircleCheck, tint: 'text-success' },
  ask: { icon: Sparkles, tint: 'text-accent' },
};

function RowIcon({ cmd }: { cmd: CommandItem }) {
  if (cmd.appId) return <AppIcon appId={cmd.appId} size={28} />;
  const kind = KIND_ICON[cmd.kind];
  const Icon = ACTION_ICON[cmd.id] ?? kind.icon;
  const nexus = cmd.kind === 'nexus' || cmd.kind === 'ask';
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-control border inset-shadow-[0_1px_0_rgb(255_255_255/0.06)]',
        nexus ? 'border-accent/30 bg-accent/10' : 'border-line-strong bg-linear-to-b from-ink-750 to-ink-850',
        kind.tint
      )}
    >
      <Icon size={16} strokeWidth={1.75} />
    </span>
  );
}

/** "ctrl+shift+m" → ["Ctrl", "Shift", "M"] (⌘ on a Mac). */
function shortcutKeys(shortcut: string, isMac: boolean): string[] {
  return shortcut.split('+').map((part) => {
    const p = part.trim().toLowerCase();
    if (p === 'ctrl') return isMac ? '⌘' : 'Ctrl';
    if (p === 'shift') return isMac ? '⇧' : 'Shift';
    if (p === 'alt') return isMac ? '⌥' : 'Alt';
    return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
  });
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notes, setNotes] = useState<NoteLite[]>([]);
  const [habits, setHabits] = useState<HabitRef[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [isMac] = useState(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
  );

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
      appId: app.id,
      shortcut: app.shortcut,
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

    // (Listed with the quick actions above so the group reads as one.)
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
          className="fixed inset-0 flex items-start justify-center pt-[14vh]"
          style={{ zIndex: 'var(--z-command-palette)' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-[3px]"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            data-tour="command-bar"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985, transition: { duration: 0.14, ease: EASE } }}
            transition={{ duration: 0.2, ease: EASE }}
            className="glass-popover relative mx-4 flex w-full max-w-[640px] flex-col overflow-hidden rounded-sheet shadow-e3"
          >
            {/* Signature hairline */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-12 top-0 h-px bg-linear-to-r from-transparent via-accent/50 to-transparent"
            />

            {/* Search Input */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5 transition-colors duration-180 focus-within:border-accent/30">
              <Search size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-fg-subtle" />
              <input
                ref={inputRef}
                id={PALETTE_INPUT_ID}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search apps, or tell NEXUS: "study mode", "quiz me on <deck>"…'
                aria-label="Command palette"
                autoComplete="off"
                spellCheck={false}
                className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle"
              />
              <Kbd>Esc</Kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="scrollbar-thin max-h-[min(420px,52vh)] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No results"
                  description="Try an app name, or type a request for NEXUS."
                />
              ) : (
                filtered.map((cmd, i) => {
                  const group = groupOf(cmd);
                  const showHeading = i === 0 || groupOf(filtered[i - 1]) !== group;
                  const selected = i === selectedIndex;
                  return (
                    <Fragment key={cmd.id}>
                      {showHeading && (
                        <div className={cn('hud-label px-5 pb-1.5', i === 0 ? 'pt-1.5' : 'pt-3')}>{group}</div>
                      )}
                      <button
                        type="button"
                        data-index={i}
                        onClick={cmd.action}
                        onMouseMove={() => {
                          if (!selected) setSelectedIndex(i);
                        }}
                        className={cn(
                          'relative mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-control px-2.5 text-left',
                          'transition-colors duration-75 focus-ring-inset',
                          selected ? 'bg-accent-soft text-fg' : 'text-fg-muted'
                        )}
                      >
                        {selected && (
                          <span aria-hidden className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-accent" />
                        )}
                        <RowIcon cmd={cmd} />
                        <span className="min-w-0 flex-1 truncate text-ui">{cmd.label}</span>
                        {cmd.shortcut && (
                          <Kbd size="sm" keys={shortcutKeys(cmd.shortcut, isMac)} className="shrink-0 opacity-80" />
                        )}
                        <CornerDownLeft
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden
                          className={cn('shrink-0 text-accent transition-opacity duration-120', selected ? 'opacity-100' : 'opacity-0')}
                        />
                      </button>
                    </Fragment>
                  );
                })
              )}
            </div>

            {/* Footer: key hints */}
            <div className="flex h-10 shrink-0 items-center gap-4 border-t border-line bg-ink-950/30 px-5 text-xs text-fg-subtle">
              <span className="flex items-center gap-1.5">
                <Kbd size="sm">↑</Kbd>
                <Kbd size="sm">↓</Kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd size="sm">↵</Kbd>
                Run
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd size="sm">Esc</Kbd>
                Close
              </span>
              <span className="ml-auto flex items-center gap-1.5 truncate">
                <Sparkles size={14} strokeWidth={1.75} aria-hidden className="shrink-0 text-accent" />
                <span className="truncate">NEXUS understands English + Hinglish</span>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
