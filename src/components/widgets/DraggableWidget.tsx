// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DraggableWidget (FORGE HUD)
// armor-window shell (riveted forged plate, cut top-left + bottom-right) for a desktop widget: HUD label header (grip
// appears on hover), pointer drag with a small dead-zone, position
// persisted on drop, clamped to the viewport (so nothing overflows
// from 1024px to 1920px+), arrow-key nudging, and a hover close
// button that turns the widget off.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/Button';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useViewportSize } from './hooks';
import {
  WIDGET_LABELS,
  useWidgetStore,
  type WidgetId,
  type WidgetPosition,
} from './useWidgetStore';

/** Keep widgets this far from the screen edges */
const EDGE_GAP = 8;
/** Fixed taskbar height (Taskbar is h-12) */
const TASKBAR_HEIGHT = 48;
/** Pointer travel before a press becomes a drag (keeps clicks clickable) */
const DRAG_THRESHOLD = 3;
const NUDGE = 10;
const NUDGE_FAST = 40;

export function clampWidgetPosition(
  pos: WidgetPosition,
  size: { width: number; height: number },
  viewport: { width: number; height: number }
): WidgetPosition {
  const maxX = viewport.width - size.width - EDGE_GAP;
  const maxY = viewport.height - TASKBAR_HEIGHT - size.height - EDGE_GAP;
  // Math.max last: on a viewport smaller than the widget, pin to top-left.
  return {
    x: Math.max(EDGE_GAP, Math.min(maxX, pos.x)),
    y: Math.max(EDGE_GAP, Math.min(maxY, pos.y)),
  };
}

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

interface DraggableWidgetProps {
  id: WidgetId;
  width: number;
  height: number;
  defaultPosition: WidgetPosition;
  /** Fade out and ignore the pointer (e.g. behind a maximized window) */
  hidden?: boolean;
  /** Double-click action, e.g. open the related app */
  onOpen?: () => void;
  openHint?: string;
  className?: string;
  children: ReactNode;
}

function DraggableWidgetInner({
  id,
  width,
  height,
  defaultPosition,
  hidden = false,
  onOpen,
  openHint,
  className,
  children,
}: DraggableWidgetProps) {
  const stored = useWidgetStore((s) => s.positions[id]);
  const setPosition = useWidgetStore((s) => s.setPosition);
  const setEnabled = useWidgetStore((s) => s.setEnabled);
  const viewport = useViewportSize();

  const [dragPos, setDragPos] = useState<WidgetPosition | null>(null);
  const sessionRef = useRef<DragSession | null>(null);

  const size = { width, height };
  const pos = clampWidgetPosition(dragPos ?? stored ?? defaultPosition, size, viewport);
  const label = WIDGET_LABELS[id];

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Let buttons inside the widget behave like buttons.
    if ((e.target as HTMLElement).closest('button, input, a, [data-no-drag]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    sessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      moved: false,
    };
  };

  const pointerTarget = (session: DragSession, e: PointerEvent<HTMLDivElement>) =>
    clampWidgetPosition(
      {
        x: session.originX + (e.clientX - session.startX),
        y: session.originY + (e.clientY - session.startY),
      },
      size,
      viewport
    );

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    if (!session.moved) {
      const travel = Math.hypot(e.clientX - session.startX, e.clientY - session.startY);
      if (travel < DRAG_THRESHOLD) return;
      session.moved = true;
    }
    setDragPos(pointerTarget(session, e));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    const session = sessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    sessionRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (session.moved && e.type === 'pointerup') {
      setPosition(id, pointerTarget(session, e));
    }
    setDragPos(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const step = e.shiftKey ? NUDGE_FAST : NUDGE;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[e.key];
    if (move) {
      e.preventDefault();
      setPosition(id, clampWidgetPosition({ x: pos.x + move[0], y: pos.y + move[1] }, size, viewport));
    } else if (e.key === 'Enter' && onOpen) {
      e.preventDefault();
      onOpen();
    }
  };

  const hide = () => {
    setEnabled(id, false);
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: `${label} widget hidden`,
      message: 'Turn it back on from the desktop right-click menu or Settings.',
    });
  };

  const dragging = dragPos !== null;

  return (
    <div
      role="group"
      tabIndex={hidden ? -1 : 0}
      aria-label={`${label} widget. Arrow keys move it${onOpen ? ', Enter opens it' : ''}.`}
      // inert: while faded out, nothing inside is focusable or clickable
      inert={hidden}
      title={openHint}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onOpen}
      onKeyDown={onKeyDown}
      className={cn(
        'group absolute armor-window rivets select-none touch-none [--cut:12px] [--rivet-inset:6px]',
        'transition-[opacity,box-shadow] duration-260 ease-out-quint outline-none',
        // Focus / drag heat the plate's edge (inset: survives the chamfer clip)
        'focus-visible:ember-edge',
        dragging ? 'cursor-grabbing ember-edge' : 'cursor-grab',
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto',
        className
      )}
      style={{
        left: pos.x,
        top: pos.y,
        width,
        height,
        transform: dragging ? 'scale(1.015)' : undefined,
      }}
    >
      {/* Header: HUD label + drag hint + close */}
      <div className="flex h-8 items-center justify-between pl-4 pr-1.5 pt-1">
        <span className="engraved flex min-w-0 items-center gap-1.5 font-display text-2xs font-semibold uppercase tracking-[0.18em] text-fg-subtle">
          {/* Ember tick: the plate's stamp mark */}
          <span aria-hidden="true" className="h-2.5 w-[3px] shrink-0 bg-linear-to-b from-ember-300 to-ember-600" />
          <span className="truncate">{label}</span>
          <GripVertical
            size={12}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-fg-faint opacity-0 transition-opacity duration-120 group-hover:opacity-100"
          />
        </span>
        <IconButton
          icon={X}
          size="xs"
          onClick={hide}
          aria-label={`Hide ${label} widget`}
          tooltip="Hide widget"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>
      <div className="px-4 pb-3">{children}</div>
    </div>
  );
}

export const DraggableWidget = memo(DraggableWidgetInner);
