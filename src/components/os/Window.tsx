// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Component
// Draggable, resizable glassmorphism window with title bar
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { motion } from 'framer-motion';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';
import { useWindowStore } from '@/stores/useWindowStore';
import { cn } from '@/lib/utils';
import type { WindowState } from '@/types/window';

interface WindowProps {
  windowState: WindowState;
  children: ReactNode;
}

export function Window({ windowState, children }: WindowProps) {
  const {
    id,
    title,
    position,
    size,
    minSize,
    isMinimized,
    isMaximized,
    isFocused,
    zIndex,
  } = windowState;

  const {
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    focusWindow,
    updatePosition,
    updateSize,
  } = useWindowStore();

  const rndRef = useRef<Rnd>(null);

  const handleFocus = useCallback(() => {
    if (!isFocused) focusWindow(id);
  }, [id, isFocused, focusWindow]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      closeWindow(id);
    },
    [id, closeWindow]
  );

  const handleMinimize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      minimizeWindow(id);
    },
    [id, minimizeWindow]
  );

  const handleMaximize = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isMaximized) {
        restoreWindow(id);
      } else {
        maximizeWindow(id);
      }
    },
    [id, isMaximized, maximizeWindow, restoreWindow]
  );

  const handleDoubleClickTitle = useCallback(() => {
    if (isMaximized) {
      restoreWindow(id);
    } else {
      maximizeWindow(id);
    }
  }, [id, isMaximized, maximizeWindow, restoreWindow]);

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
      onDragStop={(_e, d) => updatePosition(id, { x: d.x, y: d.y })}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
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
        className={cn(
          'w-full h-full flex flex-col rounded-[var(--radius-lg)] overflow-hidden',
          'border transition-shadow duration-200',
          isFocused
            ? 'border-accent-primary/20 shadow-[0_0_30px_rgba(0,240,255,0.08)]'
            : 'border-white/5 shadow-lg'
        )}
        style={{
          background: 'rgba(15, 15, 25, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
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
          onDoubleClick={handleDoubleClickTitle}
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

        {/* ─── Window Content ─── */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </motion.div>
    </Rnd>
  );
}
