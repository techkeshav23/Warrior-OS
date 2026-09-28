// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Component (FORGE HUD chrome)
// Draggable, resizable glass window. 40px title bar: app icon, title,
// Minimize / Maximize-Restore / Close (28px ghost buttons; Close turns
// danger on hover). Focused windows get a brighter hairline, a plasma
// hairline along the top edge, a soft accent glow and HUD corner
// brackets; unfocused titles dim to fg-muted.
// The app inside runs under its own error boundary: a crash shows a
// SYSTEM FAULT panel in this window (Restart app / Close) instead of
// taking the OS down. Lite mode swaps the glass blur for a solid fill.
//
// DOM contract (phantom capture, decay stages, e2e): the react-rnd root
// holds the glass <div data-window-id data-app-id>, whose direct
// children are the `.window-drag-handle` title bar and then the content.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Rnd } from 'react-rnd';
import { motion } from 'framer-motion';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useWindowStore } from '@/stores/useWindowStore';
import { useLiteMode } from '@/lib/lite-mode';
import { AppErrorBoundary } from '@/components/showcase/AppErrorBoundary';
import { AppIcon } from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { WindowState } from '@/types/window';

interface WindowProps {
  windowState: WindowState;
  children: ReactNode;
}

// Store actions never change, so they are read when needed instead of
// subscribing every window to every window-store update.
const windowActions = () => useWindowStore.getState();

// Lite mode: backdrop blur is the costliest effect on integrated GPUs.
const LITE_STYLE = {
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  backgroundColor: 'var(--color-ink-900, #070a12)',
} as const;

const FOCUS_GLOW = {
  boxShadow:
    '0 0 0 1px color-mix(in srgb, var(--accent, #2fd6f5) 14%, transparent), 0 0 48px -14px color-mix(in srgb, var(--accent, #2fd6f5) 42%, transparent)',
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;

// glass-window carries border + e3 elevation; focus only changes the edge.
const FOCUSED_EDGE = { borderColor: 'var(--color-line-strong)' } as const;
const RESTING_EDGE = { borderColor: 'var(--color-line)' } as const;

// ─── Title bar (also used by the /design-system sample window) ───

export interface WindowTitleBarProps {
  title: string;
  appId: string;
  focused: boolean;
  maximized: boolean;
  onMinimize?: (e: ReactMouseEvent) => void;
  onMaximize?: (e: ReactMouseEvent) => void;
  onClose?: (e: ReactMouseEvent) => void;
  onDoubleClick?: () => void;
  /** Adds the `.window-drag-handle` class react-rnd drags by (real windows only). */
  dragHandle?: boolean;
}

/** 40px window title bar: AppIcon · title · window controls. */
export function WindowTitleBar({
  title,
  appId,
  focused,
  maximized,
  onMinimize,
  onMaximize,
  onClose,
  onDoubleClick,
  dragHandle = false,
}: WindowTitleBarProps) {
  return (
    <div
      className={cn(
        dragHandle && 'window-drag-handle',
        'relative flex h-10 shrink-0 cursor-default select-none items-center gap-2.5 border-b pl-3.5 pr-1.5',
        'transition-colors duration-180 ease-out-quint',
        focused ? 'border-line bg-white/[0.018]' : 'border-line/70 bg-transparent'
      )}
      onDoubleClick={onDoubleClick}
    >
      {/* Plasma hairline along the top edge (focused only) */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-accent/70 to-transparent',
          'transition-opacity duration-260 ease-out-quint',
          focused ? 'opacity-100' : 'opacity-0'
        )}
      />
      <AppIcon
        appId={appId}
        size={18}
        className={cn('transition-opacity duration-180', !focused && 'opacity-55 grayscale-[40%]')}
      />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-ui font-medium transition-colors duration-180',
          focused ? 'text-fg' : 'text-fg-muted'
        )}
        title={title}
      >
        {title}
      </span>

      {/* Window controls — aria-labels are relied on by tests */}
      <div className="window-controls flex shrink-0 items-center gap-0.5" onDoubleClick={(e) => e.stopPropagation()}>
        <IconButton icon={Minus} aria-label="Minimize" size="sm" iconSize={15} onClick={onMinimize} />
        <IconButton
          icon={maximized ? Copy : Square}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          size="sm"
          iconSize={13}
          onClick={onMaximize}
          className={maximized ? '[&_svg]:-scale-x-100' : undefined}
        />
        <IconButton icon={X} aria-label="Close" variant="ghost-danger" size="sm" iconSize={16} onClick={onClose} />
      </div>
    </div>
  );
}

/** HUD corner brackets that frame the focused window from just outside. */
function FocusFrame({ visible, corners }: { visible: boolean; corners: boolean }) {
  const bracket = 'absolute size-2.5 border-accent/45';
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 rounded-window transition-opacity duration-260 ease-out-quint',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      style={FOCUS_GLOW}
    >
      {corners && (
        <>
          <span className={cn(bracket, '-left-1.5 -top-1.5 rounded-tl-[5px] border-l border-t')} />
          <span className={cn(bracket, '-right-1.5 -top-1.5 rounded-tr-[5px] border-r border-t')} />
          <span className={cn(bracket, '-bottom-1.5 -left-1.5 rounded-bl-[5px] border-b border-l')} />
          <span className={cn(bracket, '-bottom-1.5 -right-1.5 rounded-br-[5px] border-b border-r')} />
        </>
      )}
    </div>
  );
}

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
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      closeSelf();
    },
    [closeSelf]
  );

  const handleMinimize = useCallback(
    (e: ReactMouseEvent) => {
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
    (e: ReactMouseEvent) => {
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
      cancel=".window-controls"
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
      {/* Focus glow + HUD brackets (a sibling, so the glass keeps its DOM shape) */}
      <FocusFrame visible={isFocused} corners={isFocused && !isMaximized} />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.26, ease: EASE }}
        data-window-id={id}
        data-app-id={appId}
        data-focused={isFocused || undefined}
        className={cn(
          'glass-window relative flex h-full w-full flex-col overflow-hidden rounded-window',
          'transition-[border-color] duration-180 ease-out-quint'
        )}
        style={lite ? { ...LITE_STYLE, ...(isFocused ? FOCUSED_EDGE : RESTING_EDGE) } : isFocused ? FOCUSED_EDGE : RESTING_EDGE}
      >
        {/* ─── Title Bar ─── */}
        <WindowTitleBar
          dragHandle
          title={title}
          appId={appId}
          focused={isFocused}
          maximized={isMaximized}
          onMinimize={handleMinimize}
          onMaximize={handleMaximize}
          onClose={handleClose}
          onDoubleClick={toggleMaximize}
        />

        {/* ─── Window Content (crash-isolated) ─── */}
        <div className="scrollbar-thin flex-1 overflow-auto">
          <AppErrorBoundary appName={title} onClose={closeSelf}>
            {children}
          </AppErrorBoundary>
        </div>
      </motion.div>
    </Rnd>
  );
}
