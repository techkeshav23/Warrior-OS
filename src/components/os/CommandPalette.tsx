// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CommandPalette Component
// Spotlight/Ctrl+K command palette
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight, Sparkles } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useNexusStore } from '@/stores/useNexusStore';
import { useNexusCore } from '@/components/nexus/NexusCore';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: string;
  action: () => void;
  isNexus?: boolean;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const addNexusMessage = useNexusStore((s) => s.addMessage);
  const setNexusProcessing = useNexusStore((s) => s.setProcessing);
  const { ask } = useNexusCore();

  /**
   * Hand off the current query to NEXUS: open the AI Assist window,
   * post the user message, fire the request, post the reply.
   */
  const askNexusWith = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      launchApp('nexus-ai', activeWorkspaceId);
      addNexusMessage('user', q);
      setNexusProcessing(true);
      void (async () => {
        try {
          const { reply } = await ask(q);
          addNexusMessage('nexus', reply);
        } finally {
          setNexusProcessing(false);
        }
      })();
      onClose();
    },
    [launchApp, activeWorkspaceId, addNexusMessage, setNexusProcessing, ask, onClose]
  );

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const cmds: CommandItem[] = [];

    // App launch commands
    registeredApps.forEach((app) => {
      cmds.push({
        id: `launch-${app.id}`,
        label: `Open ${app.name}`,
        category: 'Applications',
        action: () => {
          launchApp(app.id, activeWorkspaceId);
          onClose();
        },
      });
    });

    // Quick actions
    cmds.push({
      id: 'action-quiz',
      label: 'Start GATE Quiz',
      category: 'Quick Action',
      action: () => { launchApp('gate-prep', activeWorkspaceId); onClose(); },
    });
    cmds.push({
      id: 'action-notes',
      label: 'New Note',
      category: 'Quick Action',
      action: () => { launchApp('notes', activeWorkspaceId); onClose(); },
    });
    cmds.push({
      id: 'action-mock',
      label: 'Start Mock Test',
      category: 'Quick Action',
      action: () => { launchApp('gate-prep', activeWorkspaceId); onClose(); },
    });
    cmds.push({
      id: 'action-stats',
      label: 'View Stats & XP',
      category: 'Quick Action',
      action: () => { launchApp('warrior-profile', activeWorkspaceId); onClose(); },
    });
    cmds.push({
      id: 'action-terminal',
      label: 'Open Terminal',
      category: 'Quick Action',
      action: () => { launchApp('terminal', activeWorkspaceId); onClose(); },
    });
    cmds.push({
      id: 'action-settings',
      label: 'Open Settings',
      category: 'Quick Action',
      action: () => { launchApp('settings', activeWorkspaceId); onClose(); },
    });

    return cmds;
  }, [registeredApps, launchApp, activeWorkspaceId, onClose]);

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return commands;
    const lower = q.toLowerCase();
    const matches = commands.filter(
      (c) => c.label.toLowerCase().includes(lower) || c.category.toLowerCase().includes(lower)
    );

    // Always offer "Ask NEXUS" as the last option when there's a query, so
    // any free-form question reaches the AI without leaving the palette.
    const askEntry: CommandItem = {
      id: 'nexus-ask',
      label: `Ask NEXUS: ${q.length > 60 ? q.slice(0, 60) + '…' : q}`,
      category: 'NEXUS',
      action: () => askNexusWith(q),
      isNexus: true,
    };
    return [...matches, askEntry];
  }, [commands, query, askNexusWith]);

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

  // Focus input on open — useEffect only for the imperative DOM call
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen]);

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
            className="relative w-full max-w-lg rounded-[var(--radius-lg)] overflow-hidden"
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
                placeholder="Search commands, apps..."
                className="flex-1 bg-transparent text-sm font-mono text-text-primary placeholder:text-text-muted outline-none"
              />
              <kbd className="text-[9px] font-mono text-text-muted bg-white/5 px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <p className="text-center text-xs font-mono text-text-muted py-8">
                  No results found
                </p>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left',
                      'transition-colors duration-75',
                      i === selectedIndex
                        ? cmd.isNexus
                          ? 'bg-cyan-500/10 text-cyan-300'
                          : 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:bg-white/5'
                    )}
                  >
                    {cmd.isNexus ? (
                      <Sparkles className="w-3 h-3 flex-shrink-0 opacity-80 text-cyan-400" />
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
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
