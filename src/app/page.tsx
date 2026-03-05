// ═══════════════════════════════════════════════════════════
// WARRIOR OS v4.0 — Main Entry Point
// State Machine: boot → lock → desktop
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOSStore } from '@/stores/useOSStore';
import { useAppStore } from '@/stores/useAppStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { APP_REGISTRY } from '@/data/app-registry';

// OS Components
import { BootScreen } from '@/components/os/BootScreen';
import { LockScreen } from '@/components/os/LockScreen';
import { Desktop } from '@/components/os/Desktop';
import { Taskbar } from '@/components/os/Taskbar';
import { WindowManager } from '@/components/os/WindowManager';
import { StartMenu } from '@/components/os/StartMenu';
import { DynamicIsland } from '@/components/os/DynamicIsland';
import { CommandPalette } from '@/components/os/CommandPalette';
import { NotificationCenter } from '@/components/os/NotificationCenter';
import { ToastContainer } from '@/components/os/ToastNotification';
import { CursorManager } from '@/components/os/CursorManager';
import { ScreenEffects } from '@/components/os/ScreenEffects';
import { ScanlineOverlay } from '@/components/ui/ScanlineOverlay';

// Notification store for toasts
import { useNotificationStore } from '@/stores/useNotificationStore';

export default function WarriorOS() {
  const phase = useOSStore((s) => s.phase);
  const nextPhase = useOSStore((s) => s.nextPhase);
  const registerApps = useAppStore((s) => s.registerApps);

  // UI state
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  // Notifications for toasts
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  // Register all apps on mount
  useEffect(() => {
    registerApps(APP_REGISTRY);
  }, [registerApps]);

  // Boot complete → advance to lock screen
  const handleBootComplete = useCallback(() => {
    nextPhase(); // boot → lock
  }, [nextPhase]);

  // Lock screen unlock → advance to desktop
  const handleUnlock = useCallback(() => {
    nextPhase(); // lock → desktop
  }, [nextPhase]);

  // Toggle start menu
  const toggleStartMenu = useCallback(() => {
    setStartMenuOpen((prev) => !prev);
  }, []);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': () => setCommandPaletteOpen(true),
    escape: () => {
      setStartMenuOpen(false);
      setCommandPaletteOpen(false);
      setNotificationCenterOpen(false);
    },
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg-void select-none">
      <AnimatePresence mode="wait">
        {/* ═══ BOOT PHASE ═══ */}
        {phase === 'boot' && (
          <motion.div
            key="boot"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <BootScreen onComplete={handleBootComplete} />
          </motion.div>
        )}

        {/* ═══ LOCK PHASE ═══ */}
        {phase === 'lock' && (
          <motion.div
            key="lock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <LockScreen onUnlock={handleUnlock} />
          </motion.div>
        )}

        {/* ═══ DESKTOP PHASE ═══ */}
        {phase === 'desktop' && (
          <motion.div
            key="desktop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Background effects */}
            <ScreenEffects />

            {/* Dynamic Island (top center) */}
            <DynamicIsland />

            {/* Desktop area (fills remaining space above taskbar) */}
            <div className="flex-1 relative overflow-hidden">
              {/* Desktop Grid */}
              <Desktop />

              {/* Window Manager */}
              <WindowManager />
            </div>

            {/* Taskbar (fixed bottom) */}
            <Taskbar
              onStartClick={toggleStartMenu}
              onNotificationClick={() => setNotificationCenterOpen(true)}
            />

            {/* Start Menu */}
            <StartMenu
              isOpen={startMenuOpen}
              onClose={() => setStartMenuOpen(false)}
            />

            {/* Command Palette */}
            <CommandPalette
              isOpen={commandPaletteOpen}
              onClose={() => setCommandPaletteOpen(false)}
            />

            {/* Notification Center */}
            <NotificationCenter
              isOpen={notificationCenterOpen}
              onClose={() => setNotificationCenterOpen(false)}
            />

            {/* Toast Notifications */}
            <ToastContainer
              notifications={notifications}
              onDismiss={markAsRead}
            />

            {/* CRT Scanline overlay */}
            <ScanlineOverlay />

            {/* Custom cursor */}
            <CursorManager />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
