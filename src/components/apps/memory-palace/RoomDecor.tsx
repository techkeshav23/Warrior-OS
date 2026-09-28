// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: themed room decor
// One procedural set-piece per room style, themed by what the room
// holds (spec 6.24):
//   notes    → library · observatory · idea crystal · link web · archive
//   decks    → mastery lab (tubes fill with topic mastery) · card vault
//              (recall lights: red = due, amber = new) · review loop
//   projects → forge · workshop · depot · pipeline (ideas → ship)
// Floating words are the room's own content: note titles, topic names,
// project names. Coordinates are room-local: +x toward the door,
// origin = room centre.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { RoomDecorData, RoomStyle, RoomTheme } from './palaceData';
import { useLabelTexture } from './palaceTextures';

type V3 = [number, number, number];

// ─────────────────────────────────────────────────────────────
// Footprints (room-local AABBs the player cannot walk through)
// ─────────────────────────────────────────────────────────────

export interface LocalRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Shelves along the back + side walls (all styles). */
export const SHELF_FOOTPRINTS: LocalRect[] = [
  { x0: -6, x1: -5.3, z0: -4.6, z1: 4.6 },
  { x0: -4.3, x1: 3.9, z0: -6, z1: -5.3 },
  { x0: -4.3, x1: 3.9, z0: 5.3, z1: 6 },
];

export const DECOR_FOOTPRINTS: Record<RoomStyle, LocalRect[]> = {
  library: [
    { x0: -2.4, x1: -0.6, z0: -1.7, z1: 1.7 },
    { x0: -4.1, x1: -3.1, z0: 2.3, z1: 3.3 },
  ],
  observatory: [{ x0: -3.1, x1: -1.9, z0: -0.6, z1: 0.6 }],
  lattice: [{ x0: -1.9, x1: -1.1, z0: -0.4, z1: 0.4 }],
  network: [{ x0: -2.2, x1: -0.2, z0: -1.3, z1: 1.3 }],
  archive: [
    { x0: -3.4, x1: -2.4, z0: -2.1, z1: -0.9 },
    { x0: -3.4, x1: -2.4, z0: 0.9, z1: 2.1 },
  ],
  laboratory: [{ x0: -3.1, x1: -0.9, z0: -2.1, z1: 2.1 }],
  vault: [
    { x0: -3.9, x1: 0.9, z0: 1.35, z1: 2.3 },
    { x0: -3.9, x1: 0.9, z0: -2.3, z1: -1.35 },
  ],
  orbit: [{ x0: -1.6, x1: -0.4, z0: -0.6, z1: 0.6 }],
  forge: [
    { x0: -2.1, x1: -0.9, z0: -0.6, z1: 0.6 },
    { x0: 0.15, x1: 0.65, z0: -1.85, z1: 1.85 },
  ],
  workshop: [{ x0: -3.4, x1: -2.2, z0: -3.1, z1: 3.1 }],
  depot: [
    { x0: -3.6, x1: -2.4, z0: -2.4, z1: -1.2 },
    { x0: -1.5, x1: -0.5, z0: -0.2, z1: 2.9 },
  ],
  pipeline: [{ x0: -2.5, x1: -1.5, z0: -2.3, z1: 2.3 }],
};

// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────

function Box({
  p,
  s,
  color,
  emissive,
  ei = 0,
  metal = 0.1,
  rough = 0.7,
  opacity = 1,
  r,
}: {
  p: V3;
  s: V3;
  color: string;
  emissive?: string;
  ei?: number;
  metal?: number;
  rough?: number;
  opacity?: number;
  r?: V3;
}) {
  return (
    <mesh position={p} rotation={r} castShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={ei}
        metalness={metal}
        roughness={rough}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}

function Glow({ p, s, color, sphere }: { p: V3; s: V3 | number; color: string; sphere?: boolean }) {
  return (
    <mesh position={p}>
      {sphere ? <sphereGeometry args={[typeof s === 'number' ? s : s[0], 12, 12]} /> : <boxGeometry args={s as V3} />}
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

const _up = new THREE.Vector3(0, 1, 0);

/** A thin cylinder from a to b (edges, cables, arrows). */
function Edge({ a, b, color, radius = 0.025, glow = true }: { a: V3; b: V3; color: string; radius?: number; glow?: boolean }) {
  const { pos, quat, len } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const l = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize());
    return { pos: va.add(vb).multiplyScalar(0.5), quat: q, len: l };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[radius, radius, len, 6]} />
      {glow ? (
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.85} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.6} />
      )}
    </mesh>
  );
}

