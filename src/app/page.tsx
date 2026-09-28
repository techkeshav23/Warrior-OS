// ═══════════════════════════════════════════════════════════
// WARRIOR OS v4.0 — Main Entry Point
// State Machine: dream|boot → lock → desktop
// (first-ever boot → boot; returning users → dream when NEXUS Dreams
//  are on, else straight to lock)
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOSStore } from '@/stores/useOSStore';
import { useAppStore } from '@/stores/useAppStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAdaptiveWallpaper } from '@/hooks/useAdaptiveWallpaper';
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
import { WorkspaceManager, WorkspaceDots } from '@/components/os/WorkspaceManager';
import { WallpaperEngine } from '@/components/wallpapers/WallpaperEngine';
import { AudioReactive } from '@/components/effects/AudioReactive';
import { CursorTrail } from '@/components/effects/CursorTrail';

// Phase 6 global overlays
import { WarriorCreature } from '@/components/creature';
import { GhostLayer } from '@/components/ghost';
import { RealityDecay } from '@/components/decay';
import { PhantomLayer } from '@/components/phantom';
import { BiometricsLayer } from '@/components/biometrics';
import { DreamSequence, useDreamBootPhase } from '@/components/dream';
import { NexusLayer } from '@/components/nexus';
import { ProceduralMusicHost } from '@/components/music';
import { CalendarReminders } from '@/components/apps/calendar/CalendarReminders';

// Achievements, effects, widgets, PWA
import { AchievementTriggers } from '@/components/achievements';
import {
  AchievementCinematic,
  LevelUpEffect,
  GlitchTransition,
  ScreenShatterLayer,
  DisintegrateEffect,
} from '@/components/effects';
import { DesktopWidgets } from '@/components/widgets';
import { ServiceWorkerRegistrar } from '@/components/pwa';

// Notification store for toasts
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function WarriorOS() {
  const phase = useOSStore((s) => s.phase);
  const nextPhase = useOSStore((s) => s.nextPhase);
  const setPhase = useOSStore((s) => s.setPhase);
  const registerApps = useAppStore((s) => s.registerApps);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  // Phase 6 feature toggles
  const ghostWarriors = useSettingsStore((s) => s.ghostWarriors);
  const phantomWindows = useSettingsStore((s) => s.phantomWindows);

  // Decides the first phase (boot / dream / lock) on the first client paint.
  const bootReady = useDreamBootPhase();

  // UI state
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  // Notifications for toasts
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);

  // Adaptive wallpaper (auto-switch by time of day)
  useAdaptiveWallpaper();

  // Register all apps on mount
  useEffect(() => {
    registerApps(APP_REGISTRY);
  }, [registerApps]);

  // Dream complete → go straight to lock (returning-user flow: dream → lock → desktop)
  const handleDreamComplete = useCallback(() => {
    setPhase('lock');
  }, [setPhase]);

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
    'ctrl+1': () => switchWorkspace('study'),
    'ctrl+2': () => switchWorkspace('build'),
    'ctrl+3': () => switchWorkspace('chill'),
    escape: () => {
      setStartMenuOpen(false);
      setCommandPaletteOpen(false);
      setNotificationCenterOpen(false);
    },
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg-void select-none">
      {bootReady && (
        <AnimatePresence mode="wait">
          {/* ═══ DREAM PHASE (returning users only) ═══ */}
          {phase === 'dream' && (
            <motion.div
              key="dream"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <DreamSequence onComplete={handleDreamComplete} />
            </motion.div>
          )}

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
              {/* Audio-reactive CSS variables */}
              <AudioReactive />

              {/* Shader/Canvas wallpaper behind everything */}
              <WallpaperEngine />

              {/* Background effects */}
              <ScreenEffects />

              {/* Dynamic Island (top center) */}
              <DynamicIsland />

              {/* Desktop area with workspace management */}
              <div className="flex-1 relative overflow-hidden">
                <WorkspaceManager>
                  {() => (
                    <>
                      {/* Desktop Grid */}
                      <Desktop />

                      {/* Clock / streak / daily-target desktop widgets —
                          inside the workspace so they stack below windows */}
                      <DesktopWidgets />

                      {/* Window Manager */}
                      <WindowManager />
                    </>
                  )}
                </WorkspaceManager>
              </div>

              {/* Workspace indicator dots */}
              <WorkspaceDots className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10" />

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

              {/* ─── Phase 6 global overlays ─── */}
              {/* Achievement triggers (first boot, daily login, catch-up, events) */}
              <AchievementTriggers />
              {/* Typing biometrics tracker + vitals HUD + optional cloud sync */}
              <BiometricsLayer />
              {/* Procedural music engine (survives Music window close) */}
              <ProceduralMusicHost />
              {/* Calendar reminders while the Calendar window is closed */}
              <CalendarReminders />
              {/* Window close disintegration (off by default) */}
              <DisintegrateEffect />
              {/* Reality Decay engine + stage/break/repair overlays */}
              <RealityDecay />
              {/* Phantom Windows — ghosts of closed apps */}
              {phantomWindows && <PhantomLayer />}
              {/* Ghost Warriors — anonymous multiplayer presence */}
              <GhostLayer enabled={ghostWarriors} showFloatingCounter={false} />
              {/* Warrior Creature — digital pet (self-positioned) */}
              <WarriorCreature />
              {/* NEXUS — suggestions, voice indicator, pomodoro */}
              <NexusLayer />

              {/* Custom cursor */}
              <CursorManager />

              {/* Cursor trail effect */}
              <CursorTrail />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ═══ Always-mounted layers (watch the OS phase themselves) ═══ */}
      <GlitchTransition />
      <ScreenShatterLayer />
      <AchievementCinematic />
      <LevelUpEffect />
      <ServiceWorkerRegistrar />
    </div>
  );
}
