// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Component
// Draggable, resizable glassmorphism window with title bar.
// The app inside runs under its own error boundary: a crash shows a
// SYSTEM FAULT panel in this window (Restart app / Close) instead of
// taking the OS down. Lite mode swaps the glass blur for a solid fill.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { motion } from 'framer-motion';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useLiteMode } from '@/lib/lite-mode';
import { AppErrorBoundary } from '@/components/showcase/AppErrorBoundary';
import { cn } from '@/lib/utils';
import type { WindowState } from '@/types/window';

interface WindowProps {
  windowState: WindowState;
  children: ReactNode;
}

// Store actions never change, so they are read when needed instead of
// subscribing every window to every window-store update.
const windowActions = () => useWindowStore.getState();

const GLASS_STYLE = {
  background: 'rgba(15, 15, 25, 0.85)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
} as const;

// Lite mode: backdrop blur is the costliest effect on integrated GPUs.
const SOLID_STYLE = { background: 'rgba(12, 12, 20, 0.97)' } as const;

export function Window({ windowState, children }: WindowProps) {
  const {
    id,
    appId,
    title,
    position,
    size,
    minSize,
    isMinimized,
    isMaximized,
    isFocused,
    zIndex,
  } = windowState;

  const lite = useLiteMode();
  const rndRef = useRef<Rnd>(null);

  const handleFocus = useCallback(() => {
    if (!isFocused) windowActions().focusWindow(id);
  }, [id, isFocused]);

  const closeSelf = useCallback(() => {
    windowActions().closeWindow(id);
  }, [id]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      closeSelf();
    },
    [closeSelf]
  );

  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      windowActions().minimizeWindow(id);
    },
    [id]
  );

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      windowActions().restoreWindow(id);
    } else {
      windowActions().maximizeWindow(id);
    }
  }, [id, isMaximized]);

  const handleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleMaximize();
    },
    [toggleMaximize]
  );

  if (isMinimized) return null;

  return (
    <Rnd
      ref={rndRef}
      position={position}
      size={size}
      minWidth={minSize.width}
      minHeight={minSize.height}
      disableDragging={isMaximized}
      enableResizing={!isMaximized}
      dragHandleClassName="window-drag-handle"
      onDragStart={handleFocus}
      onDragStop={(_e, d) => windowActions().updatePosition(id, { x: d.x, y: d.y })}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const { updateSize, updatePosition } = windowActions();
        updateSize(id, {
          width: parseFloat(ref.style.width) || ref.offsetWidth,
          height: parseFloat(ref.style.height) || ref.offsetHeight,
        });
        updatePosition(id, pos);
      }}
      onMouseDown={handleFocus}
      style={{ zIndex, pointerEvents: 'auto' }}
      bounds="parent"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        data-window-id={id}
        data-app-id={appId}
        className={cn(
          'w-full h-full flex flex-col rounded-[var(--radius-lg)] overflow-hidden',
          'border transition-shadow duration-200',
          isFocused
            ? 'border-accent-primary/20 shadow-[0_0_30px_rgba(0,240,255,0.08)]'
            : 'border-white/5 shadow-lg'
        )}
        style={lite ? SOLID_STYLE : GLASS_STYLE}
      >
        {/* ─── Title Bar ─── */}
        <div
          className="window-drag-handle flex items-center justify-between px-3 h-9 shrink-0 cursor-default select-none"
          style={{
            background: isFocused
              ? 'rgba(255,255,255,0.03)'
              : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
          onDoubleClick={toggleMaximize}
        >
          {/* Left: Title */}
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'text-xs font-mono truncate',
              isFocused ? 'text-text-primary' : 'text-text-muted'
            )}>
              {title}
            </span>
          </div>

          {/* Right: Window Controls */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={handleMinimize}
              className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
              aria-label="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-white/10 transition-colors"
              aria-label={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* ─── Window Content (crash-isolated) ─── */}
        <div className="flex-1 overflow-auto">
          <AppErrorBoundary appName={title} onClose={closeSelf}>
            {children}
          </AppErrorBoundary>
        </div>
      </motion.div>
    </Rnd>
  );
}
