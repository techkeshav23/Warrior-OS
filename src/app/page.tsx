// ═══════════════════════════════════════════════════════════
// WARRIOR OS v4.0 — Main Entry Point
// State Machine: dream|boot → lock → desktop
// (first-ever boot → boot; returning users → dream when NEXUS Dreams
//  are on, else straight to lock)
//
// Reliability: the whole OS runs under a SystemErrorBoundary (cinematic
// recovery screen → Reboot), every app under its own boundary inside its
// window (Window.tsx), and each optional layer below under a
// LayerBoundary that drops only that layer if it fails.
// Showcase: phones and narrow windows get the SmallScreenGuard instead of
// the OS; a guest unlock fills empty apps with demo data first
// (src/lib/demo-seed.ts, once per browser); the NEXUS guided tour runs
// on a first visit.
// Performance: this bundle carries just the shell that boot, lock and the
// desktop need. The dream intro, the living-world overlays and the effects
// are lazy client-only chunks, fetched when first shown. Lite mode
// (Settings → Performance, src/lib/lite-mode.ts) skips the decorative
// canvases, the custom cursor, glass blur and the unlock transitions.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useOSStore } from '@/stores/useOSStore';
import { useAppStore } from '@/stores/useAppStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAdaptiveWallpaper } from '@/hooks/useAdaptiveWallpaper';
import { APP_REGISTRY } from '@/data/app-registry';
import { useLiteMode } from '@/lib/lite-mode';
import { getVisitorMode, type VisitorMode } from '@/lib/visitor';

// OS Components (bundled: boot, lock and the first desktop frame need them)
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
import { ScreenEffects } from '@/components/os/ScreenEffects';
import { WorkspaceManager, WorkspaceDots } from '@/components/os/WorkspaceManager';
import { WallpaperEngine } from '@/components/wallpapers/WallpaperEngine';
import { WallpaperDirector } from '@/components/os/BackgroundPicker';
import { AudioReactive } from '@/components/effects/AudioReactive';
import { DesktopWidgets } from '@/components/widgets/DesktopWidgets';
import { useDreamBootPhase } from '@/components/dream/useDreamBoot';

// Achievement routing: these seed the catalogue and announce unlocks and
// level-ups, so they mount with the page rather than lazily.
import { AchievementCinematic } from '@/components/effects/AchievementCinematic';
import { LevelUpEffect } from '@/components/effects/LevelUpEffect';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';

// Crash isolation
import { LayerBoundary, SystemErrorBoundary } from '@/components/showcase/AppErrorBoundary';
// Phones / narrow windows: "best on desktop" screen instead of the OS
import { SmallScreenGuard } from '@/components/showcase/SmallScreenGuard';
// Settings accent / glass opacity → CSS variables on <html>
import { ThemeSync } from '@/components/os/ThemeSync';
import { AuthSync } from '@/components/os/AuthSync';

// Notification store for toasts
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

