// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Navigation
// Corner minimap (top-down), room labels, click-to-teleport,
// breadcrumb trail of visited rooms. DOM overlay (outside Canvas).
// ═══════════════════════════════════════════════════════════

'use client';

import { cn } from '@/lib/utils';
import type { RoomTheme } from './PalaceRoomGenerator';

export interface RoomLayout {
  theme: RoomTheme;
  /** world center [x, z] */
  origin: [number, number];
  noteCount: number;
}

interface PalaceNavigationProps {
  rooms: RoomLayout[];
  /** current player world position [x, z] */
  playerPos: [number, number];
  /** ids (subjects) of visited rooms, in visit order */
  breadcrumbs: string[];
  onTeleport: (origin: [number, number]) => void;
}

export function PalaceNavigation({ rooms, playerPos, breadcrumbs, onTeleport }: PalaceNavigationProps) {
  // Compute bounds to normalize world coords → minimap px
  const xs = rooms.map((r) => r.origin[0]);
  const zs = rooms.map((r) => r.origin[1]);
  const minX = Math.min(...xs, playerPos[0]) - 10;
  const maxX = Math.max(...xs, playerPos[0]) + 10;
  const minZ = Math.min(...zs, playerPos[1]) - 10;
  const maxZ = Math.max(...zs, playerPos[1]) + 10;
  const W = 150;
  const H = 150;

  const toPx = (x: number, z: number): [number, number] => {
    const px = ((x - minX) / (maxX - minX || 1)) * W;
    const py = ((z - minZ) / (maxZ - minZ || 1)) * H;
    return [px, py];
  };

  return (
    <>
      {/* Minimap — top-right corner */}
      <div className="pointer-events-auto absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 p-2 backdrop-blur-sm">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/50">Palace Map</div>
        <div className="relative" style={{ width: W, height: H }}>
          {rooms.map((r) => {
            const [px, py] = toPx(r.origin[0], r.origin[1]);
            const visited = breadcrumbs.includes(r.theme.subject);
            return (
              <button
                key={r.theme.subject}
                onClick={() => onTeleport(r.origin)}
                title={`${r.theme.label} · ${r.noteCount} notes`}
                className={cn(
                  'absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded border transition-all hover:scale-125',
                  visited ? 'border-white/40' : 'border-white/15'
                )}
                style={{
                  left: px,
                  top: py,
                  backgroundColor: `${r.theme.accent}22`,
                  boxShadow: visited ? `0 0 6px ${r.theme.accent}` : 'none',
                }}
              >
                <span className="text-[8px] leading-none text-white/70">{r.theme.subject.slice(0, 3)}</span>
              </button>
            );
          })}
          {/* player marker */}
          {(() => {
            const [px, py] = toPx(playerPos[0], playerPos[1]);
            return (
              <div
                className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-primary shadow-[0_0_8px_var(--color-accent-primary,#00f0ff)]"
                style={{ left: px, top: py }}
              />
            );
          })()}
        </div>
      </div>

      {/* Breadcrumb trail — bottom-left */}
      {breadcrumbs.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[70%] flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2 py-1 backdrop-blur-sm">
          <span className="text-[10px] text-white/40">Trail:</span>
          {breadcrumbs.map((b, i) => (
            <span key={`${b}-${i}`} className="flex items-center text-[10px] text-white/70">
              {b}
              {i < breadcrumbs.length - 1 && <span className="mx-0.5 text-white/30">→</span>}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
