// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Component
// Desktop surface: icon grid (column-first, like a real desktop, so
// the right side stays free for widgets) and a right-click menu with
// working actions (wallpaper, settings, refresh, widgets, info, lock).
// Icons are memoized and receive only stable callbacks.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useOSStore } from '@/stores/useOSStore';
import { useXPStore } from '@/stores/useXPStore';
import { WALLPAPER_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { WIDGET_IDS, WIDGET_LABELS, useWidgetStore } from '@/components/widgets/useWidgetStore';
import { DesktopIcon } from './DesktopIcon';

const MENU_WIDTH = 216;
const MENU_HEIGHT = 330;
const MENU_MARGIN = 8;

type MenuAction = 'wallpaper' | 'settings' | 'refresh' | 'reset-widgets' | 'info' | 'lock';

function launch(appId: string) {
  useAppStore.getState().launchApp(appId, useWorkspaceStore.getState().activeWorkspaceId);
}

function nextWallpaper() {
  const settings = useSettingsStore.getState();
  const index = WALLPAPER_OPTIONS.findIndex((w) => w.id === settings.wallpaper);
  const next = WALLPAPER_OPTIONS[(index + 1) % WALLPAPER_OPTIONS.length];
  settings.setWallpaper(next.id);
  useNotificationStore.getState().addNotification({
    type: 'system',
    title: 'Wallpaper',
    message: settings.adaptiveWallpaper
      ? `Switched to ${next.name}. Adaptive wallpaper will change it again at the next time-of-day shift.`
      : `Switched to ${next.name}.`,
  });
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

function DesktopInner() {
  const registeredApps = useAppStore((s) => s.registeredApps);
  const widgetsEnabled = useWidgetStore((s) => s.enabled);
  const toggleWidget = useWidgetStore((s) => s.toggleWidget);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Stable callbacks → memoized icons skip re-rendering.
  const handleLaunch = useCallback((appId: string) => {
    setSelectedAppId(appId);
    launch(appId);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Keep the whole menu on screen at any size from 1024px up.
    setContextMenu({
      x: Math.max(MENU_MARGIN, Math.min(e.clientX, window.innerWidth - MENU_WIDTH - MENU_MARGIN)),
      y: Math.max(MENU_MARGIN, Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - MENU_MARGIN)),
    });
  }, []);

  const handleSurfaceClick = useCallback((e: React.MouseEvent) => {
    setContextMenu(null);
    if (!(e.target as HTMLElement).closest('[data-desktop-icon]')) setSelectedAppId(null);
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

  const runAction = (action: MenuAction) => {
    setContextMenu(null);
    switch (action) {
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

  const menuItem =
    'w-full px-3 py-1.5 flex items-center justify-between gap-3 text-left text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors';

  return (
    <div
      className="absolute inset-0 pt-4 pb-14 px-4"
      style={{ zIndex: 'var(--z-desktop)' }}
      onContextMenu={handleContextMenu}
      onClick={handleSurfaceClick}
    >
      {/* ─── Desktop Icons: fill top-to-bottom, then the next column ─── */}
      <div
        key={refreshKey}
        className="grid h-full grid-flow-col auto-cols-[80px] grid-rows-[repeat(auto-fill,80px)] gap-2 content-start justify-start"
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
      {contextMenu && (
        <motion.div
          data-desktop-menu
          role="menu"
          aria-label="Desktop"
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="fixed glass rounded-[var(--radius-md)] py-1 shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            width: MENU_WIDTH,
            zIndex: 'var(--z-context-menu)',
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button role="menuitem" className={menuItem} onClick={() => runAction('wallpaper')}>
            Next wallpaper
          </button>
          <button role="menuitem" className={menuItem} onClick={() => runAction('settings')}>
            Display settings
          </button>
          <button role="menuitem" className={menuItem} onClick={() => runAction('refresh')}>
            Refresh
          </button>

          <div className="my-1 h-px bg-white/10" role="separator" />
          <div role="group" aria-label="Widgets">
            <p
              aria-hidden="true"
              className="px-3 pt-0.5 pb-1 text-[10px] font-mono uppercase tracking-widest text-text-secondary/70"
            >
              Widgets
            </p>
            {WIDGET_IDS.map((id) => (
              <button
                key={id}
                role="menuitemcheckbox"
                aria-checked={widgetsEnabled[id]}
                className={menuItem}
                onClick={() => toggleWidget(id)}
              >
                <span>{WIDGET_LABELS[id]}</span>
                <Check
                  className={cn('w-3 h-3 text-accent-primary', !widgetsEnabled[id] && 'invisible')}
                  aria-hidden="true"
                />
              </button>
            ))}
            <button role="menuitem" className={menuItem} onClick={() => runAction('reset-widgets')}>
              Reset widget positions
            </button>
          </div>

          <div className="my-1 h-px bg-white/10" role="separator" />
          <button role="menuitem" className={menuItem} onClick={() => runAction('info')}>
            System info
          </button>
          <button role="menuitem" className={menuItem} onClick={() => runAction('lock')}>
            <span>Lock screen</span>
            <kbd className="text-[10px] text-text-secondary/70">Ctrl+L</kbd>
          </button>
        </motion.div>
      )}
    </div>
  );
}

export const Desktop = memo(DesktopInner);
