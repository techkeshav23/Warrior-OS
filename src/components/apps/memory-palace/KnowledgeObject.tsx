// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Knowledge Object (spec 6.25 + 6.29)
// A note, deck card or project sitting on a shelf.
//   shape  = what it is  → cube (concept note) · scroll (formula note) ·
//                          sphere (question note) · index card (deck card) ·
//                          crystal (project)
//   glow   = recency     → bright cyan (today) · medium (this week) ·
//                          dim orange (this month) · almost dark + cobwebs
//   border = spaced repetition (Training Grounds reviews / palace log):
//            pulsing RED = due · AMBER = card never studied
// Hover shows the title floating above; click opens its hologram.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ObjectShape, PalaceItem, PalaceItemKind, PalaceReview, RecencyBucket } from './palaceData';
import { DUE_HEX, NEW_HEX, PALACE, RECENCY_HEX, STALE_LABEL_HEX } from './palaceTheme';

export type { PalaceItem, ObjectShape } from './palaceData';

/** Due for revision (spaced repetition) — kept as a helper for other modules. */
export function isDueForRevision(review: Pick<PalaceReview, 'isDue'>): boolean {
  return review.isDue;
}

export const DUE_COLOR: string = DUE_HEX;
/** Outline of deck cards that were never studied. */
export const NEW_COLOR: string = NEW_HEX;

export const KIND_LABELS: Record<PalaceItemKind, string> = { note: 'note', card: 'card', project: 'project' };

export interface RecencyStyle {
  color: string;
  intensity: number;
  opacity: number;
  cobweb: boolean;
  label: string;
}

export const RECENCY_STYLES: Record<RecencyBucket, RecencyStyle> = {
  today: { color: RECENCY_HEX.today, intensity: 1.5, opacity: 1, cobweb: false, label: 'Fresh today' },
  week: { color: RECENCY_HEX.week, intensity: 0.75, opacity: 1, cobweb: false, label: 'This week' },
  month: { color: RECENCY_HEX.month, intensity: 0.32, opacity: 0.95, cobweb: false, label: 'This month' },
  stale: { color: RECENCY_HEX.stale, intensity: 0.05, opacity: 0.85, cobweb: true, label: 'Gathering dust' },
};

/** A colour that stays readable in DOM overlays (stale objects are nearly dark in 3D). */
export function recencyLabelColor(bucket: RecencyBucket): string {
  return bucket === 'stale' ? STALE_LABEL_HEX : RECENCY_STYLES[bucket].color;
}

// ─────────────────────────────────────────────────────────────
// Shapes
// ─────────────────────────────────────────────────────────────

export function ShapeGeometry({ type, outline = false }: { type: ObjectShape; outline?: boolean }) {
  const k = outline ? 1.14 : 1;
  if (type === 'question') return <sphereGeometry args={[0.24 * k, 24, 24]} />;
  if (type === 'formula') return <cylinderGeometry args={[0.11 * k, 0.11 * k, 0.5 * k, 16]} />;
  // An upright index card; the outline gets extra depth so it shows round the edges.
  if (type === 'card') return <boxGeometry args={[0.46 * k, 0.32 * k, outline ? 0.09 : 0.035]} />;
  if (type === 'project') return <octahedronGeometry args={[0.26 * k, 0]} />;
  return <boxGeometry args={[0.36 * k, 0.36 * k, 0.36 * k]} />;
}

function ScrollKnobs({ color }: { color: string }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, s * 0.28, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.1, 8]} />
          <meshStandardMaterial color={PALACE.scrollKnob} emissive={color} emissiveIntensity={0.2} />
        </mesh>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Cobwebs (long-untouched objects)
// ─────────────────────────────────────────────────────────────

