// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CommandPalette Component
// Spotlight/Ctrl+K command palette
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ArrowRight } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
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
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

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

    return cmds;
  }, [registeredApps, launchApp, activeWorkspaceId, onClose]);

  // Filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
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
                        ? 'bg-accent-primary/10 text-accent-primary'
                        : 'text-text-secondary hover:bg-white/5'
                    )}
                  >
                    <ArrowRight className="w-3 h-3 flex-shrink-0 opacity-50" />
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
