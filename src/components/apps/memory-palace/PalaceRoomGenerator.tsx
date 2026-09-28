// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Procedural Room Generator
// Builds subject-themed rooms (walls, floor, ambient accents)
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import type { GateSubject } from '@/types/gate';

// ─────────────────────────────────────────────────────────────
// Room theme config — one per GATE subject
// ─────────────────────────────────────────────────────────────

export interface RoomTheme {
  subject: GateSubject;
  label: string;
  /** accent glow color (hex) */
  accent: string;
  /** wall base color (hex) */
  wall: string;
  /** floor color (hex) */
  floor: string;
  /** short descriptive vibe used in labels */
  vibe: string;
}

export const ROOM_THEMES: Record<GateSubject, RoomTheme> = {
  DBMS: { subject: 'DBMS', label: 'DBMS Library', accent: '#00f0ff', wall: '#241a12', floor: '#1a1208', vibe: 'Dark library · wooden shelves' },
  OS: { subject: 'OS', label: 'OS Server Room', accent: '#00e676', wall: '#0e1414', floor: '#080c0c', vibe: 'Server room · blinking racks' },
  CN: { subject: 'CN', label: 'Network Lab', accent: '#7b61ff', wall: '#12121e', floor: '#0a0a14', vibe: 'Network lab · glowing cables' },
  TOC: { subject: 'TOC', label: 'Automata Space', accent: '#ff3d71', wall: '#16101a', floor: '#0d0810', vibe: 'Abstract math · floating automata' },
  'Data Structures': { subject: 'Data Structures', label: 'DS Warehouse', accent: '#ffab00', wall: '#1a1508', floor: '#100d05', vibe: 'Warehouse · stacked structures' },
  DAA: { subject: 'DAA', label: 'Algo Laboratory', accent: '#ff1744', wall: '#1a0e10', floor: '#100809', vibe: 'Laboratory · sorting tubes' },
  'Discrete Math': { subject: 'Discrete Math', label: 'Discrete Hall', accent: '#00bcd4', wall: '#0e1618', floor: '#080e10', vibe: 'Logic lattice · sets & graphs' },
  'Digital Logic': { subject: 'Digital Logic', label: 'Gate Foundry', accent: '#64ffda', wall: '#101616', floor: '#0a0e0e', vibe: 'Foundry · logic gates' },
  'Compiler Design': { subject: 'Compiler Design', label: 'Compiler Forge', accent: '#ffd740', wall: '#181206', floor: '#0e0a04', vibe: 'Forge · parse trees' },
  COA: { subject: 'COA', label: 'Architecture Bay', accent: '#40c4ff', wall: '#0c1218', floor: '#070c10', vibe: 'Bay · pipelines & caches' },
  'Engineering Math': { subject: 'Engineering Math', label: 'Math Observatory', accent: '#b388ff', wall: '#14101c', floor: '#0c0812', vibe: 'Observatory · matrices' },
  'C Programming': { subject: 'C Programming', label: 'C Workshop', accent: '#82b1ff', wall: '#0e1016', floor: '#080a0e', vibe: 'Workshop · pointers & memory' },
};

export const ROOM_SIZE = 14; // interior square side (world units)
const WALL_HEIGHT = 5;
const WALL_THICKNESS = 0.4;

/** Deterministic room grid position for a given index (spiral-ish grid). */
export function roomGridPosition(index: number): [number, number] {
  const cols = 4;
  const spacing = ROOM_SIZE + 6; // room + corridor gap
  const col = index % cols;
  const row = Math.floor(index / cols);
  return [col * spacing, row * spacing];
}

interface PalaceRoomProps {
  theme: RoomTheme;
  /** world-space center of the room [x, z] */
  origin: [number, number];
  /** whether room is fully built (growth animation handled elsewhere) */
  built?: boolean;
  children?: React.ReactNode;
}

/**
 * A single procedurally themed room. Pure three.js primitives (no external
 * assets) so it always builds. Renders floor, ceiling, four walls with a
 * doorway gap on the +Z side, and subject-colored accent lighting + props.
 */
