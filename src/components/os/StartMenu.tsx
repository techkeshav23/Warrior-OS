// ═══════════════════════════════════════════════════════════
// WARRIOR OS — StartMenu Component
// Slides up from taskbar with pinned apps and user info
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Settings, Shield } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useXPStore } from '@/stores/useXPStore';
import { cn } from '@/lib/utils';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StartMenu({ isOpen, onClose }: StartMenuProps) {
  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const level = useXPStore((s) => s.level);
  const levelTitle = useXPStore((s) => s.getLevelTitle());
  const levelProgress = useXPStore((s) => s.getLevelProgress());

  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    let listenerAdded = false;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close on open click
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      listenerAdded = true;
    }, 100);
    return () => {
      clearTimeout(timerId);
      if (listenerAdded) {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleLaunch = useCallback(
    (appId: string) => {
      launchApp(appId, activeWorkspaceId);
      onClose();
    },
    [launchApp, activeWorkspaceId, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ y: 20, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-14 left-2 w-80 max-h-[70vh] overflow-hidden rounded-[var(--radius-lg)]"
          style={{
            zIndex: 'var(--z-start-menu)',
            background: 'rgba(12, 12, 20, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* ─── User Info ─── */}
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-bold text-text-primary">
                  WARRIOR
                </p>
                <p className="text-xs font-mono text-text-muted">
                  Lv.{level} — {levelTitle}
                </p>
              </div>
            </div>
            {/* XP Progress */}
            <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-primary rounded-full transition-all duration-500"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>

          {/* ─── App Grid ─── */}
          <div className="p-3 max-h-[calc(70vh-140px)] overflow-y-auto">
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2 px-1">
              Applications
            </p>
            <div className="grid grid-cols-3 gap-1">
              {registeredApps.map((app, index) => (
                <motion.button
                  key={app.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => handleLaunch(app.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3',
                    'rounded-[var(--radius-md)]',
                    'hover:bg-white/5 active:bg-white/10',
                    'transition-colors duration-150'
                  )}
                >
                  <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-accent-primary/10 flex items-center justify-center">
                    <span className="text-accent-primary text-sm font-bold">
                      {app.name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-text-secondary text-center leading-tight">
                    {app.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* ─── Bottom Actions ─── */}
          <div className="p-2 border-t border-white/5 flex items-center gap-1">
            <button className="flex-1 h-8 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors text-xs font-mono">
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
            <button className="flex-1 h-8 flex items-center justify-center gap-2 rounded-[var(--radius-sm)] text-text-secondary hover:text-accent-danger hover:bg-accent-danger/5 transition-colors text-xs font-mono">
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
