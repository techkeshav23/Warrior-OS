// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Procedural Room Generator
// Renders the palace built by PalaceGrowth.buildPalaceLayout():
//   • <PalaceStructure/>  — every wall/floor/ceiling/glow box, instanced,
//                           with world-space masonry + tile patterns
//   • <PalaceSigns/>      — room labels above doorways, wing/hall signs
//   • <PalaceRoom/>       — one subject room's furniture: wall shelves
//                           (where knowledge objects sit) + themed decor
//                           (library, server room, network lab, …)
//   • <GrandHall/>        — chandelier + statues once the palace hits 500
//   • <RoomLightPool/>    — a fixed pool of accent lights that follows the
//                           player (constant light count → no shader
//                           recompiles however large the palace grows)
// All geometry is procedural — no model or texture files.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomStyle, RoomTheme } from './palaceData';
import {
  HALL_H,
  ROOM_SIZE,
  WALL_H,
  type BoxKind,
  type PalaceLayout,
  type PlacedRoom,
  type SignSpec,
  type StructureBox,
} from './PalaceGrowth';
import { createPatternMaterial, useLabelTexture, type SurfacePattern } from './palaceTextures';
import { RoomDecor } from './RoomDecor';

export { ROOM_THEMES } from './palaceData';
export type { RoomTheme } from './palaceData';

const HALF = ROOM_SIZE / 2;

// ─────────────────────────────────────────────────────────────
// Structure (instanced boxes)
// ─────────────────────────────────────────────────────────────

const KIND_PATTERN: Record<Exclude<BoxKind, 'glow'>, SurfacePattern> = {
  wall: 'masonry',
  pillar: 'masonry',
  floor: 'tiles',
  ceiling: 'panels',
  trim: 'plain',
};

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