function Cobwebs({ seed }: { seed: number }) {
  const ref = useRef<THREE.Points | null>(null);
  const geometry = useMemo(() => {
    let s = seed || 1;
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const n = 36;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.22 + rand() * 0.22;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = -0.1 + rand() * 0.45;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, [seed]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.15;
  });

  return (
    <group>
      <points ref={ref} geometry={geometry}>
        <pointsMaterial color={PALACE.cobwebDust} size={0.025} transparent opacity={0.5} depthWrite={false} />
      </points>
      {/* Web strands to the shelf corner */}
      <mesh position={[0.18, 0.2, 0]} rotation={[0, 0, 0.6]}>
        <planeGeometry args={[0.5, 0.5, 4, 4]} />
        <meshBasicMaterial color={PALACE.cobwebWeb} wireframe transparent opacity={0.16} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Knowledge object
// ─────────────────────────────────────────────────────────────

interface KnowledgeObjectProps {
  item: PalaceItem;
  review: PalaceReview;
  /** Position in the parent's (room-local) space. */
  position: [number, number, number];
  /** Hidden while its hologram is out. */
  lifted?: boolean;
  onOpen: (item: PalaceItem, worldPosition: [number, number, number]) => void;
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function KnowledgeObjectInner({ item, review, position, lifted = false, onOpen }: KnowledgeObjectProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const shapeRef = useRef<THREE.Group | null>(null);
  const outlineRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const [hovered, setHovered] = useState(false);
  const style = RECENCY_STYLES[review.recency];
  const seed = useMemo(() => hashSeed(item.id), [item.id]);
  const phase = (seed % 1000) / 160;

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    if (shapeRef.current) {
      shapeRef.current.rotation.y += dt * (hovered ? 1.4 : review.recency === 'stale' ? 0.05 : 0.35);
      const target = hovered ? 1.22 : 1;
      const s = shapeRef.current.scale.x + (target - shapeRef.current.scale.x) * Math.min(1, dt * 10);
      shapeRef.current.scale.setScalar(s);
    }
    if (groupRef.current && review.recency !== 'stale') {
      groupRef.current.position.y = position[1] + Math.sin(t * 1.2 + phase) * 0.035;
    }
    if (outlineRef.current) {
      outlineRef.current.opacity = 0.55 + 0.35 * Math.sin(t * 4 + phase);
    }
  });

  if (lifted) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const wp = new THREE.Vector3();
    (groupRef.current ?? e.object).getWorldPosition(wp);
    onOpen(item, [wp.x, wp.y, wp.z]);
  };

  const dueLabel = review.isNew
    ? 'new · not studied yet'
    : review.isDue
      ? review.overdueDays > 0
        ? `due · ${review.overdueDays}d overdue`
        : 'due today'
      : null;
  const outline = review.isDue ? DUE_COLOR : review.isNew ? NEW_COLOR : null;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <group ref={shapeRef} rotation={item.shape === 'formula' ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
        <mesh castShadow>
          <ShapeGeometry type={item.shape} />
          <meshStandardMaterial
            color={style.color}
            emissive={style.color}
            emissiveIntensity={hovered ? style.intensity + 0.5 : style.intensity}
            roughness={review.recency === 'stale' ? 0.95 : 0.3}
            metalness={0.35}
            transparent={style.opacity < 1}
            opacity={style.opacity}
          />
        </mesh>
        {item.shape === 'formula' && <ScrollKnobs color={style.color} />}
        {/* Spaced repetition: due → red border, never studied → amber */}
        {outline && (
          <mesh>
            <ShapeGeometry type={item.shape} outline />
            <meshBasicMaterial ref={outlineRef} color={outline} side={THREE.BackSide} transparent opacity={0.8} toneMapped={false} />
          </mesh>
        )}
      </group>

      {style.cobweb && <Cobwebs seed={seed} />}

      {/* Soft halo for fresh knowledge */}
      {(review.recency === 'today' || review.recency === 'week') && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.27, 0]}>
          <circleGeometry args={[0.3, 24]} />
          <meshBasicMaterial color={style.color} transparent opacity={review.recency === 'today' ? 0.35 : 0.18} toneMapped={false} depthWrite={false} />
        </mesh>
      )}

      {hovered && (
        <Html center position={[0, 0.62, 0]} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className="glass-popover whitespace-nowrap rounded-control px-3 py-2 text-center">
            <div className="max-w-[220px] truncate text-xs font-semibold text-fg">{item.title}</div>
            <div className="mt-1 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
              <span style={{ color: recencyLabelColor(review.recency) }}>{style.label}</span>
              <span className="text-fg-faint">·</span>
              <span className="text-fg-subtle">{KIND_LABELS[item.kind]}</span>
              {dueLabel && (
                <>
                  <span className="text-fg-faint">·</span>
                  <span className={review.isNew ? 'text-warning' : 'text-danger'}>{dueLabel}</span>
                </>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export const KnowledgeObject = memo(KnowledgeObjectInner);