/** Glowing text that bobs in the air and slowly turns (the room's own words). */
function FloatingText({ text, p, color, width = 1.6, speed = 0.6, phase = 0 }: { text: string; p: V3; color: string; width?: number; speed?: number; phase?: number }) {
  const label = useLabelTexture({ title: text, color, plate: 'none', mono: true });
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = clock.getElapsedTime() * speed + phase;
    m.position.y = p[1] + Math.sin(t) * 0.18;
    m.rotation.y = Math.sin(t * 0.5) * 0.6 + Math.PI / 2;
  });
  if (!label) return null;
  return (
    <mesh ref={ref} position={p}>
      <planeGeometry args={[width, width / label.aspect]} />
      <meshBasicMaterial map={label.texture} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} opacity={0.9} />
    </mesh>
  );
}

function Spin({ children, speed = 0.2, p }: { children: React.ReactNode; speed?: number; p: V3 }) {
  const ref = useRef<THREE.Group | null>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return (
    <group ref={ref} position={p}>
      {children}
    </group>
  );
}

function rng(seedStr: string): () => number {
  let s = 2166136261;
  for (let i = 0; i < seedStr.length; i++) s = Math.imul(s ^ seedStr.charCodeAt(i), 16777619);
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────
// Style set-pieces
// ─────────────────────────────────────────────────────────────

interface DecorProps {
  t: RoomTheme;
  d: RoomDecorData;
  seed: string;
}

/** The room's own words (note titles, topic names, project names) drifting at fixed spots. */
function Words({ words, color, spots, width = 1.8 }: { words: string[]; color: string; spots: V3[]; width?: number }) {
  return (
    <>
      {words.slice(0, spots.length).map((w, i) => (
        <FloatingText key={`${i}:${w}`} text={w} color={color} p={spots[i]} width={width} phase={i * 1.3} />
      ))}
    </>
  );
}

const MASTERED = 0.8;
const MASTERED_COLOR = '#69f0ae';

// ─── Notes ───

function LibraryDecor({ t, d }: DecorProps) {
  return (
    <group>
      {/* Reading table */}
      <Box p={[-1.5, 0.78, 0]} s={[1.6, 0.08, 3.2]} color={t.furniture} rough={0.8} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[-1.5 + sx * 0.7, 0.38, sz * 1.5]} s={[0.1, 0.76, 0.1]} color={t.furniture} />))}
      {/* Open notebooks + lamp */}
      <Box p={[-1.4, 0.85, -0.8]} s={[0.4, 0.04, 0.55]} color="#e8dcc0" r={[0, 0.3, 0]} />
      <Box p={[-1.6, 0.85, 0.7]} s={[0.4, 0.04, 0.55]} color="#e8dcc0" r={[0, -0.2, 0]} />
      <Glow p={[-1.5, 1.25, 0]} s={0.09} color="#ffcc80" sphere />
      <Edge a={[-1.5, 0.82, 0]} b={[-1.5, 1.2, 0]} color="#8d6e63" glow={false} />
      <pointLight position={[-1.5, 1.4, 0]} color="#ffcc80" intensity={3} distance={4} />
      {/* Scroll cases */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[-3.6, 0.3 + i * 0.62, 2.8]}>
          <mesh>
            <cylinderGeometry args={[0.45, 0.45, 0.55, 24]} />
            <meshStandardMaterial color="#2a2018" metalness={0.3} roughness={0.5} emissive={t.accent} emissiveIntensity={0.06} />
          </mesh>
          <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.45, 24]} />
            <meshBasicMaterial color={t.accent} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <Words
        words={d.words}
        color={t.accent}
        width={1.6}
        spots={[
          [-2.2, 2.8, -2],
          [-0.6, 3.25, -1],
          [-2.2, 3.7, 0],
          [-0.6, 2.8, 1],
          [-2.2, 3.25, 2],
        ]}
      />
    </group>
  );
}

