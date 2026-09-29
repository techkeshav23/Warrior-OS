// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Growth + Layout
// The palace grows with everything you keep in it (spec 6.28) —
// notes, deck cards and projects are all "objects":
//   • starts with 3 foundation rooms (notes · decks · projects)
//   • every 10 objects → a new room is unlocked
//   • every 50 objects → the corridor is extended (+ pillars, lanterns)
//   • every 10 rooms → a new wing behind an archway
//   • 500+ objects → a Grand Hall with a chandelier and statues
// New structures are built brick by brick (<GrowthBuilder/>).
// Also computes the full walkable layout: vestibule, corridor, rooms,
// wing archways, extensions, grand hall, colliders and signs.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { roomTheme, type PalaceContentType, type PalaceGroup, type PalaceItem, type RoomTheme } from './palaceData';
import { PALACE } from './palaceTheme';

// ─────────────────────────────────────────────────────────────
// Dimensions (world units ≈ metres)
// ─────────────────────────────────────────────────────────────

export const ROOM_SIZE = 12;
export const WALL_T = 0.3;
export const WALL_H = 5;
export const DOOR_W = 3;
export const DOOR_H = 3.4;
export const CORR_HALF = 2;
export const ROW_PITCH = ROOM_SIZE + 2 * WALL_T; // 12.6
export const ROOMS_PER_WING = 10;
export const ROWS_PER_WING = ROOMS_PER_WING / 2;
export const WING_GAP = 6;
export const MAX_ROOMS = 40;
export const EXT_SEGMENT = 4;
export const MAX_EXT_SEGMENTS = 6;
export const HALL_SIZE = 24;
export const HALL_H = 10;
export const EYE_HEIGHT = 1.7;

const HALF = ROOM_SIZE / 2;
const ROOM_CX = CORR_HALF + WALL_T + HALF; // 8.3
const OUTER_X = CORR_HALF + WALL_T + ROOM_SIZE; // 14.3 (inner face of the outer wall)
const VEST_HALF_W = 6;
const VEST_HALF_D = 5;
const Z0 = -(VEST_HALF_D + WALL_T); // corridor starts here (-5.3)
const STONE: string = PALACE.stone;
const CORRIDOR_FLOOR: string = PALACE.floor;

// ─────────────────────────────────────────────────────────────
// Growth tiers
// ─────────────────────────────────────────────────────────────

export interface PalaceGrowthState {
  /** Notes + deck cards + projects in the palace. */
  objectCount: number;
  /** Rooms unlocked: 3 foundation rooms + one per 10 objects (max 40). */
  roomSlots: number;
  /** Wings of 10 rooms each. */
  wings: number;
  /** Corridor tier: +1 every 50 objects (extensions, pillars, lanterns). */
  corridorTier: number;
  extensionSegments: number;
  grandHall: boolean;
  nextRoomAt: number | null;
  nextCorridorAt: number | null;
  nextWingAt: number | null;
  grandHallAt: number;
}

export const BASE_ROOMS = 3;
export const OBJECTS_PER_ROOM = 10;
export const OBJECTS_PER_CORRIDOR = 50;
export const GRAND_HALL_OBJECTS = 500;

export function computePalaceGrowth(objectCount: number): PalaceGrowthState {
  const n = Math.max(0, objectCount);
  const roomSlots = Math.min(MAX_ROOMS, BASE_ROOMS + Math.floor(n / OBJECTS_PER_ROOM));
  const wings = Math.ceil(roomSlots / ROOMS_PER_WING);
  const corridorTier = Math.floor(n / OBJECTS_PER_CORRIDOR);
  const extensionSegments = Math.min(MAX_EXT_SEGMENTS, corridorTier);
  // Objects at which the slot count reaches `slots`.
  const objectsFor = (slots: number) => (slots - BASE_ROOMS) * OBJECTS_PER_ROOM;
  return {
    objectCount: n,
    roomSlots,
    wings,
    corridorTier,
    extensionSegments,
    grandHall: n >= GRAND_HALL_OBJECTS,
    nextRoomAt: roomSlots >= MAX_ROOMS ? null : objectsFor(roomSlots + 1),
    nextCorridorAt: corridorTier >= MAX_EXT_SEGMENTS ? null : (corridorTier + 1) * OBJECTS_PER_CORRIDOR,
    nextWingAt: wings >= MAX_ROOMS / ROOMS_PER_WING ? null : objectsFor(wings * ROOMS_PER_WING + 1),
    grandHallAt: GRAND_HALL_OBJECTS,
  };
}

