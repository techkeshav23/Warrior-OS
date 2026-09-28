// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Taskbar Component
// Bottom glass bar with Start, running apps, and system tray
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Volume2, VolumeX, Wifi } from 'lucide-react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useClock } from '@/hooks/useClock';
import { cn } from '@/lib/utils';

interface TaskbarProps {
  onStartClick: () => void;
  onNotificationClick?: () => void;
}

export function Taskbar({ onStartClick, onNotificationClick: _onNotificationClick }: TaskbarProps) {
  const windows = useWindowStore((s) => s.windows);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const registeredApps = useAppStore((s) => s.registeredApps);
  const runningAppIds = useAppStore((s) => s.runningAppIds);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const clock = useClock();

  // Get running apps with their window states
  const runningApps = registeredApps.filter((app) =>
    runningAppIds.includes(app.id)
  );

  const getAppWindow = useCallback(
    (appId: string) =>
      windows.find(
        (w) => w.appId === appId && w.workspaceId === activeWorkspaceId
      ),
    [windows, activeWorkspaceId]
  );

  return (
    <motion.div
      initial={{ y: 48 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 h-12 flex items-center px-2 gap-1"
      style={{
        zIndex: 'var(--z-taskbar)',
        background: 'rgba(10, 10, 18, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      {/* ─── Start Button ─── */}
      <button
        onClick={onStartClick}
        className={cn(
          'h-9 px-3 flex items-center gap-2 rounded-[var(--radius-md)]',
          'text-accent-primary hover:bg-white/5 active:bg-white/10',
          'transition-colors duration-150'
        )}
      >
        <Shield className="w-5 h-5" />
        <span className="text-xs font-display font-bold tracking-wider hidden sm:block">
          WARRIOR
        </span>
      </button>

      {/* ─── Separator ─── */}
      <div className="w-px h-6 bg-white/10 mx-1" />

      {/* ─── Running Apps ─── */}
      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {runningApps.map((app) => {
          const win = getAppWindow(app.id);
          const isFocused = win?.isFocused ?? false;
          const isMinimized = win?.isMinimized ?? false;

          return (
            <button
              key={app.id}
              onClick={() => win && toggleMinimize(win.id)}
              className={cn(
                'h-9 px-3 flex items-center gap-2 rounded-[var(--radius-sm)]',
                'text-xs font-mono transition-all duration-150',
                isFocused && !isMinimized
                  ? 'bg-accent-primary/10 text-accent-primary border-b-2 border-accent-primary'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary',
                isMinimized && 'opacity-60'
              )}
            >
              <span className="truncate max-w-24">{app.name}</span>
            </button>
          );
        })}
      </div>

      {/* ─── System Tray ─── */}
      <div className="flex items-center gap-1">
        {/* Workspace indicator */}
        <div className="flex items-center gap-1 px-2">
          {['study', 'build', 'chill'].map((ws) => (
            <div
              key={ws}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all duration-200',
                ws === activeWorkspaceId
                  ? 'bg-accent-primary scale-125'
                  : 'bg-text-muted/40'
              )}
            />
          ))}
        </div>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
        >
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Network */}
        <div className="w-8 h-8 flex items-center justify-center text-accent-success">
          <Wifi className="w-3.5 h-3.5" />
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Clock */}
        <div className="flex flex-col items-end px-2 min-w-[4.5rem]">
          <span className="text-xs font-mono text-text-primary leading-tight">
            {clock.timeShort}
          </span>
          <span className="text-[10px] font-mono text-text-muted leading-tight">
            {clock.day.slice(0, 3)}, {new Date().getDate()}/{new Date().getMonth() + 1}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
