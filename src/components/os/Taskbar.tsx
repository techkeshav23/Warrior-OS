// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Taskbar Component (FORGE HUD)
// Bottom glass bar: Start (BrandMark), the command-palette search,
// the active workspace's window list (memoized AppIcon buttons with
// primitive props) and the system tray: workspaces, study timer,
// install, notifications, sound, network LED, lock, clock and a
// "show desktop" sliver.
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

import { memo, useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  Bell,
  CodeXml,
  GraduationCap,
  Headphones,
  LayoutGrid,
  Lock,
  MonitorDown,
  Search,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useOSStore } from '@/stores/useOSStore';
import { usePwaInstallStore } from '@/components/pwa/usePwaInstallStore';
import { useNow } from '@/components/widgets/hooks';
import { AppIcon } from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { resolveAccent } from '@/styles/tokens';
import type { WorkspaceId } from '@/types/workspace';
import { cn } from '@/lib/utils';
import { BrandMark } from '@/components/showcase/BrandMark';
import { useStartMenuOpen } from './StartMenu';
import { useNotificationCenterOpen } from './NotificationCenter';

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

const EASE = [0.16, 1, 0.3, 1] as const;

// ─── Helpers (read stores at call time → stable, dependency-free) ───

function lockScreen() {
  useOSStore.getState().setPhase('lock');
}

function openSettings() {
  useAppStore.getState().launchApp('settings', useWorkspaceStore.getState().activeWorkspaceId);
}

/** Opens the command palette the way a person would: Ctrl+K on document. */
function openCommandPalette() {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true })
  );
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

const noopSubscribe = () => () => {};
const readIsMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
const serverIsMac = () => false;

/** Workspace glyphs (the store keeps legacy icon names; ids are stable). */
const WORKSPACE_ICON: Record<string, LucideIcon> = {
  study: GraduationCap,
  build: CodeXml,
  chill: Headphones,
};

// ─── Window list button ───

interface TaskbarWindowButtonProps {
  windowId: string;
  appId: string;
  title: string;
  isFocused: boolean;
  isMinimized: boolean;
  onToggle: (windowId: string) => void;
}

function TaskbarWindowButtonInner({ windowId, appId, title, isFocused, isMinimized, onToggle }: TaskbarWindowButtonProps) {
  const active = isFocused && !isMinimized;
  return (
    <button
      type="button"
      onClick={() => onToggle(windowId)}
      aria-pressed={active}
      title={isMinimized ? `Restore ${title}` : active ? `Minimize ${title}` : `Show ${title}`}
      className={cn(
        'group relative flex h-9 min-w-11 max-w-48 shrink items-center gap-2 rounded-control pl-2 pr-3',
        'text-ui transition-colors duration-120 ease-out-quint focus-ring-inset',
        active
          ? 'bg-surface-active text-fg'
          : 'text-fg-muted hover:bg-surface-hover hover:text-fg active:bg-surface-active'
      )}
    >
      <AppIcon appId={appId} size={20} active={active} className={cn(isMinimized && 'opacity-60')} />
      <span className={cn('min-w-0 truncate', isMinimized && 'text-fg-subtle')}>{title}</span>
      {/* Running indicator: wide accent bar when focused, a short tick otherwise */}
      <span
        aria-hidden
        className={cn(
          'absolute bottom-0.5 left-1/2 h-0.5 -translate-x-1/2 rounded-full transition-[width,background-color] duration-180 ease-out-quint',
          active
            ? 'w-5 bg-accent shadow-[0_0_8px_var(--accent)]'
            : isMinimized
              ? 'w-1 bg-fg-faint'
              : 'w-2 bg-fg-subtle group-hover:bg-fg-muted'
        )}
      />
    </button>
  );
}

const TaskbarWindowButton = memo(TaskbarWindowButtonInner);

// ─── Clock (re-renders once a minute, on the minute) ───

function TaskbarClockInner() {
  const now = useNow(60_000);
  const date = new Date(now);
  const hours = date.getHours();
  const time = `${hours % 12 === 0 ? 12 : hours % 12}:${String(date.getMinutes()).padStart(2, '0')}`;
  const meridiem = hours < 12 ? 'AM' : 'PM';
  const day = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const full = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Tooltip content={full} side="top">
      <div className="flex min-w-[5.25rem] flex-col items-end justify-center gap-1 px-2.5 leading-none">
        <span className="tabular whitespace-nowrap text-ui font-medium leading-none text-fg">
          {time}
          <span className="ml-1 text-2xs font-medium text-fg-subtle">{meridiem}</span>
        </span>
        <span className="tabular whitespace-nowrap font-mono text-2xs leading-none text-fg-subtle">{day}</span>
      </div>
    </Tooltip>
  );
}