function ObservatoryDecor({ t, d }: DecorProps) {
  const wave = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const x = -2 + (i / 64) * 4;
      pts.push(new THREE.Vector3(0, Math.sin(x * 3) * 0.3, x));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const material = new THREE.LineBasicMaterial({ color: t.accent, toneMapped: false });
    return new THREE.Line(geometry, material);
  }, [t.accent]);
  useLayoutEffect(
    () => () => {
      wave.geometry.dispose();
      (wave.material as THREE.Material).dispose();
    },
    [wave]
  );
  return (
    <group>
      {/* Telescope */}
      <Box p={[-2.5, 0.5, 0]} s={[0.5, 1, 0.5]} color="#2a2340" metal={0.5} />
      <mesh position={[-2.2, 1.5, 0]} rotation={[0, 0, -0.9]}>
        <cylinderGeometry args={[0.16, 0.26, 1.8, 16]} />
        <meshStandardMaterial color={t.furniture} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Star chart */}
      <Spin p={[-0.3, 2.9, 0]} speed={0.18}>
        {Array.from({ length: 16 }).map((_, i) => (
          <Glow key={i} p={[0, (Math.floor(i / 4) - 1.5) * 0.35, ((i % 4) - 1.5) * 0.35]} s={[0.05, 0.22, 0.22]} color={i % 5 === 0 ? '#ffffff' : t.accent} />
        ))}
      </Spin>
      {/* Thought wave */}
      <primitive object={wave} position={[1.2, 2.3, 0]} />
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [1.2, 3.2, -1.8],
          [1.4, 2.7, 1.9],
          [-1.2, 3.8, -2.4],
          [-1.2, 3.8, 2.4],
        ]}
      />
    </group>
  );
}

function LatticeDecor({ t, d }: DecorProps) {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.1, 0), []);
  const nodes = useMemo(() => {
    const pos = geo.getAttribute('position');
    const seen = new Map<string, V3>();
    for (let i = 0; i < pos.count; i++) {
      const v: V3 = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      seen.set(v.map((n) => n.toFixed(3)).join(','), v);
    }
    return [...seen.values()];
  }, [geo]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useLayoutEffect(() => () => {
    geo.dispose();
    edges.dispose();
  }, [geo, edges]);
  return (
    <group>
      <Box p={[-1.5, 0.45, 0]} s={[0.7, 0.9, 0.7]} color={t.furniture} emissive={t.accent} ei={0.15} />
      <Spin p={[-1.5, 2.6, 0]} speed={0.35}>
        <lineSegments geometry={edges}>
          <lineBasicMaterial color={t.accent} toneMapped={false} />
        </lineSegments>
        {nodes.map((n, i) => (
          <Glow key={i} p={n} s={0.07} color="#ffffff" sphere />
        ))}
      </Spin>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[1 + Math.cos(a) * 0.55, 0.02, Math.sin(a) * 0.55]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.85, 0.9, 48]} />
            <meshBasicMaterial color={t.accent} toneMapped={false} transparent opacity={0.7} />
          </mesh>
        );
      })}
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [1, 2.6, 0],
          [1.3, 3.3, -2.2],
          [1.3, 3.3, 2.2],
        ]}
      />
    </group>
  );
}

function Spark({ curve, color, offset, speed }: { curve: THREE.Curve<THREE.Vector3>; color: string; offset: number; speed: number }) {
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const u = (clock.getElapsedTime() * speed + offset) % 1;
    ref.current.position.copy(curve.getPointAt(u));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 10, 10]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