// ─────────────────────────────────────────────────────────────
// Room allocation
// ─────────────────────────────────────────────────────────────

export interface PalaceRoomSpec {
  /** Stable id: `${group}#${ordinal}`. */
  key: string;
  /** Room group key ('deck:…', 'tag:…', 'projects', 'starter:…'). */
  group: string;
  contentType: PalaceContentType;
  /** 1 for a group's first room, 2+ for overflow rooms. */
  ordinal: number;
  label: string;
  theme: RoomTheme;
  items: PalaceItem[];
  /** Floating words of the group (titles, topics, project names). */
  words: string[];
  /** Empty starter room (no content of its type yet). */
  starter: boolean;
  hint: string | null;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function roman(n: number): string {
  return ROMAN[n] ?? String(n);
}

function bySince(a: PalaceGroup, b: PalaceGroup): number {
  if (a.since !== b.since) return a.since < b.since ? -1 : 1;
  return a.key.localeCompare(b.key);
}

/**
 * Hand out the unlocked room slots. Groups claim rooms in the order you
 * started them (oldest content first, starter rooms last), so rooms keep
 * their places as the palace grows; spare slots become overflow rooms
 * for the fullest group. Objects of groups still waiting for a room sit
 * on the archive table in the entrance hall.
 */
export function allocateRooms(
  groups: readonly PalaceGroup[],
  slots: number
): { rooms: PalaceRoomSpec[]; unhoused: PalaceItem[] } {
  const order = [...groups].sort(bySince);
  const roomsPer = new Map<string, number>();
  let used = 0;
  for (const g of order) {
    if (used >= slots) break;
    roomsPer.set(g.key, 1);
    used += 1;
  }
  const byKey = new Map(order.map((g) => [g.key, g] as const));
  const overflow: string[] = [];
  while (used < slots) {
    let best: string | null = null;
    let bestRatio = 0;
    for (const [key, k] of roomsPer) {
      const count = byKey.get(key)?.items.length ?? 0;
      // Only split when every room would still hold at least 2 objects.
      if (count < 2 * (k + 1)) continue;
      const ratio = count / k;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = key;
      }
    }
    if (!best) break;
    roomsPer.set(best, (roomsPer.get(best) ?? 1) + 1);
    overflow.push(best);
    used += 1;
  }

  const chunk = (g: PalaceGroup, ordinal: number): PalaceItem[] => {
    const k = roomsPer.get(g.key) ?? 1;
    const per = Math.ceil(g.items.length / k);
    return g.items.slice((ordinal - 1) * per, ordinal * per);
  };
  const make = (g: PalaceGroup, ordinal: number): PalaceRoomSpec => {
    const key = `${g.key}#${ordinal}`;
    return {
      key,
      group: g.key,
      contentType: g.contentType,
      ordinal,
      label: ordinal > 1 ? `${g.label} ${roman(ordinal)}` : g.label,
      // Overflow rooms get a style of their own; the accent stays the group's.
      theme: roomTheme(g.contentType, ordinal > 1 ? key : g.key, { style: g.style, accent: g.accent }),
      items: chunk(g, ordinal),
      words: g.words,
      starter: g.starter === true,
      hint: g.hint ?? null,
    };
  };

  const rooms: PalaceRoomSpec[] = [];
  for (const g of order) if (roomsPer.has(g.key)) rooms.push(make(g, 1));
  const seen = new Map<string, number>();
  for (const key of overflow) {
    const g = byKey.get(key);
    if (!g) continue;
    const next = (seen.get(key) ?? 1) + 1;
    seen.set(key, next);
    rooms.push(make(g, next));
  }
  const unhoused = order.filter((g) => !roomsPer.has(g.key)).flatMap((g) => g.items);
  return { rooms, unhoused };
}

const OBJECT_NOUN: Record<PalaceContentType, [string, string]> = {
  notes: ['note', 'notes'],
  deck: ['card', 'cards'],
  projects: ['project', 'projects'],
};

function countLabel(type: PalaceContentType, n: number): string {
  return `${n} ${OBJECT_NOUN[type][n === 1 ? 0 : 1]}`;
}

