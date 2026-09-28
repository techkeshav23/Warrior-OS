// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CommandPalette Component
// Spotlight/Ctrl+K command palette. Apps and quick actions first;
// anything else is routed through NEXUS intent parsing (natural
// language → OS actions, e.g. "study mode", "DBMS quiz", "notes on
// paging", "close terminal", "pomodoro 50"), with "Ask NEXUS" as
// the final fallback. Matching notes are listed too.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, Sparkles, WandSparkles, FileText } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { commandKey, describeIntent, parseLocalIntent, type LocalIntent } from '@/lib/nexus-intent';
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
import { cn } from '@/lib/utils';
import type { NexusCommand } from '@/types/nexus';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type CommandKind = 'app' | 'action' | 'nexus' | 'note' | 'ask';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  kind: CommandKind;
  action: () => void;
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

const QUICK_ACTIONS: Array<{ id: string; label: string; command: NexusCommand }> = [
  { id: 'study-mode', label: 'Study Mode (GATE + Notes, pomodoro)', command: { type: 'study_mode' } },
  { id: 'chill-mode', label: 'Chill Mode (music, aurora)', command: { type: 'chill_mode' } },
  { id: 'quiz', label: 'Start GATE Quiz', command: { type: 'start_quiz', mode: 'quiz' } },
  { id: 'mock', label: 'Start Mock Test', command: { type: 'start_quiz', mode: 'mock' } },
  { id: 'flashcards', label: 'Formula Flashcards', command: { type: 'start_quiz', mode: 'flashcards' } },
  { id: 'pomodoro', label: 'Start Pomodoro (25 min)', command: { type: 'start_pomodoro' } },
  { id: 'pomodoro-stop', label: 'Stop Pomodoro', command: { type: 'stop_pomodoro' } },
  { id: 'notes-search', label: 'Search Notes', command: { type: 'search_notes', query: '' } },
  { id: 'stats', label: 'View Stats & XP', command: { type: 'show_stats' } },
  { id: 'break', label: 'Take a Break (breathing)', command: { type: 'take_break' } },
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notes, setNotes] = useState<NoteLite[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  // Build the static command list (apps + quick actions).
  const commands = useMemo<CommandItem[]>(() => {
    const markUsed = () => unlockNexusAchievement(NEXUS_ACHIEVEMENTS.commandPalette);
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
        action: () => {
          markUsed();
          toastResults([executeNexusCommand(qa.command)]);
          onClose();
        },
      });
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
  }, [registeredApps, launchApp, activeWorkspaceId, onClose]);

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

    // Natural language → NEXUS intent (skip when an app row already covers it).
    const intent: LocalIntent = parseLocalIntent(q, registeredApps);
    const singleKey =
      intent.type !== 'none' && intent.type !== 'multi' && intent.type !== 'help' && intent.type !== 'easter_egg'
        ? commandKey(intent)
        : null;
    const redundant =
      (intent.type === 'open_app' && !intent.newWindow && matches.some((m) => m.id === `launch-${intent.appId}`)) ||
      (singleKey !== null &&
        QUICK_ACTIONS.some(
          (qa) => commandKey(qa.command) === singleKey && matches.some((m) => m.id === `action-${qa.id}`)
        ));
    let intentItem: CommandItem | null = null;
    if (intent.type !== 'none' && !redundant) {
      const showInChat = intent.type === 'help' || intent.type === 'easter_egg';
      intentItem = {
        id: 'nexus-intent',
        label: `NEXUS: ${showInChat ? `ask "${q}"` : describeIntent(intent)}`,
        category: 'NEXUS',
        kind: 'nexus',
        action: () => {
          markUsed();
          if (showInChat) {
            openNexusWindow();
            void sendToNexus(q, { via: 'palette' });
          } else if (intent.type === 'multi') {
            toastResults(intent.commands.map(executeNexusCommand));
          } else if (intent.type !== 'help' && intent.type !== 'easter_egg' && intent.type !== 'none') {
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

    const items: CommandItem[] = [];
    if (intentItem) items.push(intentItem);
    items.push(...matches);
    // Nothing matched: asking NEXUS becomes the default (first) choice.
    if (!intentItem && matches.length === 0) items.push(askItem);
    items.push(...noteItems);
    if (intentItem || matches.length > 0) items.push(askItem);
    return items;
  }, [commands, query, registeredApps, notes, onClose]);

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

  // On open: focus the input and refresh the note index (async, not in render).
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => {
      inputRef.current?.focus();
      setNotes(loadNotesLite());
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Search apps, or tell NEXUS: "study mode", "DBMS quiz", "notes on paging"…'
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
