// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Desktop Component
// The main desktop area with icons, wallpaper, and right-click
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { cn } from '@/lib/utils';

export function Desktop() {
  const registeredApps = useAppStore((s) => s.registeredApps);
  const launchApp = useAppStore((s) => s.launchApp);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleDoubleClick = useCallback(
    (appId: string) => {
      launchApp(appId, activeWorkspaceId);
    },
    [launchApp, activeWorkspaceId]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  return (
    <div
      className="absolute inset-0 pt-4 pb-14 px-4"
      style={{ zIndex: 'var(--z-desktop)' }}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
    >
      {/* ─── Desktop Icons Grid ─── */}
      <div className="grid grid-cols-[repeat(auto-fill,80px)] gap-2 content-start">
        {registeredApps.map((app, index) => (
          <motion.button
            key={app.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            onDoubleClick={() => handleDoubleClick(app.id)}
            className={cn(
              'w-20 h-20 flex flex-col items-center justify-center gap-1.5',
              'rounded-[var(--radius-md)] cursor-default select-none',
              'hover:bg-white/5 active:bg-white/10',
              'transition-colors duration-150 group'
            )}
          >
            {/* Icon placeholder */}
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center group-hover:border-accent-primary/40 group-hover:shadow-[0_0_12px_rgba(0,240,255,0.1)] transition-all duration-200">
              <span className="text-accent-primary text-lg">
                {app.name.charAt(0)}
              </span>
            </div>
            {/* Label */}
            <span className="text-[10px] font-mono text-text-secondary text-center leading-tight line-clamp-2 group-hover:text-text-primary transition-colors">
              {app.name}
            </span>
          </motion.button>
        ))}
      </div>

      {/* ─── Context Menu ─── */}
      {contextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="fixed glass rounded-[var(--radius-md)] py-1 min-w-[180px] shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 'var(--z-context-menu)',
          }}
        >
          {[
            { label: 'Change Wallpaper', action: 'wallpaper' },
            { label: 'Display Settings', action: 'settings' },
            { label: 'Refresh', action: 'refresh' },
            { label: 'System Info', action: 'info' },
          ].map((item) => (
            <button
              key={item.action}
              className="w-full px-3 py-1.5 text-left text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
              onClick={() => setContextMenu(null)}
            >
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}
