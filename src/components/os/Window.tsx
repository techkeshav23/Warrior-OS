// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Window Component (FORGED ARMOR chrome)
// Draggable, resizable armor plate: 14px cuts top-left + bottom-right,
// beveled edges, rivets at the frame corners. 40px forged title band
// with an engraved title plate (AppIcon + title) hanging from the top
// edge and small steel control plates (Close heats to danger red).
// Focused windows heat their rim to ember (a clipped sibling plate
// behind the window that also casts its shadow); unfocused ones cool to
// steel and their title plate dims.
// The app inside runs under its own error boundary: a crash shows a
// SYSTEM FAULT panel in this window (Restart app / Close) instead of
// taking the OS down. Lite mode swaps the light blur for a solid fill.
//
// DOM contract (phantom capture, decay stages, e2e): the react-rnd root
// holds the armor <div data-window-id data-app-id>, whose direct
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
  backgroundColor: 'var(--color-steel-850, #101317)',
} as const;

const EASE = [0.16, 1, 0.3, 1] as const;

/** Window silhouette: 14px cuts top-left + bottom-right (armor-window). */
const WINDOW_CUT = 14;
/** The heated rim sits 2px outside the plate; its cut grows by 2·(2−√2) ≈ 1.2px to keep the diagonal rim even. */
const RIM_CUT = WINDOW_CUT + 1.2;

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

/** 40px armor title bar: engraved title plate (AppIcon · title) · steel control plates. */
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
        'relative flex h-10 shrink-0 cursor-default select-none items-center gap-2.5 pl-4 pr-1.5',
        // A darker forged band with a groove under it
        'bg-linear-to-b from-white/[0.045] to-black/25',
        'shadow-[inset_0_-1px_0_rgb(0_0_0/0.7),inset_0_-2px_0_rgb(255_255_255/0.05)]'
      )}
      onDoubleClick={onDoubleClick}
    >
      {/* Engraved title plate hanging from the top edge (notched bottom corners) */}
      <div
        className={cn(
          'notch relative flex h-8 min-w-0 max-w-[70%] items-center gap-2 self-start pl-2.5 pr-5 [--notch:10px]',
          'bg-linear-to-b transition-[background-color,--tw-gradient-from,--tw-gradient-to] duration-180 ease-out-quint',
          focused ? 'from-[#343c47] to-[#1c2128]' : 'from-[#23282f] to-[#15181d]'
        )}
      >
        <AppIcon
          appId={appId}
          size={18}
          active={focused}
          className={cn('transition-opacity duration-180', !focused && 'opacity-60 grayscale-[50%]')}
        />
        <span
          className={cn(
            'engraved min-w-0 truncate font-display text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-180',
            focused ? 'text-fg' : 'text-fg-subtle'
          )}
          title={title}
        >
          {title}
        </span>
        {/* Heated seam along the plate's bottom (focused only) */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-2.5 bottom-0 h-0.5 bg-linear-to-r from-ember-600 via-ember-300 to-ember-600',
            'transition-opacity duration-180 ease-out-quint',
            focused ? 'opacity-100 shadow-[0_0_8px_var(--color-ember-500,#f76b15)]' : 'opacity-0'
          )}
        />
      </div>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.12)_0_6px,transparent_6px_10px)] opacity-60" />

      {/* Window controls — aria-labels are relied on by tests */}
      <div className="window-controls flex shrink-0 items-center gap-1" onDoubleClick={(e) => e.stopPropagation()}>
        <IconButton icon={Minus} aria-label="Minimize" variant="secondary" size="xs" iconSize={13} onClick={onMinimize} />
        <IconButton
          icon={maximized ? Copy : Square}
          aria-label={maximized ? 'Restore' : 'Maximize'}
          variant="secondary"
          size="xs"
          iconSize={11}
          onClick={onMaximize}
          className={maximized ? '[&_svg]:-scale-x-100' : undefined}
        />
        <IconButton icon={X} aria-label="Close" variant="steel-danger" size="xs" iconSize={14} onClick={onClose} />
      </div>
    </div>
  );
}

/** The frame rim behind the plate: heated ember when focused, cold steel at rest; casts the window's shadow. */
export function ArmorRim({ focused, maximized }: { focused: boolean; maximized: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute armor-drop',
        maximized ? 'inset-0' : '-inset-0.5',
        focused &&
          '[filter:drop-shadow(0_0_12px_rgb(247_107_21/0.28))_drop-shadow(0_2px_3px_rgb(0_0_0/0.45))_drop-shadow(0_18px_28px_rgb(0_0_0/0.5))] lite:[filter:none]'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 chamfer-tl-br transition-[opacity,background-color] duration-260 ease-out-quint',
          focused
            ? 'bg-[linear-gradient(135deg,var(--color-ember-300,#ffb27a)_0%,var(--color-ember-500,#f76b15)_18%,var(--color-ember-700,#a3350a)_50%,var(--color-ember-500,#f76b15)_82%,var(--color-ember-300,#ffb27a)_100%)]'
            : 'bg-[linear-gradient(135deg,#4a525d_0%,#1b1f25_45%,#0b0d10_100%)]'
        )}
        style={{ ['--cut' as string]: `${maximized ? 0 : RIM_CUT}px` }}
      />
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
      // A window maximized on a screen smaller than its minimum size must
      // still fit the screen.
      minWidth={isMaximized ? undefined : minSize.width}
      minHeight={isMaximized ? undefined : minSize.height}
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
      {/* Heated rim + drop shadow (a sibling, so the plate keeps its DOM shape) */}
      <ArmorRim focused={isFocused} maximized={isMaximized} />

      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.26, ease: EASE }}
        data-window-id={id}
        data-app-id={appId}
        data-focused={isFocused || undefined}
        className={cn('armor-window chamfer-tl-br rivets relative flex h-full w-full flex-col overflow-hidden')}
        style={{
          ...(lite ? LITE_STYLE : null),
          ['--cut' as string]: `${isMaximized ? 0 : WINDOW_CUT}px`,
          ['--rivet-inset' as string]: '5px',
        }}
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