function InstancedBoxes({ boxes, material }: { boxes: StructureBox[]; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    boxes.forEach((b, i) => {
      _dummy.position.set(b.x, b.y, b.z);
      _dummy.scale.set(Math.max(0.001, b.sx), Math.max(0.001, b.sy), Math.max(0.001, b.sz));
      _dummy.rotation.set(0, 0, 0);
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      mesh.setColorAt(i, _color.set(b.color));
    });
    mesh.count = boxes.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);

  if (boxes.length === 0) return null;
  return (
    <instancedMesh
      // Re-create when the capacity must grow.
      key={boxes.length}
      ref={ref}
      args={[undefined, undefined, boxes.length]}
      material={material}
      receiveShadow
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

interface PalaceStructureProps {
  layout: PalaceLayout;
  /** Build units not to draw (still under construction). */
  hidden: ReadonlySet<string>;
}

function PalaceStructureInner({ layout, hidden }: PalaceStructureProps) {
  const materials = useMemo(
    () => ({
      wall: createPatternMaterial('masonry'),
      pillar: createPatternMaterial('masonry', { roughness: 0.7 }),
      floor: createPatternMaterial('tiles', { roughness: 0.75, metalness: 0.12 }),
      ceiling: createPatternMaterial('panels', { roughness: 1 }),
      trim: createPatternMaterial('plain', { roughness: 0.6, metalness: 0.2 }),
      glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
    }),
    []
  );
  useLayoutEffect(
    () => () => {
      Object.values(materials).forEach((m) => m.dispose());
    },
    [materials]
  );

  const groups = useMemo(() => {
    const g: Record<BoxKind, StructureBox[]> = { wall: [], pillar: [], floor: [], ceiling: [], trim: [], glow: [] };
    for (const b of layout.boxes) {
      if (hidden.has(b.unit)) continue;
      g[b.kind].push(b);
    }
    return g;
  }, [layout, hidden]);

  return (
    <group>
      {(Object.keys(KIND_PATTERN) as (keyof typeof KIND_PATTERN)[]).map((kind) => (
        <InstancedBoxes key={kind} boxes={groups[kind]} material={materials[kind]} />
      ))}
      <InstancedBoxes boxes={groups.glow} material={materials.glow} />
    </group>
  );
}

export const PalaceStructure = memo(PalaceStructureInner);

// ─────────────────────────────────────────────────────────────
// Signs (room labels above doorways, wing gates, hall)
// ─────────────────────────────────────────────────────────────

function Sign({ spec }: { spec: SignSpec }) {
  const label = useLabelTexture({ title: spec.title, sub: spec.sub, color: spec.color });
  const ref = useRef<THREE.Group | null>(null);
  const baseY = spec.pos[1];

  useFrame(({ clock }) => {
    if (!spec.floating || !ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = baseY + Math.sin(t * 0.9) * 0.08;
    ref.current.rotation.y = spec.rotY + Math.sin(t * 0.3) * 0.25;
  });

  if (!label) return null;
  const h = spec.width / label.aspect;
  return (
    <group ref={ref} position={spec.pos} rotation={[0, spec.rotY, 0]}>
      <mesh>
        <planeGeometry args={[spec.width, h]} />
        <meshBasicMaterial map={label.texture} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PalaceSignsInner({ signs, hidden }: { signs: SignSpec[]; hidden: ReadonlySet<string> }) {
  return (
    <>
      {signs
        .filter((s) => !hidden.has(s.unit))
        .map((s) => (
          <Sign key={`${s.key}:${s.title}:${s.sub}`} spec={s} />
        ))}
    </>
  );
}

export const PalaceSigns = memo(PalaceSignsInner);

// ─────────────────────────────────────────────────────────────
// Shelves + object slots (room-local space: +x = toward the door,
// z along the corridor, origin = room centre, floor at y = 0)
// ─────────────────────────────────────────────────────────────

const SHELF_DEPTH = 0.55;
const SHELF_LEVELS = [0.72, 1.48, 2.24];
const SLOT_GAP = 0.85;
const OBJECT_LIFT = 0.3;

interface ShelfRun {
  /** Centre of the run along the wall. */
  x: number;
  z: number;
  /** Rotation so the shelf front faces into the room. */
  rotY: number;
  length: number;
}

const SHELF_RUNS: ShelfRun[] = [
  // Back wall (facing +x, toward the door).
  { x: -HALF + SHELF_DEPTH / 2 + 0.05, z: 0, rotY: Math.PI / 2, length: 9 },
  // North wall (facing +z).
  { x: -0.2, z: -HALF + SHELF_DEPTH / 2 + 0.05, rotY: 0, length: 8 },
  // South wall (facing -z).
  { x: -0.2, z: HALF - SHELF_DEPTH / 2 - 0.05, rotY: Math.PI, length: 8 },
];

/** Every shelf slot of a room, eye-level back wall first. */
function buildSlots(): [number, number, number][] {
  const slots: [number, number, number][] = [];
  const levelOrder = [1, 2, 0];
  for (const level of levelOrder) {
    for (const run of SHELF_RUNS) {
      const n = Math.floor(run.length / SLOT_GAP);
      const start = -((n - 1) * SLOT_GAP) / 2;
      for (let i = 0; i < n; i++) {
        const along = start + i * SLOT_GAP;
        const y = SHELF_LEVELS[level] + OBJECT_LIFT;
        if (run.rotY === Math.PI / 2) slots.push([run.x + 0.02, y, run.z + along]);
        else slots.push([run.x + along, y, run.z + (run.rotY === 0 ? 0.02 : -0.02)]);
      }
    }
  }
  return slots;
}

export const ROOM_SLOTS: [number, number, number][] = buildSlots();
export const ROOM_CAPACITY = ROOM_SLOTS.length;

function ShelfUnit({ run, color, style }: { run: ShelfRun; color: string; style: RoomStyle }) {
  const metal = style === 'server' || style === 'bay' || style === 'network' || style === 'laboratory' || style === 'foundry';
  const books = useMemo(() => {
    if (style !== 'library' && style !== 'archive') return [];
    const out: { x: number; y: number; h: number; w: number; c: string }[] = [];
    let seed = Math.round(run.x * 100 + run.z * 37);
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const palette = ['#5d2e1f', '#2f4a3a', '#1f3350', '#6b5423', '#4a2340', '#3b3b3b'];
    for (const level of SHELF_LEVELS) {
      // Books fill the gaps between object slots at the ends of each shelf.
      for (const end of [-1, 1]) {
        let x = end * (run.length / 2 - 0.12);
        for (let k = 0; k < 4; k++) {
          const w = 0.07 + rand() * 0.05;
          const h = 0.26 + rand() * 0.14;
          out.push({ x, y: level + h / 2 + 0.02, h, w, c: palette[Math.floor(rand() * palette.length)] });
          x -= end * (w + 0.015);
        }
      }
    }
    return out;
  }, [run, style]);

  return (
    <group position={[run.x, 0, run.z]} rotation={[0, run.rotY, 0]}>
      {/* Side panels */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * run.length) / 2, 1.35, 0]} castShadow>
          <boxGeometry args={[0.08, 2.7, SHELF_DEPTH]} />
          <meshStandardMaterial color={color} roughness={metal ? 0.4 : 0.85} metalness={metal ? 0.6 : 0.05} />
        </mesh>
      ))}
      {/* Back board */}
      <mesh position={[0, 1.35, -SHELF_DEPTH / 2 + 0.02]}>
        <boxGeometry args={[run.length, 2.7, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={metal ? 0.4 : 0} />
      </mesh>
      {/* Planks */}
      {SHELF_LEVELS.map((y) => (
        <mesh key={y} position={[0, y, 0]} receiveShadow>
          <boxGeometry args={[run.length, 0.06, SHELF_DEPTH]} />
          <meshStandardMaterial color={color} roughness={metal ? 0.35 : 0.8} metalness={metal ? 0.65 : 0.05} />
        </mesh>
      ))}
      {/* Top cap */}
      <mesh position={[0, 2.72, 0]}>
        <boxGeometry args={[run.length + 0.1, 0.06, SHELF_DEPTH + 0.06]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, 0.02]}>
          <boxGeometry args={[b.w, b.h, SHELF_DEPTH * 0.7]} />
          <meshStandardMaterial color={b.c} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// A subject room (furniture + decor + children = objects)
// ─────────────────────────────────────────────────────────────

interface PalaceRoomProps {
  room: PlacedRoom;
  /** Knowledge objects (already positioned in room-local space). */
  children?: React.ReactNode;
}

function PalaceRoomInner({ room, children }: PalaceRoomProps) {
  const theme: RoomTheme = room.theme;
  return (
    <group position={[room.center[0], 0, room.center[1]]} rotation={[0, room.rotY, 0]}>
      {SHELF_RUNS.map((run, i) => (
        <ShelfUnit key={i} run={run} color={theme.furniture} style={theme.style} />
      ))}
      <RoomDecor theme={theme} seed={room.key} />
      {children}
    </group>
  );
}

export const PalaceRoom = memo(PalaceRoomInner);

// ─────────────────────────────────────────────────────────────
// Grand Hall (500+ notes): chandelier + statues
// ─────────────────────────────────────────────────────────────

function Chandelier({ y }: { y: number }) {
  const ref = useRef<THREE.Group | null>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });
  const candles = 16;
  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.8, 6]} />
        <meshStandardMaterial color="#b8962e" metalness={0.9} roughness={0.3} />
      </mesh>
      {[2.4, 1.5].map((r, ring) => (
        <group key={r} position={[0, -ring * 0.7, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, 0.06, 8, 48]} />
            <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.25} />
          </mesh>
          {Array.from({ length: ring === 0 ? candles : candles / 2 }).map((_, i, arr) => {
            const a = (i / arr.length) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * r, 0.12, Math.sin(a) * r]}>
                <mesh>
                  <cylinderGeometry args={[0.05, 0.05, 0.2, 6]} />
                  <meshStandardMaterial color="#f5f0e1" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.16, 0]}>
                  <sphereGeometry args={[0.055, 8, 8]} />
                  <meshBasicMaterial color="#ffd180" toneMapped={false} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      {/* Crystal drops */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 2, -0.5 - (i % 3) * 0.18, Math.sin(a) * 2]}>
            <octahedronGeometry args={[0.07]} />
            <meshStandardMaterial color="#e0f7fa" emissive="#80deea" emissiveIntensity={0.6} transparent opacity={0.85} />
          </mesh>
        );
      })}
      <pointLight color="#ffd180" intensity={60} distance={30} decay={1.6} position={[0, -0.8, 0]} />
    </group>
  );
}

