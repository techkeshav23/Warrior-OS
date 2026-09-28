// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Taskbar Component
// Bottom glass bar: Start, the active workspace's window list
// (memoized buttons with primitive props), and the system tray:
// workspaces, install, notifications, sound, network, lock, clock
// and a "show desktop" sliver.
//
// Desktop-phase shortcuts owned here (the taskbar only exists on the
// desktop): Ctrl/Cmd+L lock · Ctrl/Cmd+, Settings · Super/Cmd+D show
// desktop (Windows reserves Win+D for itself; use the sliver there),
// plus every app's registry `shortcut` (e.g. Ctrl+` → Terminal).
// Combos are built exactly like useKeyboardShortcuts, and page-level
// shortcuts win because that hook stops propagation at `document`.
//
// The Reality Decay timer and the Ghost Warriors counter are lazy
// client-only chunks, so the decay / ghost code stays out of the bundle
// that paints boot and lock; they pop into the tray once loaded.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Bell, Lock, MonitorDown, Shield, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useOSStore } from '@/stores/useOSStore';
import { usePwaInstallStore } from '@/components/pwa/usePwaInstallStore';
import { useNow } from '@/components/widgets/hooks';
import { DEFAULT_WORKSPACES, type WorkspaceId } from '@/types/workspace';
import { cn } from '@/lib/utils';
import { appGlyph } from './DesktopIcon';

// Tray extras, fetched on first render (straight from their files: the
// ghost / decay barrels would pull in every overlay of those features).
const DecayTrayTimer = dynamic(
  () => import('@/components/decay/DecayTrayTimer').then((m) => m.DecayTrayTimer),
  { ssr: false }
);
const OnlineCounter = dynamic(
  () => import('@/components/ghost/OnlineCounter').then((m) => m.OnlineCounter),
  { ssr: false }
);

interface TaskbarProps {
  onStartClick: () => void;
  onNotificationClick?: () => void;
}

// ─── Helpers (read stores at call time → stable, dependency-free) ───

function lockScreen() {
  useOSStore.getState().setPhase('lock');
}

function openSettings() {
  useAppStore.getState().launchApp('settings', useWorkspaceStore.getState().activeWorkspaceId);
}

/** Browser autofill can dispatch keydown events without a `key`. */
function keyOf(e: KeyboardEvent): string {
  return typeof e.key === 'string' ? e.key.toLowerCase() : '';
}

/** Same combo format as hooks/useKeyboardShortcuts: ctrl(=ctrl|meta)+shift+alt+key */
function comboFor(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  const key = keyOf(e);
  if (key && !['control', 'shift', 'alt', 'meta'].includes(key)) parts.push(key);
  return parts.join('+');
}

function launchByShortcut(combo: string): boolean {
  const apps = useAppStore.getState();
  const app = apps.registeredApps.find((a) => a.shortcut?.toLowerCase() === combo);
  if (!app) return false;
  apps.launchApp(app.id, useWorkspaceStore.getState().activeWorkspaceId);
  return true;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}
const readOnline = () => navigator.onLine;
const serverOnline = () => true;

// ─── Window list button ───

interface TaskbarWindowButtonProps {
  windowId: string;
  title: string;
  glyph: string;
  isFocused: boolean;
  isMinimized: boolean;
  onToggle: (windowId: string) => void;
}

function TaskbarWindowButtonInner({
  windowId,
  title,
  glyph,
  isFocused,
  isMinimized,
  onToggle,
}: TaskbarWindowButtonProps) {
  const active = isFocused && !isMinimized;
  return (
    <button
      type="button"
      onClick={() => onToggle(windowId)}
      aria-pressed={active}
      title={isMinimized ? `Restore ${title}` : active ? `Minimize ${title}` : `Show ${title}`}
      className={cn(
        'h-9 min-w-22 max-w-44 basis-44 shrink px-2.5 flex items-center gap-2',
        'rounded-[var(--radius-sm)] border-b-2 text-xs font-mono transition-all duration-150',
        active
          ? 'bg-accent-primary/10 text-accent-primary border-accent-primary'
          : 'border-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary',
        isMinimized && 'opacity-60'
      )}
    >
      <span className="text-sm leading-none shrink-0" aria-hidden="true">
        {glyph}
      </span>
      <span className="truncate">{title}</span>
    </button>
  );
}

