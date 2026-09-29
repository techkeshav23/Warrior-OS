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
import { ChevronDown, ChevronRight, ChevronUp, DoorOpen, Map as MapIcon, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BEVEL_SUNK, ENGRAVED_LABEL, SLOT_FILL } from '@/components/ui/armor';
import { Button, IconButton } from '@/components/ui';
import { LINE } from '@/styles/tokens';
import { PALACE } from './palaceTheme';
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
      <div className="armor-popover rivets pointer-events-auto absolute right-3 top-3 z-20 p-2 [--cut:12px] [--cut-tl:0px] [--cut-br:0px] [--rivet-inset:1px]">
        <div className="flex items-center justify-between gap-2 pl-1">
          <span className={cn(ENGRAVED_LABEL, 'flex items-center gap-1.5')}>
            <MapIcon size={14} strokeWidth={1.75} aria-hidden /> Palace map
          </span>
          <IconButton
            icon={collapsed ? ChevronDown : ChevronUp}
            size="xs"
            aria-label={collapsed ? 'Show the map' : 'Hide the map'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((c) => !c)}
          />
        </div>
        {!collapsed && (
          <div
            className={cn('chamfer-sm relative mt-2', SLOT_FILL, BEVEL_SUNK)}
            style={{ width: w * scale, height: mapH }}
          >
            <svg width={w * scale} height={mapH} className="absolute inset-0" aria-hidden>
              {/* Entrance hall */}
              {(() => {
                const [x0, y0] = toPx(-6, -5);
                return (
                  <rect
                    x={x0}
                    y={y0}
                    width={12 * scale}
                    height={10 * scale}
                    rx={0}
                    fill={LINE.base}
                    stroke={LINE.strong}
                    strokeWidth={1}
                  />
                );
              })()}
              {/* Corridor */}
              {(() => {
                const [x0, y0] = toPx(corridor.x0, corridor.z0);
                const [x1, y1] = toPx(corridor.x1, corridor.z1);
                return <rect x={x0} y={y0} width={x1 - x0} height={Math.max(0, y1 - y0)} fill={LINE.base} />;
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
                      rx={0}
                      fill={`color-mix(in oklab, ${PALACE.hall} 10%, transparent)`}
                      stroke={`color-mix(in oklab, ${PALACE.hall} 55%, transparent)`}
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
                  type="button"
                  onClick={() => onTeleport(r.key)}
                  disabled={flying || underConstruction}
                  title={`${r.label} · ${r.objectCount} object${r.objectCount === 1 ? '' : 's'}${r.dueCount ? ` · ${r.dueCount} due` : ''}`}
                  aria-label={`Fly to ${r.label}`}
                  className={cn(
                    'focus-ring absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border font-mono text-[7px] font-semibold leading-none',
                    'transition-[transform,background-color] duration-120 ease-out-quint disabled:cursor-default',
                    !flying && !underConstruction && 'hover:z-10 hover:scale-110',
                    underConstruction && 'border-dashed motion-safe:animate-pulse-soft'
                  )}
                  style={{
                    left: cx,
                    top: cy,
                    width: Math.max(10, roomPx - 2),
                    height: Math.max(10, roomPx - 2),
                    backgroundColor: `color-mix(in oklab, ${r.accent} ${isHere ? 34 : 14}%, transparent)`,
                    borderColor: isHere ? r.accent : `color-mix(in oklab, ${r.accent} 50%, transparent)`,
                    color: r.accent,
                    boxShadow: isHere ? `0 0 10px -2px ${r.accent}` : undefined,
                  }}
                >
                  {roomPx > 16 ? r.short : ''}
                  {r.dueCount > 0 && (
                    <span className="absolute -right-1 -top-1 size-2 rounded-full bg-danger ring-2 ring-steel-950" aria-hidden />
                  )}
                </button>
              );
            })}

            {/* Player (lucide's arrow points north-east → -45°) */}
            <div
              className="pointer-events-none absolute"
              style={{ left: px, top: py, transform: `translate(-50%, -50%) rotate(${(-heading * 180) / Math.PI - 45}deg)` }}
            >
              <Navigation size={12} strokeWidth={2} className="fill-ember-400 text-ember-300 drop-shadow-[0_0_4px_var(--color-ember-500)]" aria-hidden />
            </div>
          </div>
        )}
        {!collapsed && (
          <div className="mt-2">
            <Button size="sm" variant="ghost" leadingIcon={DoorOpen} fullWidth onClick={onTeleportHome} disabled={flying}>
              Return to entrance
            </Button>
          </div>
        )}
      </div>

      {/* ── Breadcrumb trail (bottom-left) ── */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Rooms visited"
          className="armor-popover pointer-events-auto absolute bottom-3 left-3 z-20 flex max-w-[55%] flex-wrap items-center gap-0.5 py-1 pl-3 pr-2 [--cut:8px] [--cut-tr:0px] [--cut-bl:0px]"
        >
          <span className={cn(ENGRAVED_LABEL, 'mr-1.5')}>Trail</span>
          {breadcrumbs.map((b, i) => {
            const here = b.key === currentRoomKey;
            return (
              <span key={`${b.key}-${i}`} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onTeleport(b.key)}
                  disabled={flying || here}
                  aria-current={here ? 'location' : undefined}
                  className={cn(
                    'focus-ring-inset chamfer-xs flex h-6 max-w-40 items-center gap-1.5 px-1.5 text-xs transition-colors duration-120 ease-out-quint',
                    here ? 'cursor-default bg-steel-700 text-fg shadow-[inset_0_-2px_0_var(--color-ember-500)]' : 'text-fg-muted hover:bg-steel-700 hover:text-ember-200 disabled:opacity-60'
                  )}
                  title={b.label}
                >
                  <span className="size-1.5 shrink-0 rotate-45" style={{ backgroundColor: b.accent }} aria-hidden />
                  <span className="truncate">{b.label}</span>
                </button>
                {i < breadcrumbs.length - 1 && (
                  <ChevronRight size={12} strokeWidth={1.75} className="shrink-0 text-fg-faint" aria-hidden />
                )}
              </span>
            );
          })}
        </nav>
      )}
    </>
  );
}

export const PalaceNavigation = memo(PalaceNavigationInner);
