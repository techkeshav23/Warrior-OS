// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Workspace Manager
// Manages 3 workspaces (Study/Build/Chill) and the workspace switcher
// plate above the taskbar (a riveted steel bar of cut segments; the
// active one is heated with an ember seam).
//
// Switch transition: the old face turns away in 3D (a quick,
// accelerating quarter-cube turn that fades), then the new face fades
// in flat. Two hard rules keep windows healthy:
//  • At rest the workspace has NO 3D context (no perspective,
//    preserve-3d, transform or opacity < 1): Chromium can't run a
//    window's backdrop-filter blur inside one, so perspective is only
//    applied while a switch animates.
//  • The entering face is never transformed: react-rnd measures a
//    window's offset from its parent when it mounts, and a rotated /
//    scaled parent put windows off-screen (y ≈ -207) after a round trip.
// Positions of the windows in the workspace being entered are also
// clamped into the visible desktop (below the top edge, title bar above
// the taskbar), as a safety net.
//
// Looks: the active workspace's wallpaper + accent are applied on mount,
// on switch and whenever a look changes. Until a look has been saved
// (first run on a device) the current on-screen look is saved into the
// active workspace instead of painting the defaults over it. With
// adaptive wallpaper on, mount (unlock) and switch paint the time-of-day
// wallpaper instead, and look edits leave the wallpaper alone.
//
// DOM hooks: [data-workspace-root] (mounted once) holds the current
// [data-workspace-face]; layers that must stack between the desktop
// surface and the windows portal into the face (see ghost/WorkspaceLayer).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useWindowStore } from '@/stores/useWindowStore';
import { adaptiveWallpaperId } from '@/hooks/useAdaptiveWallpaper';
import { useLiteMode } from '@/lib/lite-mode';
import { EASE_OUT_QUINT, resolveAccent } from '@/styles/tokens';
import { Tooltip } from '@/components/ui/Tooltip';
import type { WorkspaceId } from '@/types/workspace';
import { cn } from '@/lib/utils';

interface WorkspaceManagerProps {
  children: (workspaceId: WorkspaceId) => React.ReactNode;
}

// Rotation direction for 3D cube transition
const WORKSPACE_ORDER: WorkspaceId[] = ['study', 'build', 'chill'];

/** Accelerating exit, decelerating entrance: no overshoot. */
const EASE_IN_QUINT = [0.64, 0, 0.78, 0] as const;

/** Taskbar height + a window title bar: what must stay reachable. */
const TASKBAR_H = 48;
const TITLE_BAR_H = 44;
/** Keep at least this much of a window on screen horizontally. */
const MIN_VISIBLE_X = 120;

function getRotation(from: WorkspaceId, to: WorkspaceId): number {
  const fromIdx = WORKSPACE_ORDER.indexOf(from);
  const toIdx = WORKSPACE_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return 0;
  const diff = toIdx - fromIdx;
  // Choose shortest path
  if (diff === 0) return 0;
  if (diff === 1 || diff === -2) return -90;
  return 90;
}

interface CubeTurn {
  /** ±90 (direction of travel) or 0 */
  turn: number;
  /** Crossfade only (lite mode / reduced motion) */
  flat: boolean;
}

const CUBE_VARIANTS: Variants = {
  // Flat on purpose: windows mount inside this face (see header).
  enter: { opacity: 0 },
  center: ({ flat }: CubeTurn) => ({
    opacity: 1,
    transition: { duration: flat ? 0.18 : 0.26, ease: EASE_OUT_QUINT },
  }),
  exit: ({ turn, flat }: CubeTurn) =>
    flat || turn === 0
      ? { opacity: 0, transition: { duration: 0.12, ease: EASE_IN_QUINT } }
      : {
          rotateY: turn * 0.4,
          scale: 0.96,
          opacity: 0,
          transition: { duration: 0.2, ease: EASE_IN_QUINT },
        },
};

/** Pull the windows of a workspace back inside the visible desktop. */
function clampWorkspaceWindows(workspaceId: string) {
  if (typeof window === 'undefined') return;
  const { windows, updatePosition } = useWindowStore.getState();
  const maxX = window.innerWidth - MIN_VISIBLE_X;
  const maxY = Math.max(0, window.innerHeight - TASKBAR_H - TITLE_BAR_H);
  for (const win of windows) {
    if (win.workspaceId !== workspaceId || win.isMaximized) continue;
    const x = Math.min(Math.max(win.position.x, MIN_VISIBLE_X - win.size.width), maxX);
    const y = Math.min(Math.max(win.position.y, 0), maxY);
    if (x !== win.position.x || y !== win.position.y) updatePosition(win.id, { x, y });
  }
}