const HUBS: V3[] = [
  [-1.2, 0.95, -0.8],
  [-1.2, 0.95, 0.8],
  [-1.8, 0.95, 0],
];

function NetworkDecor({ t, d }: DecorProps) {
  const curves = useMemo(() => {
    const ends: V3[] = [
      [-5.6, 4.2, -3],
      [-5.6, 4.2, 3],
      [0, 4.6, -5.6],
      [2, 4.6, 5.6],
      [-3, 4.8, 0],
    ];
    return ends.map((e, i) => {
      const s = HUBS[i % HUBS.length];
      return new THREE.CatmullRomCurve3([
        new THREE.Vector3(...s),
        new THREE.Vector3(s[0], 4.5, s[2]),
        new THREE.Vector3((s[0] + e[0]) / 2, 4.85, (s[2] + e[2]) / 2),
        new THREE.Vector3(...e),
      ]);
    });
  }, []);
  const tubes = useMemo(() => curves.map((c) => new THREE.TubeGeometry(c, 48, 0.03, 6, false)), [curves]);
  useLayoutEffect(() => () => tubes.forEach((g) => g.dispose()), [tubes]);

  return (
    <group>
      <Box p={[-1.2, 0.75, 0]} s={[1.8, 0.08, 2.4]} color={t.furniture} metal={0.5} rough={0.4} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Box key={`${sx}${sz}`} p={[-1.2 + sx * 0.8, 0.36, sz * 1.1]} s={[0.08, 0.72, 0.08]} color="#1a1a28" />))}
      {/* Link hubs */}
      {HUBS.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <icosahedronGeometry args={[0.18, 0]} />
            <meshStandardMaterial color="#11111c" emissive={t.accent} emissiveIntensity={0.6} metalness={0.5} roughness={0.3} />
          </mesh>
          <Glow p={[0, 0.3, 0]} s={0.05} color="#ffffff" sphere />
        </group>
      ))}
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={t.accent} toneMapped={false} transparent opacity={0.75} />
        </mesh>
      ))}
      {curves.map((c, i) => (
        <group key={i}>
          <Spark curve={c} color="#ffffff" offset={i * 0.37} speed={0.25 + (i % 3) * 0.08} />
          <Spark curve={c} color={t.accent} offset={i * 0.37 + 0.5} speed={0.25 + (i % 3) * 0.08} />
        </group>
      ))}
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [1.2, 2.9, -1.5],
          [1.5, 3.2, 1.8],
          [0.2, 3.7, 0],
        ]}
      />
    </group>
  );
}

function ArchiveDecor({ t, d }: DecorProps) {
  return (
    <group>
      {[-1.5, 1.5].map((z) => (
        <group key={z} position={[-2.9, 0, z]}>
          <Box p={[0, 0.8, 0]} s={[0.9, 1.6, 1.1]} color={t.furniture} metal={0.5} rough={0.4} />
          {[0.35, 0.8, 1.25].map((y) => (
            <Box key={y} p={[0.46, y, 0]} s={[0.02, 0.34, 0.9]} color="#6c727b" metal={0.6} />
          ))}
        </group>
      ))}
      <Glow p={[-2.9, 1.95, 0]} s={0.12} color="#fff3e0" sphere />
      <pointLight position={[-2.9, 2.1, 0]} color="#fff3e0" intensity={3} distance={5} />
      <Words
        words={d.words.length > 0 ? d.words : ['unfiled']}
        color={t.accent}
        spots={[
          [0.5, 2.8, 0],
          [0.8, 3.4, -2],
          [0.8, 3.4, 2],
        ]}
      />
    </group>
  );
}

// ─── Decks ───