const TaskbarWindowButton = memo(TaskbarWindowButtonInner);

// ─── Clock (re-renders once a minute, on the minute) ───

function TaskbarClockInner() {
  const now = useNow(60_000);
  const date = new Date(now);
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const day = date.toLocaleDateString('en-IN', { weekday: 'short' });
  const full = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col items-end px-2 min-w-[4.5rem]" title={full}>
      <span className="text-xs font-mono text-text-primary leading-tight whitespace-nowrap">{time}</span>
      <span className="text-[10px] font-mono text-text-secondary leading-tight whitespace-nowrap">
        {day}, {date.getDate()}/{date.getMonth() + 1}
      </span>
    </div>
  );
}

const TaskbarClock = memo(TaskbarClockInner);

// ─── Taskbar ───

const trayButton =
  'relative w-8 h-8 flex items-center justify-center rounded-[var(--radius-sm)] text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors focus-ring';

function TaskbarInner({ onStartClick, onNotificationClick }: TaskbarProps) {
  const windows = useWindowStore((s) => s.windows);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const registeredApps = useAppStore((s) => s.registeredApps);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const ghostWarriors = useSettingsStore((s) => s.ghostWarriors);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const canInstall = usePwaInstallStore((s) => s.deferredPrompt !== null);
  const online = useSyncExternalStore(subscribeOnline, readOnline, serverOnline);

  // Window list for the active workspace, as primitive props per button.
  const windowItems = useMemo(() => {
    const glyphs = new Map(registeredApps.map((app) => [app.id, appGlyph(app.icon, app.name)]));
    return windows
      .filter((w) => w.workspaceId === activeWorkspaceId)
      .map((w) => ({
        id: w.id,
        title: w.title,
        glyph: glyphs.get(w.appId) ?? appGlyph(w.icon, w.title),
        isFocused: w.isFocused,
        isMinimized: w.isMinimized,
      }));
  }, [windows, activeWorkspaceId, registeredApps]);

  const windowCounts = useMemo(() => {
    const counts: Partial<Record<string, number>> = {};
    for (const w of windows) counts[w.workspaceId] = (counts[w.workspaceId] ?? 0) + 1;
    return counts;
  }, [windows]);

  // Show desktop: minimize every visible window in this workspace; the
  // next press restores exactly those windows in their old stacking order.
  const restoreListRef = useRef<Partial<Record<string, string[]>>>({});
  const showDesktop = useCallback(() => {
    const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    const store = useWindowStore.getState();
    const visible = store.windows
      .filter((w) => w.workspaceId === workspaceId && !w.isMinimized)
      .sort((a, b) => a.zIndex - b.zIndex);

    if (visible.length > 0) {
      restoreListRef.current[workspaceId] = visible.map((w) => w.id);
      for (const w of visible) store.minimizeWindow(w.id);
      return;
    }

    const toRestore = restoreListRef.current[workspaceId] ?? [];
    restoreListRef.current[workspaceId] = undefined;
    for (const id of toRestore) {
      const win = useWindowStore.getState().windows.find((w) => w.id === id);
      if (win && win.isMinimized && win.workspaceId === workspaceId) {
        useWindowStore.getState().focusWindow(id); // un-minimizes and raises
      }
    }
  }, []);

  // Desktop-phase keyboard shortcuts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || isTypingTarget(e.target)) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) return; // never steal plain typing keys

      // "super+d". On Windows the OS keeps Win+D; the tray sliver covers it.
      if (e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && keyOf(e) === 'd') {
        e.preventDefault();
        showDesktop();
        return;
      }

      const combo = comboFor(e);
      if (combo === 'ctrl+l') {
        e.preventDefault();
        lockScreen();
      } else if (combo === 'ctrl+,') {
        e.preventDefault();
        openSettings();
      } else if (launchByShortcut(combo)) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDesktop]);

  const installApp = useCallback(() => {
    void usePwaInstallStore.getState().promptInstall();
  }, []);

  return (
    <motion.div
      data-warrior-taskbar
      initial={{ y: 48 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 h-12 flex items-center pl-2 gap-1"
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
        type="button"
        onClick={onStartClick}
        // The Start menu closes itself on any document mousedown outside it.
        // React listens on `document` in the App Router, so stop the other
        // document listeners here; otherwise a click on Start would close
        // the menu on mousedown and re-open it on click.
        onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
        aria-label="Start"
        className={cn(
          'h-9 px-3 flex items-center gap-2 rounded-[var(--radius-md)] shrink-0',
          'text-accent-primary hover:bg-white/5 active:bg-white/10',
          'transition-colors duration-150 focus-ring'
        )}
      >
        <Shield className="w-5 h-5" />
        <span className="text-xs font-display font-bold tracking-wider hidden sm:block">WARRIOR</span>
      </button>

      {/* ─── Separator ─── */}
      <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />

      {/* ─── Window list (active workspace) ─── */}
      <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto" role="toolbar" aria-label="Open windows">
        {windowItems.map((item) => (
          <TaskbarWindowButton
            key={item.id}
            windowId={item.id}
            title={item.title}
            glyph={item.glyph}
            isFocused={item.isFocused}
            isMinimized={item.isMinimized}
            onToggle={toggleMinimize}
          />
        ))}
      </div>

      {/* ─── System Tray ─── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Workspaces (a ring marks workspaces that have windows) */}
        <div className="flex items-center gap-1.5 px-2" role="group" aria-label="Workspaces">
          {DEFAULT_WORKSPACES.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            const count = windowCounts[ws.id] ?? 0;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => switchWorkspace(ws.id as WorkspaceId)}
                aria-label={`${ws.name} workspace${count ? `, ${count} window${count === 1 ? '' : 's'}` : ''}`}
                aria-current={isActive ? 'true' : undefined}
                title={`${ws.name}${count ? ` · ${count} open` : ''}`}
                className="w-3 h-3 flex items-center justify-center rounded-full focus-ring"
              >
                <span
                  className={cn(
                    'block w-1.5 h-1.5 rounded-full transition-all duration-200',
                    isActive ? 'bg-accent-primary scale-125' : 'bg-text-muted/60',
                    !isActive && count > 0 && 'ring-1 ring-accent-primary/60'
                  )}
                />
              </button>
            );
          })}
        </div>

        {/* Study timer (Reality Decay) */}
        <DecayTrayTimer />

        {/* Ghost Warriors online counter (opens the leaderboard) */}
        {ghostWarriors && <OnlineCounter />}

        {/* Install as an app (only when the browser offers it) */}
        {canInstall && (
          <button
            type="button"
            onClick={installApp}
            className={cn(trayButton, 'text-accent-primary')}
            aria-label="Install Warrior OS as an app"
            title="Install Warrior OS as an app"
          >
            <MonitorDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Notifications */}
        <button
          type="button"
          onClick={onNotificationClick}
          disabled={!onNotificationClick}
          className={trayButton}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          title="Notifications"
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-accent-tertiary text-[9px] leading-3.5 font-mono font-bold text-white text-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Sound toggle */}
        <button
          type="button"
          onClick={toggleSound}
          className={trayButton}
          aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          aria-pressed={!soundEnabled}
          title={soundEnabled ? 'Sound on' : 'Sound off'}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Network (live browser online status) */}
        <div
          className={cn('w-8 h-8 flex items-center justify-center', online ? 'text-accent-success' : 'text-accent-danger')}
          role="img"
          aria-label={online ? 'Online' : 'Offline'}
          title={online ? 'Online' : 'Offline'}
        >
          {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
        </div>

        {/* Lock */}
        <button type="button" onClick={lockScreen} className={trayButton} aria-label="Lock screen" title="Lock (Ctrl+L)">
          <Lock className="w-3.5 h-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-white/10 mx-0.5" />

        {/* Clock */}
        <TaskbarClock />

        {/* Show desktop sliver (Windows-style, far right) */}
        <button
          type="button"
          onClick={showDesktop}
          className="w-2 h-12 border-l border-white/10 hover:bg-white/10 transition-colors focus-ring"
          aria-label="Show desktop"
          title="Show desktop"
        />
      </div>
    </motion.div>
  );
}

export const Taskbar = memo(TaskbarInner);
