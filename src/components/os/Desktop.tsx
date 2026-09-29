// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Component
// Desktop surface: icon grid (column-first, like a real desktop, so
// the right side stays free for widgets) and a right-click menu with
// working actions (background picker, next wallpaper, settings, refresh,
// widgets, info, lock). FORGED ARMOR: the menu is a riveted steel
// popover, rows are cut plates that heat to ember on hover / focus.
// Icons are memoized and receive only stable callbacks.
//
// Keyboard: arrow keys move the selection through the icon grid
// (↑/↓ within a column, ←/→ across columns, Home/End), Enter opens.
// The menu takes ↑/↓/Home/End, Enter/Space and Esc.
// ═══════════════════════════════════════════════════════════

'use client';

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Clock,
  Flame,
  ImagePlay,
  Images,
  Info,
  Lock,
  MonitorCog,
  RefreshCw,
  RotateCcw,
  Target,
  type LucideProps,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useOSStore } from '@/stores/useOSStore';
import { useXPStore } from '@/stores/useXPStore';
import { wallpaperLabel } from '@/components/apps/settings/wallpapers';
import { applyWallpaperToWorkspace, cycleWallpaperId } from '@/lib/wallpaper-cycle';
import { NEXT_WALLPAPER_KEYS } from '@/hooks/useWallpaperSlideshow';
import { cn } from '@/lib/utils';
import { EASE_OUT_QUINT } from '@/styles/tokens';
import { Kbd } from '@/components/ui/Badge';
import {
  WIDGET_IDS,
  WIDGET_LABELS,
  useWidgetStore,
  type WidgetId,
} from '@/components/widgets/useWidgetStore';
import { DesktopIcon } from './DesktopIcon';
import { BackgroundPicker } from './BackgroundPicker';

// ─── Menu geometry (used to keep the whole menu on screen) ───
const MENU_WIDTH = 288;
const MENU_PAD = 4; // p-1
const ITEM_H = 32;
const HEADING_H = 28;
const DIVIDER_H = 9;
const MENU_MARGIN = 8;
const MENU_HEIGHT =
  MENU_PAD * 2 +
  HEADING_H * 3 +
  DIVIDER_H * 2 +
  ITEM_H * (4 /* desktop */ + WIDGET_IDS.length + 1 /* reset */ + 2 /* system */);

type MenuAction = 'background' | 'wallpaper' | 'settings' | 'refresh' | 'reset-widgets' | 'info' | 'lock';
type Icon = ComponentType<LucideProps>;

const WIDGET_ICONS: Record<WidgetId, Icon> = {
  clock: Clock,
  streak: Flame,
  target: Target,
};

const ICON_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

function launch(appId: string) {
  useAppStore.getState().launchApp(appId, useWorkspaceStore.getState().activeWorkspaceId);
}

function nextWallpaper() {
  const settings = useSettingsStore.getState();
  const next = cycleWallpaperId(settings.wallpaper, 1);
  // Saved as this workspace's look, so it survives switches and reloads;
  // the desktop's wallpaper plate names it.
  applyWallpaperToWorkspace(next, 'menu');
  if (settings.adaptiveWallpaper) {
    useNotificationStore.getState().addNotification({
      type: 'system',
      title: 'Wallpaper',
      message: `Switched to ${wallpaperLabel(next)}. Adaptive wallpaper will change it again at the next time-of-day shift.`,
    });
  }
}

function showSystemInfo() {
  const apps = useAppStore.getState().registeredApps.length;
  const windows = useWindowStore.getState().windows.length;
  const { level, xp, getLevelTitle } = useXPStore.getState();
  useNotificationStore.getState().addNotification({
    type: 'info',
    title: 'WARRIOR OS v4.0',
    message: `${apps} apps installed · ${windows} window${windows === 1 ? '' : 's'} open · Level ${level} ${getLevelTitle()} (${xp} XP)`,
  });
}

// ─── Menu building blocks (kit Menu look, positioned at the pointer) ───

// Rows heat up like the kit Menu: ember wash + a molten 2px left edge.
const ITEM_CLASS = cn(
  'group/item flex h-8 w-full select-none items-center gap-2.5 chamfer [--cut:4px] px-2.5 text-left text-ui text-fg',
  'outline-none transition-colors duration-120 ease-out-quint',
  'hover:bg-linear-to-r hover:from-ember-500/20 hover:to-white/[0.03] hover:shadow-[inset_2px_0_0_var(--color-ember-400,#ff8a3d)]',
  'focus-visible:bg-linear-to-r focus-visible:from-ember-500/20 focus-visible:to-white/[0.03] focus-visible:shadow-[inset_2px_0_0_var(--color-ember-400,#ff8a3d)]'
);