/** Door signs stay legible: long deck / folder names are shortened. */
function signTitle(label: string): string {
  const t = label.trim();
  return (t.length > 26 ? `${t.slice(0, 25).trimEnd()}…` : t).toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────

export type BoxKind = 'wall' | 'floor' | 'ceiling' | 'trim' | 'glow' | 'pillar';

/** Axis-aligned box of the palace structure. */
export interface StructureBox {
  /** Build unit: 'static', a room key, 'ext#n', 'wing#n' or 'hall'. */
  unit: string;
  kind: BoxKind;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color: string;
  /** Blocks the player (walls, pillars). */
  solid: boolean;
}

export interface Collider {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface PlacedRoom extends PalaceRoomSpec {
  slot: number;
  row: number;
  wing: number;
  /** -1 = west of the corridor, +1 = east. */
  side: -1 | 1;
  center: [number, number];
  /** Rotation that maps room-local space (+x = toward the door) to world. */
  rotY: number;
  /** Corridor centre-line point in front of the door. */
  doorOut: [number, number];
  /** Just inside the door. */
  doorIn: [number, number];
  /** Where a fly-through stops (looking into the room). */
  viewPoint: [number, number];
}

export interface SignSpec {
  key: string;
  unit: string;
  title: string;
  sub: string;
  color: string;
  pos: [number, number, number];
  rotY: number;
  width: number;
  /** Floating text (bobs + turns slowly) instead of a mounted sign. */
  floating?: boolean;
}

export interface BuildUnit {
  key: string;
  label: string;
}

export type PalaceArea = 'room' | 'vestibule' | 'corridor' | 'hall' | 'outside';

export interface PalaceLayout {
  rooms: PlacedRoom[];
  boxes: StructureBox[];
  colliders: Collider[];
  signs: SignSpec[];
  units: BuildUnit[];
  spawn: [number, number];
  /** Archive table (entrance hall) centre for objects still waiting for a room. */
  archiveTable: [number, number];
  corridorEndZ: number;
  hall: { center: [number, number]; size: number } | null;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  unhoused: PalaceItem[];
}

/** Room-local (x toward the door, z along the corridor) → world x/z. */
export function roomToWorld(room: Pick<PlacedRoom, 'center' | 'side'>, lx: number, lz: number): [number, number] {
  const s = room.side === -1 ? 1 : -1;
  return [room.center[0] + s * lx, room.center[1] + s * lz];
}

export function rowCenterZ(row: number): number {
  return Z0 - ROW_PITCH / 2 - row * ROW_PITCH - Math.floor(row / ROWS_PER_WING) * WING_GAP;
}

function wallX(
  unit: string,
  x0: number,
  x1: number,
  z: number,
  color: string,
  opts: { y0?: number; y1?: number; solid?: boolean } = {}
): StructureBox {
  const y0 = opts.y0 ?? 0;
  const y1 = opts.y1 ?? WALL_H;
  return {
    unit,
    kind: 'wall',
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    z,
    sx: Math.abs(x1 - x0),
    sy: y1 - y0,
    sz: WALL_T,
    color,
    solid: opts.solid ?? true,
  };
}

function wallZ(
  unit: string,
  z0: number,
  z1: number,
  x: number,
  color: string,
  opts: { y0?: number; y1?: number; solid?: boolean } = {}
): StructureBox {
  const y0 = opts.y0 ?? 0;
  const y1 = opts.y1 ?? WALL_H;
  return {
    unit,
    kind: 'wall',
    x,
    y: (y0 + y1) / 2,
    z: (z0 + z1) / 2,
    sx: WALL_T,
    sy: y1 - y0,
    sz: Math.abs(z1 - z0),
    color,
    solid: opts.solid ?? true,
  };
}

function slab(
  unit: string,
  kind: 'floor' | 'ceiling',
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y: number,
  color: string
): StructureBox {
  return {
    unit,
    kind,
    x: (x0 + x1) / 2,
    y: kind === 'floor' ? y - 0.05 : y + 0.05,
    z: (z0 + z1) / 2,
    sx: Math.abs(x1 - x0),
    sy: 0.1,
    sz: Math.abs(z1 - z0),
    color,
    solid: false,
  };
}

function box(
  unit: string,
  kind: BoxKind,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
  solid = false
): StructureBox {
  return { unit, kind, x, y, z, sx, sy, sz, color, solid };
}

function darken(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return `#${c.getHexString()}`;
}

/** Everything that exists in the palace for a given allocation + growth. */
export function buildPalaceLayout(
  allocation: { rooms: PalaceRoomSpec[]; unhoused: PalaceItem[] },
  growth: PalaceGrowthState
): PalaceLayout {
  const boxes: StructureBox[] = [];
  const signs: SignSpec[] = [];
  const units: BuildUnit[] = [];
  const rooms: PlacedRoom[] = [];
  const S = 'static';

  // ── Entrance hall (vestibule) ──
  boxes.push(slab(S, 'floor', -VEST_HALF_W, VEST_HALF_W, -VEST_HALF_D, VEST_HALF_D, 0, PALACE.floorVestibule));
  boxes.push(slab(S, 'ceiling', -VEST_HALF_W, VEST_HALF_W, -VEST_HALF_D, VEST_HALF_D, WALL_H, PALACE.ceilingVestibule));
  boxes.push(wallX(S, -VEST_HALF_W - WALL_T, VEST_HALF_W + WALL_T, VEST_HALF_D + WALL_T / 2, STONE));
  boxes.push(wallZ(S, -VEST_HALF_D - WALL_T, VEST_HALF_D + WALL_T, -VEST_HALF_W - WALL_T / 2, STONE));
  boxes.push(wallZ(S, -VEST_HALF_D - WALL_T, VEST_HALF_D + WALL_T, VEST_HALF_W + WALL_T / 2, STONE));
  boxes.push(wallX(S, -VEST_HALF_W - WALL_T, -CORR_HALF - WALL_T, -VEST_HALF_D - WALL_T / 2, STONE));
  boxes.push(wallX(S, CORR_HALF + WALL_T, VEST_HALF_W + WALL_T, -VEST_HALF_D - WALL_T / 2, STONE));
  boxes.push(box(S, 'glow', 0, WALL_H - 0.35, VEST_HALF_D - 0.02, VEST_HALF_W * 2 - 0.4, 0.06, 0.04, PALACE.glow));
  // Archive table.
  const archiveTable: [number, number] = [3.4, 1.2];
  boxes.push(box(S, 'trim', archiveTable[0], 0.45, archiveTable[1], 2.6, 0.9, 1.5, PALACE.trimWood, true));
  boxes.push(box(S, 'glow', archiveTable[0], 0.92, archiveTable[1], 2.62, 0.03, 1.52, PALACE.archive));

  const totalRooms = allocation.rooms.length;
  const rows = Math.ceil(totalRooms / 2);

  // ── Rooms + corridor rows ──
  allocation.rooms.forEach((spec, slot) => {
    const row = Math.floor(slot / 2);
    const side: -1 | 1 = slot % 2 === 0 ? -1 : 1;
    const cz = rowCenterZ(row);
    const cx = side * ROOM_CX;
    const placed: PlacedRoom = {
      ...spec,
      slot,
      row,
      wing: Math.floor(slot / ROOMS_PER_WING),
      side,
      center: [cx, cz],
      rotY: side === -1 ? 0 : Math.PI,
      doorOut: [0, cz],
      doorIn: [side * (CORR_HALF + WALL_T + 1), cz],
      viewPoint: [side * (CORR_HALF + WALL_T + 3.2), cz],
    };
    rooms.push(placed);
    units.push({ key: spec.key, label: spec.label });

    const u = spec.key;
    const t = spec.theme;
    const xa = side * CORR_HALF;
    const xb = side * (OUTER_X + WALL_T);
    const xmin = Math.min(xa, xb);
    const xmax = Math.max(xa, xb);
    boxes.push(slab(u, 'floor', Math.min(side * (CORR_HALF + WALL_T), side * OUTER_X), Math.max(side * (CORR_HALF + WALL_T), side * OUTER_X), cz - HALF, cz + HALF, 0, t.floor));
    boxes.push(slab(u, 'ceiling', Math.min(side * (CORR_HALF + WALL_T), side * OUTER_X), Math.max(side * (CORR_HALF + WALL_T), side * OUTER_X), cz - HALF, cz + HALF, WALL_H, darken(t.wall, 0.55)));
    // Corridor-side wall with the doorway.
    const wx = side * (CORR_HALF + WALL_T / 2);
    boxes.push(wallZ(u, cz - HALF - WALL_T, cz - DOOR_W / 2, wx, t.wall));
    boxes.push(wallZ(u, cz + DOOR_W / 2, cz + HALF + WALL_T, wx, t.wall));
    boxes.push(wallZ(u, cz - DOOR_W / 2, cz + DOOR_W / 2, wx, t.wall, { y0: DOOR_H, solid: false }));
    // Outer, north and south walls.
    boxes.push(wallZ(u, cz - HALF - WALL_T, cz + HALF + WALL_T, side * (OUTER_X + WALL_T / 2), t.wall));
    boxes.push(wallX(u, xmin, xmax, cz - HALF - WALL_T / 2, t.wall));
    boxes.push(wallX(u, xmin, xmax, cz + HALF + WALL_T / 2, t.wall));
    // Accent glow: door frame + a strip along the back wall.
    const gx = side * (CORR_HALF - 0.03);
    boxes.push(box(u, 'glow', gx, DOOR_H / 2, cz - DOOR_W / 2, 0.05, DOOR_H, 0.05, t.accent));
    boxes.push(box(u, 'glow', gx, DOOR_H / 2, cz + DOOR_W / 2, 0.05, DOOR_H, 0.05, t.accent));
    boxes.push(box(u, 'glow', gx, DOOR_H, cz, 0.05, 0.05, DOOR_W, t.accent));
    boxes.push(box(u, 'glow', side * (OUTER_X - 0.03), WALL_H - 0.45, cz, 0.04, 0.07, ROOM_SIZE - 1, t.accent));

    signs.push({
      key: `sign:${spec.key}`,
      unit: u,
      title: signTitle(spec.label),
      sub: spec.starter ? spec.hint ?? 'Waiting for its first object' : countLabel(spec.contentType, spec.items.length),
      color: t.accent,
      pos: [side * (CORR_HALF - 0.06), DOOR_H + 0.72, cz],
      rotY: side === -1 ? Math.PI / 2 : -Math.PI / 2,
      width: 2.9,
    });
  });

  for (let row = 0; row < rows; row++) {
    const cz = rowCenterZ(row);
    boxes.push(slab(S, 'floor', -CORR_HALF - WALL_T, CORR_HALF + WALL_T, cz - ROW_PITCH / 2, cz + ROW_PITCH / 2, 0, CORRIDOR_FLOOR));
    boxes.push(slab(S, 'ceiling', -CORR_HALF, CORR_HALF, cz - ROW_PITCH / 2, cz + ROW_PITCH / 2, WALL_H, PALACE.ceiling));
    // Empty slot on this row → plain corridor wall.
    for (const side of [-1, 1] as const) {
      const slot = row * 2 + (side === -1 ? 0 : 1);
      if (slot >= totalRooms) {
        boxes.push(wallZ(S, cz - ROW_PITCH / 2, cz + ROW_PITCH / 2, side * (CORR_HALF + WALL_T / 2), STONE));
      }
    }
    // Corridor tier ≥1: pillars at every row boundary; ≥2: hanging lanterns; ≥3: carpet runner.
    if (growth.corridorTier >= 1) {
      for (const side of [-1, 1] as const) {
        boxes.push(box(S, 'pillar', side * (CORR_HALF - 0.28), WALL_H / 2, cz + ROW_PITCH / 2, 0.45, WALL_H, 0.45, PALACE.stoneLight, true));
      }
    }
    if (growth.corridorTier >= 2) {
      boxes.push(box(S, 'glow', 0, WALL_H - 0.7, cz, 0.3, 0.4, 0.3, PALACE.lamp));
    }
    if (growth.corridorTier >= 3) {
      boxes.push(box(S, 'trim', 0, 0.012, cz, 1.4, 0.02, ROW_PITCH, PALACE.carpet));
    }
    // Wing archway before the first row of every new wing.
    if (row > 0 && row % ROWS_PER_WING === 0) {
      const wing = row / ROWS_PER_WING;
      const wu = `wing#${wing + 1}`;
      const zTop = rowCenterZ(row - 1) - ROW_PITCH / 2;
      const zBottom = cz + ROW_PITCH / 2;
      units.push({ key: wu, label: `Wing ${roman(wing + 1)}` });
      boxes.push(slab(wu, 'floor', -CORR_HALF - WALL_T, CORR_HALF + WALL_T, zBottom, zTop, 0, PALACE.wingFloor));
      boxes.push(slab(wu, 'ceiling', -CORR_HALF, CORR_HALF, zBottom, zTop, WALL_H, PALACE.ceiling));
      boxes.push(wallZ(wu, zBottom, zTop, -(CORR_HALF + WALL_T / 2), PALACE.wingWall));
      boxes.push(wallZ(wu, zBottom, zTop, CORR_HALF + WALL_T / 2, PALACE.wingWall));
      const zm = (zTop + zBottom) / 2;
      for (const side of [-1, 1] as const) {
        boxes.push(box(wu, 'pillar', side * (CORR_HALF - 0.35), WALL_H / 2, zm, 0.6, WALL_H, 0.6, PALACE.wingPillar, true));
      }
      boxes.push(box(wu, 'trim', 0, WALL_H - 0.3, zm, CORR_HALF * 2, 0.6, 0.6, PALACE.wingPillar));
      boxes.push(box(wu, 'glow', 0, WALL_H - 0.62, zm + 0.31, CORR_HALF * 2 - 0.4, 0.05, 0.03, PALACE.wing));
      signs.push({
        key: `sign:${wu}`,
        unit: wu,
        title: `WING ${roman(wing + 1)}`,
        sub: `rooms ${wing * ROOMS_PER_WING + 1}–${(wing + 1) * ROOMS_PER_WING}`,
        color: PALACE.wing,
        pos: [0, WALL_H - 1.25, zm + 0.34],
        rotY: 0,
        width: 2.6,
      });
    }
  }

  // ── Corridor end, extensions, grand hall ──
  const corridorEndZ = rows > 0 ? rowCenterZ(rows - 1) - ROW_PITCH / 2 : Z0;
  let endZ = corridorEndZ;
  for (let k = 0; k < growth.extensionSegments; k++) {
    const eu = `ext#${k + 1}`;
    units.push({ key: eu, label: `Corridor extension ${k + 1}` });
    const z1 = endZ;
    const z0 = endZ - EXT_SEGMENT;
    boxes.push(slab(eu, 'floor', -CORR_HALF - WALL_T, CORR_HALF + WALL_T, z0, z1, 0, CORRIDOR_FLOOR));
    boxes.push(slab(eu, 'ceiling', -CORR_HALF, CORR_HALF, z0, z1, WALL_H, PALACE.ceiling));
    boxes.push(wallZ(eu, z0, z1, -(CORR_HALF + WALL_T / 2), STONE));
    boxes.push(wallZ(eu, z0, z1, CORR_HALF + WALL_T / 2, STONE));
    for (const side of [-1, 1] as const) {
      boxes.push(box(eu, 'pillar', side * (CORR_HALF - 0.28), WALL_H / 2, z0 + 0.3, 0.45, WALL_H, 0.45, PALACE.stoneLight, true));
    }
    boxes.push(box(eu, 'glow', 0, WALL_H - 0.7, (z0 + z1) / 2, 0.3, 0.4, 0.3, PALACE.lamp));
    endZ = z0;
  }

  const endUnit = growth.extensionSegments > 0 ? `ext#${growth.extensionSegments}` : S;
  let hall: PalaceLayout['hall'] = null;
  if (growth.grandHall) {
    const hu = 'hall';
    units.push({ key: hu, label: 'Grand Hall' });
    const zS = endZ;
    const zN = endZ - WALL_T - HALL_SIZE - WALL_T;
    const hz = (zS + zN) / 2;
    const hw = HALL_SIZE / 2;
    hall = { center: [0, hz], size: HALL_SIZE };
    boxes.push(slab(hu, 'floor', -hw, hw, zN + WALL_T, zS - WALL_T, 0, PALACE.hallFloor));
    boxes.push(slab(hu, 'ceiling', -hw, hw, zN + WALL_T, zS - WALL_T, HALL_H, PALACE.hallCeiling));
    const H = { y1: HALL_H };
    boxes.push(wallX(hu, -hw - WALL_T, -CORR_HALF - WALL_T, zS - WALL_T / 2, PALACE.hallStone, H));
    boxes.push(wallX(hu, CORR_HALF + WALL_T, hw + WALL_T, zS - WALL_T / 2, PALACE.hallStone, H));
    boxes.push(wallX(hu, -CORR_HALF - WALL_T, CORR_HALF + WALL_T, zS - WALL_T / 2, PALACE.hallStone, { y0: WALL_H, y1: HALL_H, solid: false }));
    boxes.push(wallX(hu, -hw - WALL_T, hw + WALL_T, zN + WALL_T / 2, PALACE.hallStone, H));
    boxes.push(wallZ(hu, zN, zS, -hw - WALL_T / 2, PALACE.hallStone, H));
    boxes.push(wallZ(hu, zN, zS, hw + WALL_T / 2, PALACE.hallStone, H));
    boxes.push(box(hu, 'trim', 0, 0.015, hz, 4, 0.03, HALL_SIZE - 2, PALACE.hallCarpet));
    boxes.push(box(hu, 'glow', 0, HALL_H - 0.5, zN + WALL_T + 0.03, HALL_SIZE - 2, 0.08, 0.04, PALACE.hall));
    signs.push({
      key: 'sign:hall',
      unit: hu,
      title: 'GRAND HALL',
      sub: `${growth.objectCount} objects of knowledge`,
      color: PALACE.hall,
      pos: [0, WALL_H - 0.9, zS + 0.25],
      rotY: 0,
      width: 3,
    });
  } else {
    boxes.push(wallX(endUnit, -CORR_HALF - WALL_T, CORR_HALF + WALL_T, endZ - WALL_T / 2, STONE));
  }

  // ── Signs in the entrance hall ──
  const objectCount = allocation.rooms.reduce((n, r) => n + r.items.length, 0) + allocation.unhoused.length;
  signs.push({
    key: 'sign:title',
    unit: S,
    title: 'MEMORY PALACE',
    sub: `${objectCount} objects · ${totalRooms} room${totalRooms === 1 ? '' : 's'}`,
    color: PALACE.glow,
    pos: [0, WALL_H - 0.95, -VEST_HALF_D + 0.03],
    rotY: 0,
    width: 3.6,
  });
  if (allocation.unhoused.length > 0) {
    signs.push({
      key: 'sign:archive',
      unit: S,
      title: 'AWAITING A ROOM',
      sub: `${allocation.unhoused.length} object${allocation.unhoused.length === 1 ? '' : 's'} · next room at ${growth.nextRoomAt ?? '—'} objects`,
      color: PALACE.archive,
      pos: [archiveTable[0], 1.75, archiveTable[1] - 0.55],
      rotY: 0,
      width: 2.4,
    });
  }
  if (totalRooms === 0) {
    signs.push({
      key: 'sign:empty',
      unit: S,
      title: 'AN EMPTY PALACE',
      sub: 'Write a note, build a deck or start a project',
      color: PALACE.glow,
      pos: [0, 2.2, endZ + 0.2],
      rotY: 0,
      width: 3.4,
    });
  }

  // ── Colliders + bounds ──
  const colliders: Collider[] = boxes
    .filter((b) => b.solid)
    .map((b) => ({ x0: b.x - b.sx / 2, x1: b.x + b.sx / 2, z0: b.z - b.sz / 2, z1: b.z + b.sz / 2 }));
  let minX = -VEST_HALF_W - 1;
  let maxX = VEST_HALF_W + 1;
  let minZ = endZ - (hall ? HALL_SIZE + 1 : 1);
  const maxZ = VEST_HALF_D + 1;
  if (totalRooms > 0) {
    minX = Math.min(minX, -(OUTER_X + 1));
    if (totalRooms > 1) maxX = Math.max(maxX, OUTER_X + 1);
  }
  if (hall) {
    minX = Math.min(minX, -HALL_SIZE / 2 - 1);
    maxX = Math.max(maxX, HALL_SIZE / 2 + 1);
    minZ = Math.min(minZ, hall.center[1] - HALL_SIZE / 2 - 1);
  }

  return {
    rooms,
    boxes,
    colliders,
    signs,
    units,
    spawn: [0, 2.6],
    archiveTable,
    corridorEndZ: endZ,
    hall,
    bounds: { minX, maxX, minZ, maxZ },
    unhoused: allocation.unhoused,
  };
}

/** Which room / area a world point is in. */
export function locate(layout: PalaceLayout, x: number, z: number): { roomKey: string | null; area: PalaceArea } {
  for (const r of layout.rooms) {
    if (Math.abs(x - r.center[0]) < HALF + WALL_T && Math.abs(z - r.center[1]) < HALF + WALL_T) {
      return { roomKey: r.key, area: 'room' };
    }
  }
  if (Math.abs(x) <= VEST_HALF_W && z >= -VEST_HALF_D && z <= VEST_HALF_D) return { roomKey: null, area: 'vestibule' };
  if (layout.hall) {
    const [hx, hz] = layout.hall.center;
    if (Math.abs(x - hx) <= HALL_SIZE / 2 && Math.abs(z - hz) <= HALL_SIZE / 2) return { roomKey: null, area: 'hall' };
  }
  if (Math.abs(x) <= CORR_HALF + WALL_T) return { roomKey: null, area: 'corridor' };
  return { roomKey: null, area: 'outside' };
}

// ─────────────────────────────────────────────────────────────
// Brick-by-brick build animation
// ─────────────────────────────────────────────────────────────

export const BUILD_DURATION_MS = 3400;
const BRICK_L = 0.75;
const BRICK_H = 0.36;

interface Brick {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  shade: number;
}

/** Split a unit's walls into staggered bricks, bottom row first. */
function bricksFor(boxes: StructureBox[]): Brick[] {
  const bricks: Brick[] = [];
  for (const b of boxes) {
    if (b.kind !== 'wall' && b.kind !== 'pillar') continue;
    const alongX = b.sx >= b.sz;
    const len = alongX ? b.sx : b.sz;
    const rowsN = Math.max(1, Math.round(b.sy / BRICK_H));
    const h = b.sy / rowsN;
    for (let r = 0; r < rowsN; r++) {
      const offset = r % 2 === 0 ? 0 : BRICK_L / 2;
      let start = -len / 2;
      let first = true;
      while (start < len / 2 - 0.001) {
        const l = Math.min(first && offset > 0 ? offset : BRICK_L, len / 2 - start);
        const c = start + l / 2;
        const y = b.y - b.sy / 2 + h * r + h / 2;
        const shade = 0.82 + (((r * 7 + Math.round(c * 13)) % 9) / 9) * 0.3;
        bricks.push(
          alongX
            ? { x: b.x + c, y, z: b.z, sx: l * 0.96, sy: h * 0.9, sz: b.sz, shade }
            : { x: b.x, y, z: b.z + c, sx: b.sx, sy: h * 0.9, sz: l * 0.96, shade }
        );
        start += l;
        first = false;
      }
    }
  }
  return bricks.sort((a, b) => a.y - b.y);
}

interface UnitBuilderProps {
  unitKey: string;
  boxes: StructureBox[];
  color: string;
  onBuilt: (key: string) => void;
}

function UnitBuilder({ unitKey, boxes, color, onBuilt }: UnitBuilderProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const bricks = useMemo(() => bricksFor(boxes), [boxes]);
  const onBuiltRef = useRef(onBuilt);

  useEffect(() => {
    onBuiltRef.current = onBuilt;
  });

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    const base = new THREE.Color(color);
    bricks.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.set(b.sx, b.sy, b.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      c.copy(base).multiplyScalar(b.shade);
      mesh.setColorAt(i, c);
    });
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [bricks, color]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || doneRef.current) return;
    const now = performance.now();
    if (startRef.current === null) startRef.current = now;
    const p = Math.min(1, (now - startRef.current) / BUILD_DURATION_MS);
    // Ease-out so the last rows settle in.
    mesh.count = Math.round(bricks.length * (1 - (1 - p) * (1 - p)));
    if (p >= 1) {
      doneRef.current = true;
      onBuiltRef.current(unitKey);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, Math.max(1, bricks.length)]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.9} metalness={0.05} />
    </instancedMesh>
  );
}

interface GrowthBuilderProps {
  layout: PalaceLayout;
  /** Units currently being built (max a dozen at once). */
  building: string[];
  onBuilt: (key: string) => void;
}

/** Plays the brick-by-brick build of every unit listed in `building`. */
function GrowthBuilderInner({ layout, building, onBuilt }: GrowthBuilderProps) {
  const byUnit = useMemo(() => {
    const m = new Map<string, StructureBox[]>();
    for (const b of layout.boxes) {
      if (!building.includes(b.unit)) continue;
      const list = m.get(b.unit);
      if (list) list.push(b);
      else m.set(b.unit, [b]);
    }
    return m;
  }, [layout, building]);

  return (
    <>
      {building.map((key) => {
        const boxesForUnit = byUnit.get(key);
        if (!boxesForUnit) return null;
        const wall = boxesForUnit.find((b) => b.kind === 'wall');
        return <UnitBuilder key={key} unitKey={key} boxes={boxesForUnit} color={wall?.color ?? STONE} onBuilt={onBuilt} />;
      })}
    </>
  );
}

export const GrowthBuilder = memo(GrowthBuilderInner);
