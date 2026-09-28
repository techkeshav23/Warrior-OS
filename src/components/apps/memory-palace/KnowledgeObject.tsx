// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Knowledge Object
// 3D object on a shelf representing a note. Shape = type,
// glow = revision recency, red border = due for revision.
// ═══════════════════════════════════════════════════════════

'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { Mesh, Group } from 'three';

// ─────────────────────────────────────────────────────────────
// Palace note model (derived from warrior-notes localStorage)
// ─────────────────────────────────────────────────────────────

export type NoteObjectType = 'concept' | 'formula' | 'question';

export interface PalaceNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string; // ISO
  subject: string; // GateSubject key or 'General'
  type: NoteObjectType;
}

/** Recency buckets → glow color + intensity. */
function recencyStyle(updatedAt: string): { color: string; intensity: number; cobweb: boolean } {
  const now = Date.now();
  const ts = Date.parse(updatedAt);
  const days = isNaN(ts) ? 999 : (now - ts) / 86_400_000;
  if (days < 1) return { color: '#00f0ff', intensity: 1.4, cobweb: false }; // today — bright cyan
  if (days < 7) return { color: '#00c8d4', intensity: 0.9, cobweb: false }; // this week — medium
  if (days < 30) return { color: '#ff9800', intensity: 0.5, cobweb: false }; // this month — dim orange
  return { color: '#5a4a2a', intensity: 0.12, cobweb: true }; // never/old — almost dark
}

/** Spaced-repetition urgency: due if last revision older than interval by tag/age. */
export function isDueForRevision(note: PalaceNote): boolean {
  const ts = Date.parse(note.updatedAt);
  if (isNaN(ts)) return true;
  const days = (Date.now() - ts) / 86_400_000;
  // simple SM-style urgency: anything untouched 7+ days is "due"
  return days >= 7;
}

interface KnowledgeObjectProps {
  note: PalaceNote;
  position: [number, number, number];
  onOpen: (note: PalaceNote) => void;
}

export function KnowledgeObject({ note, position, onOpen }: KnowledgeObjectProps) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const style = recencyStyle(note.updatedAt);
  const due = isDueForRevision(note);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (hovered ? 1.2 : 0.4);
    }
    if (groupRef.current) {
      // gentle bob
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.001 + position[0]) * 0.06;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(note);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Due-for-revision red halo ring */}
      {due && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
          <ringGeometry args={[0.42, 0.52, 24]} />
          <meshBasicMaterial color="#ff1744" toneMapped={false} transparent opacity={0.85} />
        </mesh>
      )}

      <mesh ref={meshRef} scale={hovered ? 1.25 : 1}>
        {note.type === 'concept' && <boxGeometry args={[0.5, 0.5, 0.5]} />}
        {note.type === 'formula' && <cylinderGeometry args={[0.18, 0.18, 0.6, 12]} />}
        {note.type === 'question' && <sphereGeometry args={[0.32, 20, 20]} />}
        <meshStandardMaterial
          color={style.color}
          emissive={style.color}
          emissiveIntensity={style.intensity}
          roughness={0.35}
          metalness={0.4}
          transparent
          opacity={style.cobweb ? 0.7 : 1}
        />
      </mesh>

      {/* cobweb hint for never-revised */}
      {style.cobweb && (
        <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.34, 6]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.25} wireframe />
        </mesh>
      )}

      {/* Floating title on hover */}
      {hovered && (
        <Html center distanceFactor={10} position={[0, 0.9, 0]} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-white/20 bg-black/80 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            {note.title}
            {due && <span className="ml-1 text-accent-danger">● due</span>}
          </div>
        </Html>
      )}
    </group>
  );
}