function MenuIcon({ icon: Glyph }: { icon: Icon }) {
  return (
    <Glyph
      size={16}
      strokeWidth={1.75}
      aria-hidden
      className="shrink-0 text-fg-subtle transition-colors duration-120 group-hover/item:text-fg group-focus-visible/item:text-fg"
    />
  );
}

function MenuHeading({ children }: { children: ReactNode }) {
  return (
    <p
      aria-hidden="true"
      className="engraved flex h-7 items-end px-2.5 pb-1 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle"
    >
      {children}
    </p>
  );
}

function MenuDivider() {
  return <div role="separator" className="-mx-1 my-1 h-px bg-black/60 shadow-[0_1px_0_rgb(255_255_255/0.05)]" />;
}

/** The kit Switch (sm) look, drawn inside a menuitemcheckbox. */
function MiniSwitch({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="relative inline-flex h-4 w-8 shrink-0 items-center p-0.5">
      <span
        className={cn(
          'absolute inset-0 chamfer [--cut:4px] transition-[background-color] duration-180 ease-out-quint',
          'shadow-[inset_0_1px_0_rgb(0_0_0/0.8),inset_0_2px_4px_rgb(0_0_0/0.5),inset_0_-1px_0_rgb(255_255_255/0.1)]',
          on ? 'bg-linear-to-r from-accent/45 via-accent/80 to-accent' : 'bg-linear-to-b from-steel-950 to-steel-800'
        )}
      />
      <span
        className={cn(
          'relative block h-3 w-3.5 chamfer [--cut:2px] transition-transform duration-180 ease-out-quint',
          'bg-linear-to-b from-steel-200 via-steel-300 to-steel-400',
          on ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </span>
  );
}

function DesktopInner() {
  const registeredApps = useAppStore((s) => s.registeredApps);
  const widgetsEnabled = useWidgetStore((s) => s.enabled);
  const toggleWidget = useWidgetStore((s) => s.toggleWidget);
  const wallpaper = useSettingsStore((s) => s.wallpaper);
  const reduceMotion = useReducedMotion() ?? false;

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    originX: 'left' | 'right';
    originY: 'top' | 'bottom';
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Stable callbacks → memoized icons skip re-rendering.
  const handleLaunch = useCallback((appId: string) => {
    setSelectedAppId(appId);
    launch(appId);
  }, []);

  const handleContextMenu = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    // Keep the whole menu on screen at any size from 1024px up; grow
    // toward the free side, like a native menu.
    const maxX = window.innerWidth - MENU_WIDTH - MENU_MARGIN;
    const maxY = window.innerHeight - MENU_HEIGHT - MENU_MARGIN;
    const flipX = e.clientX > maxX;
    const flipY = e.clientY > maxY;
    setContextMenu({
      x: Math.max(MENU_MARGIN, flipX ? e.clientX - MENU_WIDTH : e.clientX),
      y: Math.max(MENU_MARGIN, flipY ? Math.min(maxY, e.clientY - MENU_HEIGHT) : e.clientY),
      originX: flipX ? 'right' : 'left',
      originY: flipY ? 'bottom' : 'top',
    });
  }, []);

  const handleSurfaceClick = useCallback((e: ReactMouseEvent) => {
    setContextMenu(null);
    if (!(e.target as HTMLElement).closest('[data-desktop-icon]')) setSelectedAppId(null);
  }, []);

  // Arrow keys move the selection through the icon grid.
  const handleGridKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!ICON_KEYS.has(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    const current = (e.target as HTMLElement).closest<HTMLElement>('[data-desktop-icon]');
    if (!current) return;
    const cells = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-desktop-icon]'));
    const index = cells.indexOf(current);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = cells[index + 1];
    else if (e.key === 'ArrowUp') next = cells[index - 1];
    else if (e.key === 'Home') next = cells[0];
    else if (e.key === 'End') next = cells[cells.length - 1];
    else {
      // Nearest icon in the neighbouring column, same row when there is one.
      const from = current.getBoundingClientRect();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      let best = Infinity;
      for (const cell of cells) {
        const r = cell.getBoundingClientRect();
        const dx = (r.left - from.left) * dir;
        if (dx < from.width / 2) continue;
        const score = dx * 4 + Math.abs(r.top - from.top);
        if (score < best) {
          best = score;
          next = cell;
        }
      }
    }
    if (!next) return;
    e.preventDefault();
    next.querySelector<HTMLElement>('button')?.focus();
    const id = next.getAttribute('data-desktop-icon');
    if (id) setSelectedAppId(id);
  }, []);

  // Close the menu on Escape or any press outside it.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest?.('[data-desktop-menu]')) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);

  // Focus the menu when it opens so the arrow keys work straight away.
  const menuOpen = contextMenu !== null;
  useEffect(() => {
    if (menuOpen) menuRef.current?.focus({ preventScroll: true });
  }, [menuOpen]);

  const handleMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]')
    );
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowDown') next = items[(at + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[at <= 0 ? items.length - 1 : at - 1];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    else if (e.key === 'Tab') {
      setContextMenu(null);
      return;
    }
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  const runAction = (action: MenuAction) => {
    setContextMenu(null);
    switch (action) {
      case 'background':
        setPickerOpen(true);
        break;
      case 'wallpaper':
        nextWallpaper();
        break;
      case 'settings':
        launch('settings');
        break;
      case 'refresh':
        setSelectedAppId(null);
        setRefreshKey((k) => k + 1); // replays the icon entrance
        break;
      case 'reset-widgets':
        useWidgetStore.getState().resetPositions();
        break;
      case 'info':
        showSystemInfo();
        break;
      case 'lock':
        useOSStore.getState().setPhase('lock');
        break;
    }
  };

  const upcomingWallpaper = wallpaperLabel(cycleWallpaperId(wallpaper, 1));

  return (
    <div
      className="absolute inset-0 px-3 pb-14 pt-3"
      style={{ zIndex: 'var(--z-desktop)' }}
      onContextMenu={handleContextMenu}
      onClick={handleSurfaceClick}
    >
      {/* ─── Desktop Icons: fill top-to-bottom, then the next column ─── */}
      <div
        key={refreshKey}
        onKeyDown={handleGridKeyDown}
        className="grid h-full grid-flow-col auto-cols-[88px] grid-rows-[repeat(auto-fill,100px)] content-start justify-start gap-1"
      >
        {registeredApps.map((app, index) => (
          <div key={app.id} data-desktop-icon={app.id}>
            <DesktopIcon
              app={app}
              index={index}
              selected={selectedAppId === app.id}
              onSelect={setSelectedAppId}
              onLaunch={handleLaunch}
            />
          </div>
        ))}
      </div>

      {/* ─── Context Menu ─── */}
      {/* Portalled: the desktop layer is its own stacking context (and the
          workspace cube a containing block), so an inline menu would sit
          under the desktop widgets. React events still bubble to here. */}
      {contextMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <motion.div
            ref={menuRef}
            data-desktop-menu
            role="menu"
            aria-label="Desktop"
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18, ease: EASE_OUT_QUINT }}
            className="armor-popover fixed p-1 outline-none"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              width: MENU_WIDTH,
              zIndex: 'var(--z-context-menu)',
              transformOrigin: `${contextMenu.originX} ${contextMenu.originY}`,
            }}
            onKeyDown={handleMenuKeyDown}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div role="group" aria-label="Desktop">
              <MenuHeading>Desktop</MenuHeading>
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => runAction('background')}
              >
                <MenuIcon icon={Images} />
                <span className="min-w-0 flex-1 truncate">Change background…</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                title={`Next: ${upcomingWallpaper}`}
                onClick={() => runAction('wallpaper')}
              >
                <MenuIcon icon={ImagePlay} />
                <span className="min-w-0 flex-1 truncate">Next wallpaper</span>
                <Kbd keys={NEXT_WALLPAPER_KEYS} size="sm" />
              </button>
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => runAction('settings')}
              >
                <MenuIcon icon={MonitorCog} />
                <span className="min-w-0 flex-1 truncate">Display settings</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => runAction('refresh')}
              >
                <MenuIcon icon={RefreshCw} />
                <span className="min-w-0 flex-1 truncate">Refresh</span>
              </button>
            </div>

            <MenuDivider />
            <div role="group" aria-label="Widgets">
              <MenuHeading>Widgets</MenuHeading>
              {WIDGET_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={widgetsEnabled[id]}
                  className={ITEM_CLASS}
                  onClick={() => toggleWidget(id)}
                >
                  <MenuIcon icon={WIDGET_ICONS[id]} />
                  <span className="min-w-0 flex-1 truncate">{WIDGET_LABELS[id]}</span>
                  <MiniSwitch on={widgetsEnabled[id]} />
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => runAction('reset-widgets')}
              >
                <MenuIcon icon={RotateCcw} />
                <span className="min-w-0 flex-1 truncate">Reset widget positions</span>
              </button>
            </div>

            <MenuDivider />
            <div role="group" aria-label="System">
              <MenuHeading>System</MenuHeading>
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => runAction('info')}
              >
                <MenuIcon icon={Info} />
                <span className="min-w-0 flex-1 truncate">System info</span>
                <span className="shrink-0 font-mono text-2xs text-fg-subtle">v4.0</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={ITEM_CLASS}
                onClick={() => runAction('lock')}
              >
                <MenuIcon icon={Lock} />
                <span className="min-w-0 flex-1 truncate">Lock screen</span>
                <Kbd keys={['Ctrl', 'L']} size="sm" />
              </button>
            </div>
          </motion.div>,
          document.body
        )}

      <BackgroundPicker open={pickerOpen} onClose={closePicker} />
    </div>
  );
}

export const Desktop = memo(DesktopInner);
