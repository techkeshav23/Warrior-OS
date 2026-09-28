// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Navigation (spec 6.26)
// DOM overlay (outside the Canvas):
//   • corner minimap — top-down view of every built room, the corridor,
//     wing archways and the grand hall, with the player's position + heading
//   • click a room → teleport (the camera flies through the corridors)
//   • breadcrumb trail of visited rooms (click to fly back)
// Room labels above the doorways are 3D signs (PalaceRoomGenerator).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CORR_HALF, ROOM_SIZE, WALL_T, type PalaceLayout } from './PalaceGrowth';

export interface RoomLayout {
  key: string;
  label: string;
  /** Room group ('deck:…', 'tag:…', 'projects'…). */
  group: string;
  /** Up to 3 letters drawn on the minimap tile. */
  short: string;
  accent: string;
  center: [number, number];
  objectCount: number;
  dueCount: number;
}

export interface Breadcrumb {
  key: string;
  label: string;
  accent: string;
}

interface PalaceNavigationProps {
  layout: PalaceLayout;
  rooms: RoomLayout[];
  /** Units still being built (drawn as scaffolding). */
  building: ReadonlySet<string>;
  playerPos: [number, number];
  /** Camera yaw (radians, 0 = looking toward -z). */
  heading: number;
  currentRoomKey: string | null;
  breadcrumbs: Breadcrumb[];
  flying: boolean;
  onTeleport: (roomKey: string) => void;
  onTeleportHome: () => void;
}

const MAP_W = 168;
const MAP_MAX_H = 230;

function PalaceNavigationInner({
  layout,
  rooms,
  building,
  playerPos,
  heading,
  currentRoomKey,
  breadcrumbs,
  flying,
  onTeleport,
  onTeleportHome,
}: PalaceNavigationProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const w = maxX - minX || 1;
  const h = maxZ - minZ || 1;
  const scale = Math.min(MAP_W / w, MAP_MAX_H / h);
  const mapH = h * scale;
  const toPx = (x: number, z: number): [number, number] => [(x - minX) * scale, (z - minZ) * scale];

  const corridor = useMemo(() => {
    const top = layout.hall ? layout.hall.center[1] + layout.hall.size / 2 : layout.corridorEndZ;
    return { x0: -CORR_HALF - WALL_T, x1: CORR_HALF + WALL_T, z0: top, z1: -5 };
  }, [layout]);

  const [px, py] = toPx(playerPos[0], playerPos[1]);
  const roomPx = ROOM_SIZE * scale;

  return (
    <>
      {/* ── Minimap (top-right) ── */}
      <div className="pointer-events-auto absolute right-3 top-3 z-20 rounded-xl border border-white/10 bg-black/65 p-2 shadow-xl backdrop-blur-md">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 hover:text-white/80"
        >
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Palace map
          </span>
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>
        {!collapsed && (
          <div className="relative mt-1.5" style={{ width: w * scale, height: mapH }}>
            <svg width={w * scale} height={mapH} className="absolute inset-0">
              {/* Entrance hall */}
              {(() => {
                const [x0, y0] = toPx(-6, -5);
                return <rect x={x0} y={y0} width={12 * scale} height={10 * scale} rx={2} fill="#ffffff10" stroke="#ffffff30" strokeWidth={1} />;
              })()}
              {/* Corridor */}
              {(() => {
                const [x0, y0] = toPx(corridor.x0, corridor.z0);
                const [x1, y1] = toPx(corridor.x1, corridor.z1);
                return <rect x={x0} y={y0} width={x1 - x0} height={Math.max(0, y1 - y0)} fill="#ffffff0d" />;
              })()}
              {/* Grand hall */}
              {layout.hall &&
                (() => {
                  const s = layout.hall.size / 2;
                  const [x0, y0] = toPx(layout.hall.center[0] - s, layout.hall.center[1] - s);
                  return (
                    <rect
                      x={x0}
                      y={y0}
                      width={layout.hall.size * scale}
                      height={layout.hall.size * scale}
                      rx={3}
                      fill="#ffd74014"
                      stroke="#ffd74080"
                      strokeDasharray={building.has('hall') ? '3 2' : undefined}
                    />
                  );
                })()}
            </svg>

            {/* Rooms (clickable) */}
            {rooms.map((r) => {
              const [cx, cy] = toPx(r.center[0], r.center[1]);
              const isHere = r.key === currentRoomKey;
              const underConstruction = building.has(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => onTeleport(r.key)}
                  disabled={flying || underConstruction}
                  title={`${r.label} · ${r.objectCount} object${r.objectCount === 1 ? '' : 's'}${r.dueCount ? ` · ${r.dueCount} due` : ''}`}
                  className={cn(
                    'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] border text-[7px] font-bold leading-none transition-transform',
                    !flying && !underConstruction && 'hover:z-10 hover:scale-110',
                    underConstruction && 'animate-pulse border-dashed'
                  )}
                  style={{
                    left: cx,
                    top: cy,
                    width: Math.max(10, roomPx - 2),
                    height: Math.max(10, roomPx - 2),
                    backgroundColor: `${r.accent}${isHere ? '55' : '22'}`,
                    borderColor: isHere ? r.accent : `${r.accent}77`,
                    color: r.accent,
                    boxShadow: isHere ? `0 0 8px ${r.accent}` : undefined,
                  }}
                >
                  {roomPx > 16 ? r.short : ''}
                  {r.dueCount > 0 && (
                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent-danger shadow-[0_0_4px_#ff1744]" />
                  )}
                </button>
              );
            })}

            {/* Player (lucide's arrow points north-east → -45°) */}
            <div
              className="pointer-events-none absolute"
              style={{ left: px, top: py, transform: `translate(-50%, -50%) rotate(${(-heading * 180) / Math.PI - 45}deg)` }}
            >
              <Navigation className="h-3 w-3 fill-accent-primary text-accent-primary drop-shadow-[0_0_4px_#00f0ff]" />
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onTeleportHome}
            disabled={flying}
            className="mt-1.5 w-full rounded-md bg-white/5 py-1 text-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            Return to entrance
          </button>
        )}
      </div>

      {/* ── Breadcrumb trail (bottom-left) ── */}
      {breadcrumbs.length > 0 && (
        <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex max-w-[60%] flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2 py-1 backdrop-blur-md">
          <span className="mr-0.5 text-[9px] font-bold uppercase tracking-widest text-white/35">Trail</span>
          {breadcrumbs.map((b, i) => (
            <span key={`${b.key}-${i}`} className="flex items-center">
              <button
                onClick={() => onTeleport(b.key)}
                disabled={flying || b.key === currentRoomKey}
                className="rounded px-1 text-[10px] transition-colors hover:bg-white/10 disabled:cursor-default"
                style={{ color: b.key === currentRoomKey ? b.accent : `${b.accent}bb` }}
              >
                {b.label}
              </button>
              {i < breadcrumbs.length - 1 && <span className="text-[10px] text-white/25">›</span>}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export const PalaceNavigation = memo(PalaceNavigationInner);