const TaskbarClock = memo(TaskbarClockInner);

// ─── Tray pieces ───

function TraySeparator() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line-strong" />;
}

// ─── Taskbar ───

function TaskbarInner({ onStartClick, onNotificationClick }: TaskbarProps) {
  const windows = useWindowStore((s) => s.windows);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const toggleSound = useSettingsStore((s) => s.toggleSound);
  const ghostWarriors = useSettingsStore((s) => s.ghostWarriors);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const canInstall = usePwaInstallStore((s) => s.deferredPrompt !== null);
  const online = useSyncExternalStore(subscribeOnline, readOnline, serverOnline);
  const isMac = useSyncExternalStore(noopSubscribe, readIsMac, serverIsMac);
  const startOpen = useStartMenuOpen();
  const notificationsOpen = useNotificationCenterOpen();
  const mod = isMac ? '⌘' : 'Ctrl';

  // Window list for the active workspace, as primitive props per button.
  const windowItems = useMemo(
    () =>
      windows
        .filter((w) => w.workspaceId === activeWorkspaceId)
        .map((w) => ({
          id: w.id,
          appId: w.appId,
          title: w.title,
          isFocused: w.isFocused,
          isMinimized: w.isMinimized,
        })),
    [windows, activeWorkspaceId]
  );

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
      transition={{ duration: 0.26, ease: EASE }}
      className="glass-window fixed inset-x-0 bottom-0 flex h-12 items-center gap-1 rounded-none border-x-0 border-b-0 pl-2"
      style={{ zIndex: 'var(--z-taskbar)' }}
    >
      {/* Forge hairline along the top edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/25 to-transparent"
      />

      {/* ─── Start ─── */}
      <button
        type="button"
        onClick={onStartClick}
        // The Start menu closes itself on any document mousedown outside it.
        // React listens on `document` in the App Router, so stop the other
        // document listeners here; otherwise a click on Start would close
        // the menu on mousedown and re-open it on click.
        onMouseDown={(e) => e.nativeEvent.stopImmediatePropagation()}
        aria-label="Start"
        aria-expanded={startOpen}
        aria-haspopup="dialog"
        className={cn(
          'group flex h-9 shrink-0 items-center gap-2.5 rounded-control pl-1 pr-3',
          'transition-colors duration-120 ease-out-quint focus-ring',
          startOpen ? 'bg-surface-active' : 'hover:bg-surface-hover active:bg-surface-active'
        )}
      >
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-[28%] border bg-linear-to-b from-ink-700 to-ink-900',
            'inset-shadow-[0_1px_0_rgb(255_255_255/0.08)] transition-[border-color,box-shadow] duration-180 ease-out-quint',
            startOpen
              ? 'border-accent/60 shadow-glow'
              : 'border-line-strong group-hover:border-accent/50 group-hover:shadow-[0_0_14px_-4px_var(--accent)]'
          )}
        >
          <BrandMark size={20} />
        </span>
        <span className="hidden font-display text-[11px] font-bold tracking-[0.24em] text-fg sm:block">WARRIOR</span>
      </button>

      {/* ─── Search / command palette ─── */}
      <button
        type="button"
        data-tour="command-bar"
        onClick={openCommandPalette}
        aria-label="Search apps and commands"
        aria-keyshortcuts="Control+K"
        title={`Search apps and commands (${mod} K)`}
        className={cn(
          'group flex size-9 shrink-0 items-center justify-center gap-2 rounded-control text-fg-subtle',
          'transition-colors duration-120 ease-out-quint hover:bg-surface-hover hover:text-fg focus-ring',
          'xl:h-8 xl:w-60 xl:justify-start xl:border xl:border-line xl:bg-ink-950/40 xl:pl-2.5 xl:pr-1.5 xl:hover:border-line-strong xl:hover:bg-surface-hover'
        )}
      >
        <Search size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
        <span className="hidden flex-1 truncate text-left text-ui text-fg-subtle transition-colors duration-120 group-hover:text-fg-muted xl:block">
          Search or command
        </span>
        <span className="hidden xl:inline-flex">
          <Kbd size="sm" keys={[mod, 'K']} />
        </span>
      </button>

      <TraySeparator />

      {/* ─── Window list (active workspace) ─── */}
      <div
        className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        role="toolbar"
        aria-label="Open windows"
      >
        {windowItems.map((item) => (
          <TaskbarWindowButton
            key={item.id}
            windowId={item.id}
            appId={item.appId}
            title={item.title}
            isFocused={item.isFocused}
            isMinimized={item.isMinimized}
            onToggle={toggleMinimize}
          />
        ))}
      </div>

      {/* ─── System tray ─── */}
      <div className="flex shrink-0 items-center gap-0.5 pl-1">
        {/* Workspaces (each in its own accent; a tick marks workspaces with windows) */}
        <div
          className="mr-1 flex items-center gap-0.5 rounded-control border border-line bg-ink-950/40 p-0.5"
          role="group"
          aria-label="Workspaces"
        >
          {workspaces.map((ws, index) => {
            const isActive = ws.id === activeWorkspaceId;
            const count = windowCounts[ws.id] ?? 0;
            const Icon = WORKSPACE_ICON[ws.id] ?? LayoutGrid;
            return (
              <Tooltip
                key={ws.id}
                content={`${ws.name}${count ? ` · ${count} open` : ''}`}
                shortcut={index < 3 ? `${mod} ${index + 1}` : undefined}
                side="top"
              >
                <button
                  type="button"
                  onClick={() => switchWorkspace(ws.id as WorkspaceId)}
                  aria-label={`${ws.name} workspace${count ? `, ${count} window${count === 1 ? '' : 's'}` : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'relative flex size-7 items-center justify-center rounded-[6px]',
                    'transition-colors duration-120 ease-out-quint focus-ring',
                    isActive ? 'bg-accent/15 text-accent' : 'text-fg-subtle hover:bg-surface-hover hover:text-fg'
                  )}
                  style={{ '--accent': resolveAccent(ws.accentColor) } as CSSProperties}
                >
                  <Icon size={14} strokeWidth={1.9} aria-hidden />
                  {count > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute bottom-[3px] left-1/2 h-0.5 -translate-x-1/2 rounded-full',
                        isActive ? 'w-2.5 bg-accent' : 'w-1 bg-fg-muted'
                      )}
                    />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Study timer (Reality Decay) */}
        <DecayTrayTimer />

        {/* Ghost Warriors online counter (opens the leaderboard) */}
        {ghostWarriors && <OnlineCounter />}

        {/* Install as an app (only when the browser offers it) */}
        {canInstall && (
          <IconButton
            icon={<MonitorDown size={16} strokeWidth={1.75} aria-hidden className="text-accent" />}
            onClick={installApp}
            aria-label="Install Warrior OS as an app"
            tooltip="Install as an app"
          />
        )}

        {/* Notifications (count badge cut out of the bar) */}
        <span className="relative inline-flex">
          <IconButton
            icon={Bell}
            onClick={onNotificationClick}
            disabled={!onNotificationClick}
            active={notificationsOpen}
            aria-pressed={undefined}
            aria-expanded={notificationsOpen}
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            tooltip="Notifications"
          />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="tabular pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-semibold leading-none text-accent-fg ring-2 ring-ink-900"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>

        {/* Sound toggle */}
        <IconButton
          icon={soundEnabled ? Volume2 : VolumeX}
          onClick={toggleSound}
          aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
          aria-pressed={!soundEnabled}
          tooltip={soundEnabled ? 'Sound on' : 'Sound off'}
        />

        {/* Network: live browser status with an LED */}
        <Tooltip content={online ? 'Online' : 'Offline: changes stay on this device'} side="top">
          <div
            className={cn('relative flex size-8 items-center justify-center', online ? 'text-fg-muted' : 'text-danger')}
            role="img"
            aria-label={online ? 'Online' : 'Offline'}
          >
            {online ? <Wifi size={16} strokeWidth={1.75} aria-hidden /> : <WifiOff size={16} strokeWidth={1.75} aria-hidden />}
            <span
              aria-hidden
              className={cn(
                'absolute bottom-1.5 right-1.5 size-1.5 rounded-full ring-2 ring-ink-900',
                online ? 'bg-success shadow-[0_0_6px_var(--color-success)]' : 'bg-danger'
              )}
            />
          </div>
        </Tooltip>

        {/* Lock */}
        <IconButton icon={Lock} onClick={lockScreen} aria-label="Lock screen" tooltip="Lock screen" shortcut={`${mod} L`} />

        <TraySeparator />

        {/* Clock */}
        <TaskbarClock />

        {/* Show desktop sliver (Windows-style, far right) */}
        <button
          type="button"
          onClick={showDesktop}
          className="group flex h-12 w-2.5 items-center justify-center border-l border-line transition-colors duration-120 ease-out-quint hover:bg-surface-hover focus-ring-inset"
          aria-label="Show desktop"
          title="Show desktop"
        >
          <span aria-hidden className="h-4 w-px bg-fg-faint opacity-0 transition-opacity duration-120 group-hover:opacity-100" />
        </button>
      </div>
    </motion.div>
  );
}

export const Taskbar = memo(TaskbarInner);