export function PalaceRoom({ theme, origin, built = true, children }: PalaceRoomProps) {
  const [ox, oz] = origin;
  const half = ROOM_SIZE / 2;

  // Decorative subject props (cheap instanced-ish meshes, memoized)
  const props = useMemo(() => generateRoomProps(theme), [theme]);

  if (!built) return null;

  return (
    <group position={[ox, 0, oz]}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
        <meshStandardMaterial color={theme.floor} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_HEIGHT, 0]}>
        <planeGeometry args={[ROOM_SIZE, ROOM_SIZE]} />
        <meshStandardMaterial color={theme.wall} roughness={1} />
      </mesh>

      {/* Walls: back (-Z), left (-X), right (+X). Front (+Z) has a doorway. */}
      <Wall position={[0, WALL_HEIGHT / 2, -half]} size={[ROOM_SIZE, WALL_HEIGHT, WALL_THICKNESS]} color={theme.wall} />
      <Wall position={[-half, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE]} color={theme.wall} />
      <Wall position={[half, WALL_HEIGHT / 2, 0]} size={[WALL_THICKNESS, WALL_HEIGHT, ROOM_SIZE]} color={theme.wall} />
      {/* Front wall split into two segments leaving a central doorway */}
      <Wall position={[-half + 3, WALL_HEIGHT / 2, half]} size={[6, WALL_HEIGHT, WALL_THICKNESS]} color={theme.wall} />
      <Wall position={[half - 3, WALL_HEIGHT / 2, half]} size={[6, WALL_HEIGHT, WALL_THICKNESS]} color={theme.wall} />

      {/* Accent glow strip along the back wall */}
      <mesh position={[0, WALL_HEIGHT - 0.6, -half + WALL_THICKNESS]}>
        <boxGeometry args={[ROOM_SIZE - 1, 0.15, 0.05]} />
        <meshBasicMaterial color={theme.accent} toneMapped={false} />
      </mesh>

      {/* Subject ambient point light */}
      <pointLight position={[0, WALL_HEIGHT - 1, 0]} color={theme.accent} intensity={8} distance={ROOM_SIZE * 1.4} />
      <ambientLight intensity={0.25} color={theme.accent} />

      {/* Decorative themed props */}
      {props.map((p, i) => (
        <mesh key={i} position={p.position} rotation={p.rotation}>
          {p.kind === 'box' ? (
            <boxGeometry args={p.args} />
          ) : (
            <cylinderGeometry args={[p.args[0], p.args[0], p.args[1], 12]} />
          )}
          <meshStandardMaterial
            color={p.glow ? theme.accent : theme.wall}
            emissive={p.glow ? theme.accent : '#000000'}
            emissiveIntensity={p.glow ? 0.6 : 0}
            roughness={0.6}
            metalness={0.3}
          />
        </mesh>
      ))}

      {children}
    </group>
  );
}

interface WallProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}

function Wall({ position, size, color }: WallProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
    </mesh>
  );
}

interface RoomProp {
  kind: 'box' | 'cyl';
  position: [number, number, number];
  rotation: [number, number, number];
  args: [number, number, number];
  glow: boolean;
}

/** Deterministic pseudo-random decorative props for a room's subject. */
function generateRoomProps(theme: RoomTheme): RoomProp[] {
  const rng = mulberry32(hashString(theme.subject));
  const items: RoomProp[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (ROOM_SIZE / 2 - 1.2);
    const z = -ROOM_SIZE / 2 + 1.5 + (i / count) * (ROOM_SIZE - 3);
    const isShelf = i % 3 !== 0;
    if (isShelf) {
      // Tall shelf / rack against the wall
      items.push({
        kind: 'box',
        position: [x, 1.4, z],
        rotation: [0, 0, 0],
        args: [0.6, 2.8, 1.6],
        glow: false,
      });
    } else {
      // Glowing decorative pillar / tube
      items.push({
        kind: 'cyl',
        position: [x * 0.6, 1.1, z],
        rotation: [0, rng() * Math.PI, 0],
        args: [0.35, 2.2, 0],
        glow: true,
      });
    }
  }
  return items;
}

// ─────────────────────────────────────────────────────────────
// tiny deterministic RNG helpers (no deps)
// ─────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