// ─── Lazy layers ───
// Client-only chunks, fetched the first time they render: the dream intro
// on dream boots only, everything else once the desktop is up. Keeps
// recharts (creature stats, biometrics history), the DOM rasteriser and
// the other effect code out of the bundle that paints the boot screen.
const DreamSequence = dynamic(
  () => import('@/components/dream/DreamSequence').then((m) => m.DreamSequence),
  { ssr: false }
);
const AchievementTriggers = dynamic(
  () => import('@/components/achievements/AchievementTriggers').then((m) => m.AchievementTriggers),
  { ssr: false }
);
const BiometricsLayer = dynamic(
  () => import('@/components/biometrics/BiometricsLayer').then((m) => m.BiometricsLayer),
  { ssr: false }
);
const ProceduralMusicHost = dynamic(
  () => import('@/components/music/ProceduralMusicHost').then((m) => m.ProceduralMusicHost),
  { ssr: false }
);
const CalendarReminders = dynamic(
  () => import('@/components/apps/calendar/CalendarReminders').then((m) => m.CalendarReminders),
  { ssr: false }
);
const RealityDecay = dynamic(
  () => import('@/components/decay/DecayEngine').then((m) => m.DecayEngine),
  { ssr: false }
);
const WarriorCreature = dynamic(
  () => import('@/components/creature/WarriorCreature').then((m) => m.WarriorCreature),
  { ssr: false }
);
const NexusLayer = dynamic(
  () => import('@/components/nexus/NexusLayer').then((m) => m.NexusLayer),
  { ssr: false }
);
const GhostLayer = dynamic(
  () => import('@/components/ghost/GhostLayer').then((m) => m.GhostLayer),
  { ssr: false }
);
// Lite-mode Ghost Warriors: presence, war cries and the leaderboard only.
const GhostPresenceEngine = dynamic(
  () => import('@/components/ghost/GhostPresenceEngine').then((m) => m.GhostPresenceEngine),
  { ssr: false }
);
const WarCryBubbles = dynamic(
  () => import('@/components/ghost/WarCrySystem').then((m) => m.WarCryBubbles),
  { ssr: false }
);
const WarriorLeaderboard = dynamic(
  () => import('@/components/ghost/WarriorLeaderboard').then((m) => m.WarriorLeaderboard),
  { ssr: false }
);
// Decorative — never loaded in lite mode.
const PhantomLayer = dynamic(
  () => import('@/components/phantom/PhantomLayer').then((m) => m.PhantomLayer),
  { ssr: false }
);
const DisintegrateEffect = dynamic(
  () => import('@/components/effects/DisintegrateEffect').then((m) => m.DisintegrateEffect),
  { ssr: false }
);
const CursorManager = dynamic(
  () => import('@/components/os/CursorManager').then((m) => m.CursorManager),
  { ssr: false }
);
const CursorTrail = dynamic(
  () => import('@/components/effects/CursorTrail').then((m) => m.CursorTrail),
  { ssr: false }
);
const GlitchTransition = dynamic(
  () => import('@/components/effects/GlitchTransition').then((m) => m.GlitchTransition),
  { ssr: false }
);
const ScreenShatterLayer = dynamic(
  () => import('@/components/effects/ScreenShatter').then((m) => m.ScreenShatterLayer),
  { ssr: false }
);
// First-visit walkthrough (starts itself once per browser; Settings → Showcase replays it).
const GuidedTour = dynamic(
  () => import('@/components/showcase/GuidedTour').then((m) => m.GuidedTour),
  { ssr: false }
);

// Guest unlock: how long the desktop waits for the demo seed chunk. It is
// prefetched on the lock screen, so this only matters on a slow first load;
// past it the desktop appears and the seed lands while it does.
const DEMO_SEED_WAIT_MS = 1200;

function loadDemoSeed() {
  return import('@/lib/demo-seed');
}

// Lite mode: no backdrop blur anywhere. On integrated GPUs it is the most
// expensive effect in the OS (every glass panel re-blurs what is behind it).
const LITE_MODE_CSS =
  'html[data-lite-mode] *,html[data-lite-mode] *::before,html[data-lite-mode] *::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}';

export default function WarriorOSPage() {
  return (
    <SystemErrorBoundary>
      <ThemeSync />
      <SmallScreenGuard>
        <WarriorOS />
      </SmallScreenGuard>
    </SystemErrorBoundary>
  );
}