/** Tubes whose liquid level is each topic's mastery (green once mastered). */
function LaboratoryDecor({ t, d }: DecorProps) {
  const n = Math.min(8, Math.max(3, d.levels.length));
  const liquids = useRef<(THREE.Mesh | null)[]>([]);
  const targets = useMemo(
    () => Array.from({ length: n }, (_, k) => Math.max(0.04, (d.levels[k]?.value ?? 0) * 1.1)),
    [n, d.levels]
  );

  useFrame(({ clock }, dt) => {
    const time = clock.getElapsedTime();
    liquids.current.forEach((m, k) => {
      if (!m || k >= targets.length) return;
      const target = targets[k] + Math.sin(time * 1.3 + k) * 0.015;
      m.scale.y += (target - m.scale.y) * Math.min(1, dt * 3);
      m.position.y = 0.95 + m.scale.y / 2;
    });
  });

  return (
    <group>
      <Box p={[-2, 0.85, 0]} s={[1.8, 0.1, 4]} color="#d7dde3" metal={0.3} rough={0.35} />
      <Box p={[-2, 0.4, 0]} s={[1.6, 0.8, 3.8]} color="#3a2a2e" />
      {Array.from({ length: n }).map((_, k) => {
        const z = -1.6 + (k * 3.2) / (n - 1);
        const mastered = (d.levels[k]?.value ?? 0) >= MASTERED;
        return (
          <group key={k}>
            <mesh position={[-1.8, 1.55, z]}>
              <cylinderGeometry args={[0.13, 0.13, 1.25, 16, 1, true]} />
              <meshStandardMaterial color="#e0f7fa" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} />
            </mesh>
            <mesh
              ref={(el) => {
                liquids.current[k] = el;
              }}
              position={[-1.8, 0.97, z]}
              scale={[1, 0.04, 1]}
            >
              <cylinderGeometry args={[0.11, 0.11, 1, 16]} />
              <meshBasicMaterial color={mastered ? MASTERED_COLOR : t.accent} toneMapped={false} transparent opacity={0.85} />
            </mesh>
          </group>
        );
      })}
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [0.5, 2.8, -1.5],
          [0.8, 3.3, 1.8],
          [0.2, 3.8, 0],
        ]}
      />
    </group>
  );
}

const DUE_LED = new THREE.Color('#ff1744');
const NEW_LED = new THREE.Color('#ffab00');