function WorkspaceManagerInner({ children }: WorkspaceManagerProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setWallpaper = useSettingsStore((s) => s.setWallpaper);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const adaptiveWallpaper = useSettingsStore((s) => s.adaptiveWallpaper);
  const lite = useLiteMode();
  const reduceMotion = useReducedMotion() ?? false;
  const flat = lite || reduceMotion;

  // "Store previous state during render" pattern — official React 19 way to
  // derive a value from the prev→current transition without reading refs in render.
  // When activeWorkspaceId changes, the setStates fire, React aborts the in-flight
  // render and re-runs with prev=current and rotation=computed, in one paint.
  const [prevWorkspace, setPrevWorkspace] = useState(activeWorkspaceId);
  const [rotation, setRotation] = useState(0);
  // True only while a switch animates: the root gets its perspective then.
  const [turning, setTurning] = useState(false);

  if (prevWorkspace !== activeWorkspaceId) {
    setRotation(getRotation(prevWorkspace, activeWorkspaceId));
    setPrevWorkspace(activeWorkspaceId);
    setTurning(true);
  }

  // Workspace whose look was last applied: tells a mount/switch apart from
  // a look edit.
  const paintedWorkspaceRef = useRef<WorkspaceId | null>(null);

  // Apply the active workspace's look (mount, switch, and look edits).
  useEffect(() => {
    const store = useWorkspaceStore.getState();
    const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
    if (!workspace) return;
    const entering = paintedWorkspaceRef.current !== activeWorkspaceId;
    paintedWorkspaceRef.current = activeWorkspaceId;
    if (!store.looksSaved) {
      // First run on this device: what's on screen becomes this look.
      const { wallpaper, accentColor } = useSettingsStore.getState();
      store.updateWorkspace(activeWorkspaceId, { wallpaper, accentColor });
      return;
    }
    if (!adaptiveWallpaper) setWallpaper(workspace.wallpaper);
    // Adaptive owns the wallpaper: time-of-day on entry; a look edit (e.g. a
    // manual pick, kept until the next time-of-day shift) is left alone.
    else if (entering) setWallpaper(adaptiveWallpaperId());
    setAccentColor(workspace.accentColor);
  }, [activeWorkspaceId, workspaces, adaptiveWallpaper, setWallpaper, setAccentColor]);

  // Windows of the workspace being entered stay reachable.
  useEffect(() => {
    clampWorkspaceWindows(activeWorkspaceId);
  }, [activeWorkspaceId]);

  // `custom` reaches the exiting face too, so it turns the right way.
  const turn: CubeTurn = { turn: flat ? 0 : rotation, flat };

  return (
    <div
      data-workspace-root=""
      className="relative w-full h-full"
      style={turning && !flat ? { perspective: '1600px' } : undefined}
    >
      <AnimatePresence mode="wait" custom={turn}>
        <motion.div
          key={activeWorkspaceId}
          data-workspace-face={activeWorkspaceId}
          custom={turn}
          variants={CUBE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          onAnimationComplete={(definition) => {
            if (definition === 'center') setTurning(false);
          }}
          className="absolute inset-0"
        >
          {children(activeWorkspaceId)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Workspace switcher plate ───
// A segmented control: each segment shows the workspace's color, name and
// how many windows are open there. The active segment sits on a sliding
// thumb. Ctrl+1/2/3 are the keyboard shortcuts (tooltips say so).
interface WorkspaceDotsProps {
  className?: string;
}

function WorkspaceDotsInner({ className }: WorkspaceDotsProps) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const windows = useWindowStore((s) => s.windows);
  const reduceMotion = useReducedMotion() ?? false;

  const counts = useMemo(() => {
    const byWorkspace: Record<string, number> = {};
    for (const w of windows) byWorkspace[w.workspaceId] = (byWorkspace[w.workspaceId] ?? 0) + 1;
    return byWorkspace;
  }, [windows]);

  const handleSwitch = useCallback(
    (id: WorkspaceId) => {
      switchWorkspace(id);
    },
    [switchWorkspace]
  );

  return (
    <div role="group" aria-label="Workspaces" className={cn('armor-drop', className)}>
      <div className="armor-popover flex items-center gap-0.5 p-1 [--cut:8px]">
        {workspaces.map((ws, index) => {
          const isActive = ws.id === activeWorkspaceId;
          const color = resolveAccent(ws.accentColor);
          const count = counts[ws.id] ?? 0;
          const countLabel = count === 0 ? 'no windows' : `${count} window${count === 1 ? '' : 's'}`;
          return (
            <Tooltip
              key={ws.id}
              content={`${ws.name} · ${countLabel}`}
              shortcut={index < 9 ? `Ctrl ${index + 1}` : undefined}
              side="top"
            >
              <button
                type="button"
                onClick={() => handleSwitch(ws.id as WorkspaceId)}
                className={cn(
                  'relative flex h-7 items-center gap-2 chamfer [--cut:5px] pl-2.5 pr-3',
                  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  'font-display text-xs font-semibold uppercase tracking-[0.08em] transition-colors duration-120 ease-out-quint',
                  isActive ? 'text-fg' : 'text-fg-subtle hover:bg-white/[0.045] hover:text-fg-muted'
                )}
                style={{ '--ws': color } as CSSProperties}
                aria-label={`Switch to ${ws.name} workspace`}
                aria-current={isActive ? 'true' : undefined}
              >
                {isActive && (
                  <motion.span
                    layoutId="workspace-switcher-thumb"
                    aria-hidden
                    className="absolute inset-0 bg-linear-to-b from-steel-600 to-steel-750 shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-2px_0_var(--color-ember-400,#ff8a3d),inset_0_-10px_12px_-10px_rgb(247_107_21/0.6)]"
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: EASE_OUT_QUINT }}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    'relative size-1.5 shrink-0 rounded-full bg-(--ws) transition-[opacity,box-shadow] duration-180 ease-out-quint',
                    isActive
                      ? 'shadow-[0_0_0_3px_color-mix(in_oklab,var(--ws)_18%,transparent),0_0_10px_color-mix(in_oklab,var(--ws)_70%,transparent)]'
                      : 'opacity-55'
                  )}
                />
                <span className="relative">{ws.name}</span>
                {count > 0 && (
                  <span
                    aria-hidden
                    className={cn(
                      'relative -mr-1 flex h-4 min-w-4 items-center justify-center chamfer [--cut:3px] px-1 font-mono text-[10px] font-normal leading-none tabular',
                      isActive ? 'bg-ink-950/70 text-fg' : 'bg-black/40 text-fg-subtle'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

export const WorkspaceManager = memo(WorkspaceManagerInner);
export const WorkspaceDots = memo(WorkspaceDotsInner);