function Statue({ position, rotY, accent }: { position: [number, number, number]; rotY: number; accent: string }) {
  const stone = '#9e9a93';
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.3, 1, 1.3]} />
        <meshStandardMaterial color="#56524c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[1.36, 0.05, 1.36]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {/* Robed figure */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.48, 1.8, 12]} />
        <meshStandardMaterial color={stone} roughness={0.8} />
      </mesh>
      <mesh position={[0, 3.05, 0]} castShadow>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color={stone} roughness={0.8} />
      </mesh>
      {/* Arm raising a book of knowledge */}
      <mesh position={[0.34, 2.7, 0.1]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.07, 0.08, 0.8, 8]} />
        <meshStandardMaterial color={stone} roughness={0.8} />
      </mesh>
      <mesh position={[0.55, 3.15, 0.1]} rotation={[0.2, 0, 0.3]}>
        <boxGeometry args={[0.36, 0.06, 0.28]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export function GrandHall({ layout }: { layout: PalaceLayout }) {
  if (!layout.hall) return null;
  const [hx, hz] = layout.hall.center;
  const s = layout.hall.size / 2 - 2;
  const statues: { p: [number, number, number]; r: number; c: string }[] = [
    { p: [-s, 0, -s * 0.5], r: Math.PI / 2, c: '#4fc3f7' },
    { p: [-s, 0, s * 0.5], r: Math.PI / 2, c: '#00e676' },
    { p: [s, 0, -s * 0.5], r: -Math.PI / 2, c: '#ff4081' },
    { p: [s, 0, s * 0.5], r: -Math.PI / 2, c: '#ffab00' },
    { p: [-s * 0.45, 0, -s], r: 0, c: '#7c4dff' },
    { p: [s * 0.45, 0, -s], r: 0, c: '#ffd740' },
  ];
  return (
    <group position={[hx, 0, hz]}>
      <Chandelier y={HALL_H - 3.2} />
      {statues.map((st, i) => (
        <Statue key={i} position={st.p} rotY={st.r} accent={st.c} />
      ))}
      {/* Columns */}
      {[-1, 1].flatMap((sx) =>
        [-1, 0, 1].map((k) => (
          <mesh key={`${sx}:${k}`} position={[sx * (s - 3), HALL_H / 2, k * (s * 0.7)]} castShadow>
            <cylinderGeometry args={[0.45, 0.55, HALL_H, 16]} />
            <meshStandardMaterial color="#8d857a" roughness={0.7} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Light pool — N accent lights hop to the rooms nearest the player
// ─────────────────────────────────────────────────────────────

const POOL_SIZE = 4;

export function RoomLightPool({ rooms, hidden }: { rooms: PlacedRoom[]; hidden: ReadonlySet<string> }) {
  const { camera } = useThree();
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const acc = useRef(0);

  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    const px = camera.position.x;
    const pz = camera.position.z;
    const nearest = rooms
      .filter((r) => !hidden.has(r.key))
      .map((r) => ({ r, d: (r.center[0] - px) ** 2 + (r.center[1] - pz) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, POOL_SIZE);
    for (let i = 0; i < POOL_SIZE; i++) {
      const light = lights.current[i];
      if (!light) continue;
      const n = nearest[i];
      if (!n) {
        light.intensity = 0;
        continue;
      }
      light.position.set(n.r.center[0], WALL_H - 1.1, n.r.center[1]);
      light.color.set(n.r.theme.accent);
      light.intensity = 26;
    }
  });

  return (
    <>
      {Array.from({ length: POOL_SIZE }).map((_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lights.current[i] = el;
          }}
          intensity={0}
          distance={ROOM_SIZE * 1.3}
          decay={1.4}
        />
      ))}
    </>
  );
}