/** Rack cabinets whose recall lights show the deck: red = due, amber = never studied. */
function VaultDecor({ t, d, seed }: DecorProps) {
  const ledRef = useRef<THREE.InstancedMesh | null>(null);
  const leds = useMemo(() => {
    const out: { p: V3; phase: number; speed: number; hue: number }[] = [];
    const r = rng(`vault:${seed}`);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const x = -3.3 + k * 1.15;
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 3; col++) {
            out.push({
              p: [x - 0.2 + col * 0.2, 0.45 + row * 0.27, side * (1.8 - 0.47)],
              phase: r() * 10,
              speed: 1 + r() * 5,
              hue: r(),
            });
          }
        }
      }
    }
    return out;
  }, [seed]);
  const accent = useMemo(() => new THREE.Color(t.accent), [t.accent]);
  const off = useMemo(() => new THREE.Color('#0b1a12'), []);

  useLayoutEffect(() => {
    const mesh = ledRef.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    leds.forEach((l, i) => {
      o.position.set(...l.p);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, off);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [leds, off]);

  const acc = useRef(0);
  useFrame(({ clock }, dt) => {
    acc.current += dt;
    const mesh = ledRef.current;
    if (!mesh || acc.current < 0.08) return;
    acc.current = 0;
    const time = clock.getElapsedTime();
    leds.forEach((l, i) => {
      const on = Math.sin(time * l.speed + l.phase) > -0.2;
      const c = l.hue < d.dueRatio ? DUE_LED : l.hue < d.dueRatio + d.newRatio ? NEW_LED : accent;
      mesh.setColorAt(i, on ? c : off);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {[-1, 1].flatMap((side) =>
        [0, 1, 2, 3].map((k) => (
          <group key={`${side}:${k}`} position={[-3.3 + k * 1.15, 0, side * 1.8]}>
            <Box p={[0, 1.15, 0]} s={[0.95, 2.3, 0.9]} color={t.furniture} metal={0.7} rough={0.35} />
            <Box p={[0, 2.32, 0]} s={[0.97, 0.04, 0.92]} color={t.accent} emissive={t.accent} ei={0.5} />
            {/* Card slots */}
            {[0.4, 0.9, 1.4, 1.9].map((y) => (
              <Box key={y} p={[0, y, side * -0.452]} s={[0.8, 0.03, 0.01]} color="#050708" />
            ))}
          </group>
        ))
      )}
      <instancedMesh ref={ledRef} args={[undefined, undefined, leds.length]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.05, 0.02]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* Overhead cable tray */}
      <Box p={[-1.5, 3.9, 0]} s={[5, 0.08, 0.6]} color="#2a3238" metal={0.8} rough={0.3} />
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [-1.5, 3.1, 0],
          [1.8, 2.9, 0],
          [1.8, 3.5, -2.2],
        ]}
      />
    </group>
  );
}

/** A loop of recall nodes (one per topic, ringed white once mastered) turning over a pedestal. */
function OrbitDecor({ t, d }: DecorProps) {
  const states = Math.min(7, Math.max(3, d.levels.length));
  const pts = useMemo<V3[]>(() => {
    const R = 1.7;
    return Array.from({ length: states }, (_, i) => {
      const a = (i / states) * Math.PI * 2;
      return [Math.cos(a) * R, 0, Math.sin(a) * R];
    });
  }, [states]);
  const arrows = useMemo(
    () =>
      pts.map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const dir = new THREE.Vector3(q[0] - p[0], 0, q[2] - p[2]).normalize();
        const a: V3 = [p[0] + dir.x * 0.32, 0, p[2] + dir.z * 0.32];
        const b: V3 = [q[0] - dir.x * 0.34, 0, q[2] - dir.z * 0.34];
        return { a, b, quat: new THREE.Quaternion().setFromUnitVectors(_up, dir) };
      }),
    [pts]
  );
  return (
    <group>
      {/* Pedestal + floor glyph */}
      <Box p={[-1, 0.4, 0]} s={[1, 0.8, 1]} color={t.furniture} emissive={t.accent} ei={0.15} />
      <mesh position={[-1, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.3, 2.38, 64]} />
        <meshBasicMaterial color={t.accent} toneMapped={false} transparent opacity={0.6} />
      </mesh>
      <Spin p={[-1, 3.1, 0]} speed={0.25}>
        {pts.map((p, i) => (
          <group key={i} position={p}>
            <mesh>
              <torusGeometry args={[0.28, 0.035, 10, 32]} />
              <meshBasicMaterial color={t.accent} toneMapped={false} />
            </mesh>
            {(d.levels[i]?.value ?? 0) >= MASTERED && (
              <mesh>
                <torusGeometry args={[0.2, 0.025, 10, 32]} />
                <meshBasicMaterial color="#ffffff" toneMapped={false} />
              </mesh>
            )}
          </group>
        ))}
        {arrows.map(({ a, b, quat }, i) => (
          <group key={`e${i}`}>
            <Edge a={a} b={b} color="#ffffff" radius={0.015} />
            <mesh position={b} quaternion={quat}>
              <coneGeometry args={[0.07, 0.18, 10]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </group>
        ))}
        {/* "Again" loop on the first node */}
        <mesh position={[pts[0][0] + 0.35, 0.3, pts[0][2]]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.18, 0.015, 8, 24, Math.PI * 1.5]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </Spin>
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [1.5, 2.6, -2],
          [1.4, 3.3, 2],
          [1.6, 3.9, 0],
        ]}
      />
    </group>
  );
}

// ─── Projects ───

const BUILD_TREE: { p: V3; parent: number }[] = [
  { p: [0, 1, 0], parent: -1 },
  { p: [-0.9, 0.35, 0], parent: 0 },
  { p: [0, 0.35, 0], parent: 0 },
  { p: [0.9, 0.35, 0], parent: 0 },
  { p: [-0.9, -0.3, 0], parent: 1 },
  { p: [0.9, -0.3, 0], parent: 3 },
];