function WarriorOS() {
  const phase = useOSStore((s) => s.phase);
  const nextPhase = useOSStore((s) => s.nextPhase);
  const setPhase = useOSStore((s) => s.setPhase);
  const registerApps = useAppStore((s) => s.registerApps);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  // Phase 6 feature toggles
  const ghostWarriors = useSettingsStore((s) => s.ghostWarriors);
  const phantomWindows = useSettingsStore((s) => s.phantomWindows);

  // Lite mode (auto on low-memory / low-core / reduced-motion devices)
  const lite = useLiteMode();

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

  // Expose lite mode to CSS and non-React code: html[data-lite-mode]
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute('data-lite-mode', lite);
    return () => root.removeAttribute('data-lite-mode');
  }, [lite]);

  // Dream complete → go straight to lock (returning-user flow: dream → lock → desktop)
  const handleDreamComplete = useCallback(() => {
    setPhase('lock');
  }, [setPhase]);

  // Boot complete → advance to lock screen
  const handleBootComplete = useCallback(() => {
    nextPhase(); // boot → lock
  }, [nextPhase]);

  // Warm the demo seed chunk while the lock screen is up (not in the
  // owner's browser), so a guest unlock never waits for it.
  useEffect(() => {
    if (phase !== 'lock' || getVisitorMode() === 'owner') return;
    loadDemoSeed().catch(() => {
      // Offline without a cached chunk: a guest unlock then simply starts empty.
    });
  }, [phase]);

  // Lock screen unlock → advance to desktop. A guest first gets demo data
  // in the apps that are still empty (once per browser; owners never).
  const handleUnlock = useCallback(
    (mode: VisitorMode) => {
      if (mode !== 'guest') {
        nextPhase(); // lock → desktop
        return;
      }
      let entered = false;
      const enterDesktop = () => {
        if (entered) return;
        entered = true;
        nextPhase(); // lock → desktop
      };
      const fallback = window.setTimeout(enterDesktop, DEMO_SEED_WAIT_MS);
      loadDemoSeed()
        .then(({ seedDemoData }) => {
          seedDemoData({ mode });
        })
        .catch((error: unknown) => {
          console.warn('[Warrior OS] Demo data is unavailable; the guest desktop starts empty.', error);
        })
        .finally(() => {
          window.clearTimeout(fallback);
          enterDesktop();
        });
    },
    [nextPhase]
  );

  // Toggle start menu
  const toggleStartMenu = useCallback(() => {
    setStartMenuOpen((prev) => !prev);
  }, []);

  // Command palette (Ctrl+K, and the guided tour's "Try it now")
  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    'ctrl+k': openCommandPalette,
    'ctrl+1': () => switchWorkspace('study'),
    'ctrl+2': () => switchWorkspace('build'),
    'ctrl+3': () => switchWorkspace('chill'),
    // Only claims Escape when it closed something, so window-level Esc
    // listeners (calculator clear, cinematic skip, …) still get it.
    escape: () => {
      if (!startMenuOpen && !commandPaletteOpen && !notificationCenterOpen) return false;
      setStartMenuOpen(false);
      setCommandPaletteOpen(false);
      setNotificationCenterOpen(false);
    },
  });

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-bg-void select-none">
      {lite && <style>{LITE_MODE_CSS}</style>}

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

              {/* Shader/Canvas wallpaper behind everything (CSS-only in lite mode) */}
              <WallpaperEngine />
              {/* Background slideshow, Ctrl+Alt+W / Ctrl+Alt+Shift+W, change plate */}
              <WallpaperDirector />

              {/* CRT look (particles, scanlines, vignette) on the desktop
                  background only, below icons and windows (off in lite mode) */}
              <LayerBoundary name="Screen effects">
                <ScreenEffects />
              </LayerBoundary>

              {/* Dynamic Island (top center) */}
              <LayerBoundary name="Dynamic Island">
                <DynamicIsland />
              </LayerBoundary>

              {/* Desktop area with workspace management (overflow-clip, not
                  hidden: a focused control at a screen-wide window's edge
                  must not scroll the whole desktop sideways) */}
              <div className="flex-1 relative overflow-clip">
                <WorkspaceManager>
                  {() => (
                    <>
                      {/* Desktop Grid */}
                      <Desktop />

                      {/* Clock / streak / daily-target desktop widgets —
                          inside the workspace so they stack below windows */}
                      <LayerBoundary name="Desktop widgets">
                        <DesktopWidgets />
                      </LayerBoundary>

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

              {/* ─── Phase 6 global overlays ─── */}
              {/* Lazy chunks, each behind its own LayerBoundary: a layer
                  that fails to load or crashes just disappears. */}
              {/* Achievement triggers (first boot, daily login, catch-up, events) */}
              <LayerBoundary name="Achievement triggers">
                <AchievementTriggers />
              </LayerBoundary>
              {/* Firebase auth listener (no-op without NEXT_PUBLIC_FIREBASE_* config; owner session only) */}
              <AuthSync />
              {/* Typing biometrics tracker + vitals HUD + optional cloud sync */}
              <LayerBoundary name="Biometrics">
                <BiometricsLayer />
              </LayerBoundary>
              {/* Procedural music engine (survives Music window close) */}
              <LayerBoundary name="Procedural music">
                <ProceduralMusicHost />
              </LayerBoundary>
              {/* Calendar reminders while the Calendar window is closed */}
              <LayerBoundary name="Calendar reminders">
                <CalendarReminders />
              </LayerBoundary>
              {/* Window close disintegration (off by default; skipped in lite mode) */}
              {!lite && (
                <LayerBoundary name="Disintegrate effect">
                  <DisintegrateEffect />
                </LayerBoundary>
              )}
              {/* Reality Decay engine + stage/break/repair overlays */}
              <LayerBoundary name="Reality Decay">
                <RealityDecay />
              </LayerBoundary>
              {/* Phantom Windows — ghosts of closed apps (skipped in lite mode) */}
              {phantomWindows && !lite && (
                <LayerBoundary name="Phantom Windows">
                  <PhantomLayer />
                </LayerBoundary>
              )}
              {/* Ghost Warriors — anonymous multiplayer presence. Lite mode
                  keeps presence, war cries and the leaderboard, and skips
                  the walking avatars and the animated campfire. */}
              <LayerBoundary name="Ghost Warriors">
                {lite ? (
                  <>
                    <GhostPresenceEngine enabled={ghostWarriors} />
                    {ghostWarriors && <WarCryBubbles />}
                    {ghostWarriors && <WarriorLeaderboard anchor="bottom" />}
                  </>
                ) : (
                  <GhostLayer enabled={ghostWarriors} showFloatingCounter={false} />
                )}
              </LayerBoundary>
              {/* Warrior Creature — digital pet (self-positioned) */}
              <LayerBoundary name="Warrior Creature">
                <WarriorCreature />
              </LayerBoundary>
              {/* NEXUS — suggestions, voice indicator, pomodoro */}
              <LayerBoundary name="NEXUS">
                <NexusLayer />
              </LayerBoundary>
              {/* Guided tour — first-visit NEXUS walkthrough; its "Try it
                  now" opens the real command palette */}
              <LayerBoundary name="guided-tour">
                <GuidedTour onOpenCommandBar={openCommandPalette} />
              </LayerBoundary>

              {/* Custom cursor + cursor trail (lite mode keeps the system cursor) */}
              {!lite && (
                <LayerBoundary name="Custom cursor">
                  <CursorManager />
                </LayerBoundary>
              )}
              {!lite && (
                <LayerBoundary name="Cursor trail">
                  <CursorTrail />
                </LayerBoundary>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ═══ Always-mounted layers (watch the OS phase themselves) ═══ */}
      {/* Phase-change glitch + unlock shatter: pure spectacle, and the
          heaviest moment on a slow machine (full-screen SVG filter, DOM
          capture), so they load on the client and sit out lite mode. */}
      {bootReady && !lite && (
        <>
          <LayerBoundary name="Glitch transition">
            <GlitchTransition />
          </LayerBoundary>
          <LayerBoundary name="Screen shatter">
            <ScreenShatterLayer />
          </LayerBoundary>
        </>
      )}
      <LayerBoundary name="Achievement cinematic">
        <AchievementCinematic />
      </LayerBoundary>
      <LayerBoundary name="Level-up effect">
        <LevelUpEffect />
      </LayerBoundary>
      <ServiceWorkerRegistrar />
    </div>
  );
}