function ForgeDecor({ t, d }: DecorProps) {
  return (
    <group>
      {/* Anvil */}
      <Box p={[-1.5, 0.3, 0]} s={[0.7, 0.6, 0.9]} color="#2b2b2b" metal={0.8} rough={0.3} />
      <Box p={[-1.5, 0.72, 0]} s={[0.55, 0.24, 1.2]} color="#3d3d3d" metal={0.9} rough={0.25} />
      <Glow p={[-1.5, 0.86, 0.1]} s={[0.2, 0.04, 0.35]} color="#ff6d00" />
      <pointLight position={[-1.5, 1.2, 0]} color="#ff6d00" intensity={3} distance={4} />
      {/* Ingots */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[0.4, 0.2, -1.6 + i * 0.8]} s={[0.4, 0.4, 0.4]} color={t.furniture} emissive={t.accent} ei={0.25} r={[0, i * 0.2, 0]} />
      ))}
      {/* What is being built */}
      <Spin p={[-1.5, 3.2, 0]} speed={0.2}>
        {BUILD_TREE.map((n, i) => (
          <group key={i}>
            <mesh position={n.p}>
              <boxGeometry args={[0.28, 0.28, 0.28]} />
              <meshBasicMaterial color={n.parent < 0 ? '#ffffff' : t.accent} toneMapped={false} />
            </mesh>
            {n.parent >= 0 && <Edge a={BUILD_TREE[n.parent].p} b={n.p} color={t.accent} radius={0.018} />}
          </group>
        ))}
      </Spin>
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [1.2, 2.8, 1.6],
          [1.2, 3.4, -1.6],
          [0.2, 3.9, 0],
        ]}
      />
    </group>
  );
}

function WorkshopDecor({ t, d }: DecorProps) {
  return (
    <group>
      <Box p={[-2.8, 0.45, 0]} s={[1, 0.9, 6]} color={t.furniture} metal={0.4} />
      {/* Tool drawers */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={i} p={[-2.8, 1.1, -2.6 + i * 0.75]} s={[0.6, 0.4, 0.6]} color="#0e1422" emissive={t.accent} ei={i === 2 || i === 6 ? 0.7 : 0.12} />
      ))}
      {/* Power arcs between benches */}
      {[
        [-1, 2],
        [2, 6],
      ].map(([from, to]) => {
        const a: V3 = [-2.6, 1.4, -2.6 + from * 0.75];
        const mid: V3 = [-2.1, 2.4, -2.6 + ((from + to) / 2) * 0.75];
        const b: V3 = [-2.6, 1.4, -2.6 + to * 0.75];
        return (
          <group key={`${from}-${to}`}>
            <Edge a={a} b={mid} color={t.accent} radius={0.02} />
            <Edge a={mid} b={b} color={t.accent} radius={0.02} />
            <Glow p={b} s={0.07} color="#ffffff" sphere />
          </group>
        );
      })}
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [0.6, 2.9, 0],
          [0.9, 3.4, -2],
          [0.9, 3.4, 2],
        ]}
      />
    </group>
  );
}

function DepotDecor({ t, d }: DecorProps) {
  const crate = t.furniture;
  const tree: { p: V3; parent: number }[] = [
    { p: [0, 0.9, 0], parent: -1 },
    { p: [-0.9, 0.3, 0], parent: 0 },
    { p: [0.9, 0.3, 0], parent: 0 },
    { p: [-1.3, -0.3, 0], parent: 1 },
    { p: [-0.5, -0.3, 0], parent: 1 },
    { p: [0.5, -0.3, 0], parent: 2 },
    { p: [1.3, -0.3, 0], parent: 2 },
  ];
  return (
    <group>
      {/* Crate tower */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[-3, 0.25 + i * 0.52, -1.8]} s={[1, 0.48, 1]} color={crate} rough={0.9} r={[0, i * 0.08, 0]} />
      ))}
      <Glow p={[-3, 2.95, -1.8]} s={[0.6, 0.05, 0.6]} color={t.accent} />
      {/* Shipping line (the front crate is next out) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} p={[-1, 0.3, 0.2 + i * 0.6]} s={[0.8, 0.55, 0.52]} color={crate} rough={0.9} emissive={i === 0 ? t.accent : undefined} ei={i === 0 ? 0.35 : 0} />
      ))}
      {/* Roadmap tree */}
      <Spin p={[1.2, 3, -0.5]} speed={0.3}>
        {tree.map((n, i) => (
          <group key={i}>
            <mesh position={n.p}>
              <sphereGeometry args={[0.16, 14, 14]} />
              <meshBasicMaterial color={i === 0 ? '#ffffff' : t.accent} toneMapped={false} />
            </mesh>
            {n.parent >= 0 && <Edge a={tree[n.parent].p} b={n.p} color={t.accent} radius={0.02} />}
          </group>
        ))}
      </Spin>
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [-2, 3.4, 1.8],
          [0.8, 3.7, -2.4],
          [0.8, 2.9, 2.2],
        ]}
      />
    </group>
  );
}

const PIPELINE_STAGES = ['Ideas', 'Build', 'Test', 'Ship'];

/** Project Forge stages as pedestals; each column's height is the share of projects in it. */
function PipelineDecor({ t, d }: DecorProps) {
  const packet = useRef<THREE.Mesh | null>(null);
  useFrame(({ clock }) => {
    if (!packet.current) return;
    const u = (clock.getElapsedTime() * 0.25) % 1;
    packet.current.position.set(-2, 1.55, -1.8 + u * 3.6);
  });
  return (
    <group>
      {PIPELINE_STAGES.map((stage, i) => {
        const share = d.levels[i]?.value ?? 0;
        const h = 0.1 + share * 1.2;
        return (
          <group key={stage} position={[-2, 0, -1.8 + i * 1.2]}>
            <Box p={[0, 0.6, 0]} s={[0.9, 1.2, 0.9]} color={t.furniture} metal={0.6} rough={0.35} />
            <Box p={[0, 1.22, 0]} s={[0.92, 0.04, 0.92]} color={t.accent} emissive={t.accent} ei={0.6} />
            <Glow p={[0.3, 1.24 + h / 2, 0]} s={[0.12, h, 0.5]} color={i === 3 ? MASTERED_COLOR : t.accent} />
            <FloatingText text={(d.levels[i]?.label ?? stage).toUpperCase()} color={t.accent} p={[0, 2.35, 0]} width={0.9} speed={1} phase={i} />
          </group>
        );
      })}
      <mesh ref={packet}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* Light grid on the ceiling */}
      {Array.from({ length: 12 }).map((_, i) => (
        <Glow key={i} p={[(i % 4) * 0.5 - 0.75, 4.6, Math.floor(i / 4) * 0.5 - 0.5]} s={[0.4, 0.05, 0.4]} color={i % 3 === 0 ? '#ffffff' : t.accent} />
      ))}
      <Words
        words={d.words}
        color={t.accent}
        spots={[
          [0.8, 3, 1.5],
          [0.8, 3.5, -1.5],
        ]}
      />
    </group>
  );
}

const DECOR: Record<RoomStyle, (props: DecorProps) => React.ReactElement> = {
  library: LibraryDecor,
  observatory: ObservatoryDecor,
  lattice: LatticeDecor,
  network: NetworkDecor,
  archive: ArchiveDecor,
  laboratory: LaboratoryDecor,
  vault: VaultDecor,
  orbit: OrbitDecor,
  forge: ForgeDecor,
  workshop: WorkshopDecor,
  depot: DepotDecor,
  pipeline: PipelineDecor,
};

function RoomDecorInner({ theme, decor, seed }: { theme: RoomTheme; decor: RoomDecorData; seed: string }) {
  const Decor = DECOR[theme.style] ?? ArchiveDecor;
  return <Decor t={theme} d={decor} seed={seed} />;
}

export const RoomDecor = memo(RoomDecorInner);
