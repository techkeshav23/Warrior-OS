// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace App
// 3D walkable knowledge space. First-person WASD + mouse-look,
// procedural subject rooms, notes as glowing objects, holograms.
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { cn } from '@/lib/utils';
import type { GateSubject } from '@/types/gate';
import { PalaceRoom, ROOM_THEMES, ROOM_SIZE, roomGridPosition, type RoomTheme } from './PalaceRoomGenerator';
import { KnowledgeObject, isDueForRevision, type PalaceNote, type NoteObjectType } from './KnowledgeObject';
import { NoteHologram } from './NoteHologram';
import { PalaceNavigation, type RoomLayout } from './PalaceNavigation';

// ─────────────────────────────────────────────────────────────
// Note loading + subject/type inference (warrior-notes localStorage)
// ─────────────────────────────────────────────────────────────

interface RawNote {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  updatedAt?: string;
  createdAt?: string;
}

const SUBJECT_KEYS = Object.keys(ROOM_THEMES) as GateSubject[];

function inferSubject(note: RawNote): GateSubject {
  const hay = `${note.title} ${(note.tags || []).join(' ')}`.toLowerCase();
  for (const s of SUBJECT_KEYS) {
    const key = s.toLowerCase();
    if (hay.includes(key) || (note.tags || []).some((t) => t.toLowerCase() === key)) return s;
  }
  // keyword fallbacks
  if (/\bsql|database|normal|transaction\b/.test(hay)) return 'DBMS';
  if (/\bprocess|thread|schedul|deadlock|semaphore\b/.test(hay)) return 'OS';
  if (/\btcp|ip|network|routing|packet\b/.test(hay)) return 'CN';
  if (/\bautomata|turing|regular|grammar\b/.test(hay)) return 'TOC';
  if (/\btree|graph|stack|queue|heap|linked\b/.test(hay)) return 'Data Structures';
  if (/\bsort|greedy|dynamic|complexity|algo\b/.test(hay)) return 'DAA';
  // deterministic spread across subjects
  return SUBJECT_KEYS[hashCode(note.id) % SUBJECT_KEYS.length];
}

function inferType(note: RawNote): NoteObjectType {
  const c = `${note.title} ${note.content}`.toLowerCase();
  if (/\?|question|quiz|pyq/.test(c)) return 'question';
  if (/formula|equation|=|theorem|\$/.test(c)) return 'formula';
  return 'concept';
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function loadPalaceNotes(): PalaceNote[] {
  if (typeof window === 'undefined') return [];
  let raw: RawNote[] = [];
  try {
    raw = JSON.parse(localStorage.getItem('warrior-notes') || '[]');
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw) || raw.length === 0) return SEED_NOTES;
  return raw.map((n) => ({
    id: n.id,
    title: n.title || 'Untitled',
    content: n.content || '',
    tags: n.tags || [],
    updatedAt: n.updatedAt || n.createdAt || new Date().toISOString(),
    subject: inferSubject(n),
    type: inferType(n),
  }));
}

const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

const SEED_NOTES: PalaceNote[] = [
  { id: 'seed-1', title: 'ACID Properties', content: '## ACID\n- **Atomicity**\n- **Consistency**\n- **Isolation**\n- **Durability**', tags: ['dbms'], updatedAt: daysAgo(0), subject: 'DBMS', type: 'concept' },
  { id: 'seed-2', title: 'Banker\'s Algorithm', content: 'Deadlock **avoidance**. Safe sequence check.', tags: ['os'], updatedAt: daysAgo(3), subject: 'OS', type: 'concept' },
  { id: 'seed-3', title: 'TCP 3-way Handshake', content: 'SYN → SYN-ACK → ACK', tags: ['cn'], updatedAt: daysAgo(10), subject: 'CN', type: 'concept' },
  { id: 'seed-4', title: 'Pumping Lemma', content: 'For regular languages: `xy^i z`', tags: ['toc'], updatedAt: daysAgo(40), subject: 'TOC', type: 'formula' },
  { id: 'seed-5', title: 'What is a B+ Tree?', content: 'Balanced tree question for indexing?', tags: ['ds'], updatedAt: daysAgo(1), subject: 'Data Structures', type: 'question' },
  { id: 'seed-6', title: 'Master Theorem', content: 'T(n) = aT(n/b) + f(n)', tags: ['daa'], updatedAt: daysAgo(6), subject: 'DAA', type: 'formula' },
];

// ─────────────────────────────────────────────────────────────
// Player controller — WASD + gravity + simple AABB wall collision
// ─────────────────────────────────────────────────────────────

interface PlayerControllerProps {
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
  onMove: (pos: [number, number]) => void;
  teleportTarget: [number, number] | null;
  onTeleported: () => void;
  roomCenters: [number, number][];
}

const MOVE_SPEED = 6;
const EYE_HEIGHT = 1.7;

function PlayerController({ controlsRef, onMove, teleportTarget, onTeleported, roomCenters }: PlayerControllerProps) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const velocity = useRef(new THREE.Vector3());
  const frameCount = useRef(0);

  useEffect(() => {
    camera.position.set(0, EYE_HEIGHT, 0);
  }, [camera]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    if (teleportTarget) {
      camera.position.set(teleportTarget[0], EYE_HEIGHT, teleportTarget[1]);
      onTeleported();
    }
  }, [teleportTarget, camera, onTeleported]);

  // Clamp a position to stay inside the nearest room's interior bounds.
  const clampToRoom = useCallback(
    (pos: THREE.Vector3) => {
      let nearest: [number, number] | null = null;
      let best = Infinity;
      for (const [cx, cz] of roomCenters) {
        const d = (pos.x - cx) ** 2 + (pos.z - cz) ** 2;
        if (d < best) {
          best = d;
          nearest = [cx, cz];
        }
      }
      if (!nearest) return;
      const margin = ROOM_SIZE / 2 - 0.8;
      // Only clamp when clearly inside a room footprint (avoid trapping in corridors)
      const dx = pos.x - nearest[0];
      const dz = pos.z - nearest[1];
      if (Math.abs(dx) < ROOM_SIZE / 2 + 3 && Math.abs(dz) < ROOM_SIZE / 2 + 3) {
        pos.x = nearest[0] + Math.max(-margin, Math.min(margin, dx));
        pos.z = nearest[1] + Math.max(-margin, Math.min(margin, dz));
      }
    },
    [roomCenters]
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const forward = (keys.current['KeyW'] ? 1 : 0) - (keys.current['KeyS'] ? 1 : 0);
    const right = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0);

    velocity.current.x -= velocity.current.x * 10 * dt;
    velocity.current.z -= velocity.current.z * 10 * dt;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const rightVec = new THREE.Vector3().crossVectors(dir, camera.up).normalize();

    velocity.current.addScaledVector(dir, forward * MOVE_SPEED * dt);
    velocity.current.addScaledVector(rightVec, right * MOVE_SPEED * dt);

    camera.position.addScaledVector(velocity.current, 1);
    camera.position.y = EYE_HEIGHT; // gravity-locked to floor
    clampToRoom(camera.position);

    // throttle minimap updates (~10fps)
    frameCount.current++;
    if (frameCount.current % 6 === 0) {
      onMove([camera.position.x, camera.position.z]);
    }
  });

  return <PointerLockControls ref={controlsRef} />;
}

// ─────────────────────────────────────────────────────────────
// Shelf note placement inside a room
// ─────────────────────────────────────────────────────────────

function noteShelfPosition(index: number, origin: [number, number]): [number, number, number] {
  const perSide = 4;
  const side = Math.floor(index / perSide) % 2 === 0 ? -1 : 1;
  const slot = index % perSide;
  const x = origin[0] + side * (ROOM_SIZE / 2 - 1.6);
  const z = origin[1] - ROOM_SIZE / 2 + 2 + slot * ((ROOM_SIZE - 4) / (perSide - 1));
  const y = 1.2 + (Math.floor(index / (perSide * 2)) % 2) * 1.1;
  return [x, y, z];
}

// ─────────────────────────────────────────────────────────────
// Main app
// ─────────────────────────────────────────────────────────────

interface OpenHologram {
  note: PalaceNote;
  position: [number, number, number];
}

function MemoryPalaceAppInner() {
  const [notes, setNotes] = useState<PalaceNote[]>([]);
  const [locked, setLocked] = useState(false);
  const [playerPos, setPlayerPos] = useState<[number, number]>([0, 0]);
  const [teleportTarget, setTeleportTarget] = useState<[number, number] | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [holograms, setHolograms] = useState<OpenHologram[]>([]);
  const controlsRef = useRef<PointerLockControlsImpl | null>(null);

  useEffect(() => {
    setNotes(loadPalaceNotes());
  }, []);

  // Group notes by subject → only unlocked rooms (palace growth: >=1 note OR seed).
  const rooms: RoomLayout[] = useMemo(() => {
    const bySubject = new Map<GateSubject, PalaceNote[]>();
    for (const n of notes) {
      const s = (n.subject as GateSubject) in ROOM_THEMES ? (n.subject as GateSubject) : 'DBMS';
      if (!bySubject.has(s)) bySubject.set(s, []);
      bySubject.get(s)!.push(n);
    }
    // palace growth: total notes determine how many rooms materialize (>=1 room)
    const unlockedRoomCount = Math.max(1, Math.min(SUBJECT_KEYS.length, Math.ceil(notes.length / 3) + bySubject.size));
    const subjects = SUBJECT_KEYS.filter((s) => bySubject.has(s)).slice(0, unlockedRoomCount);
    // ensure at least the first subject room exists
    const chosen = subjects.length > 0 ? subjects : [SUBJECT_KEYS[0]];
    return chosen.map((subject, i) => {
      const theme: RoomTheme = ROOM_THEMES[subject];
      const origin = roomGridPosition(i);
      return { theme, origin, noteCount: (bySubject.get(subject) || []).length };
    });
  }, [notes]);

  const roomCenters = useMemo<[number, number][]>(() => rooms.map((r) => r.origin), [rooms]);

  const notesBySubject = useMemo(() => {
    const m = new Map<string, PalaceNote[]>();
    for (const n of notes) {
      if (!m.has(n.subject)) m.set(n.subject, []);
      m.get(n.subject)!.push(n);
    }
    return m;
  }, [notes]);

  const dueCount = useMemo(() => notes.filter(isDueForRevision).length, [notes]);

  const handleMove = useCallback((pos: [number, number]) => {
    setPlayerPos(pos);
    // detect room entry → breadcrumb
    setBreadcrumbs((prev) => {
      let entered: string | null = null;
      for (const r of rooms) {
        if (Math.abs(pos[0] - r.origin[0]) < ROOM_SIZE / 2 && Math.abs(pos[1] - r.origin[1]) < ROOM_SIZE / 2) {
          entered = r.theme.subject;
          break;
        }
      }
      if (entered && prev[prev.length - 1] !== entered) return [...prev.slice(-6), entered];
      return prev;
    });
  }, [rooms]);

  const handleTeleport = useCallback((origin: [number, number]) => {
    setTeleportTarget([origin[0], origin[1]]);
  }, []);

  const openHologram = useCallback((note: PalaceNote) => {
    setHolograms((prev) => {
      if (prev.some((h) => h.note.id === note.id)) return prev;
      // place hologram near player, floating at eye level
      const angle = prev.length * 0.6;
      const pos: [number, number, number] = [playerPos[0] + Math.sin(angle) * 2, 2, playerPos[1] + Math.cos(angle) * 2 - 2];
      return [...prev, { note, position: pos }];
    });
  }, [playerPos]);

  const closeHologram = useCallback((id: string) => {
    setHolograms((prev) => prev.filter((h) => h.note.id !== id));
  }, []);

  return (
    <div className="relative h-full w-full bg-void">
      <Canvas
        shadows
        camera={{ fov: 72, near: 0.1, far: 200, position: [0, EYE_HEIGHT, 0] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#04040a']} />
        <fog attach="fog" args={['#04040a', 12, 60]} />
        <hemisphereLight intensity={0.3} groundColor="#000000" />

        {rooms.map((r) => (
          <PalaceRoom key={r.theme.subject} theme={r.theme} origin={r.origin}>
            {(notesBySubject.get(r.theme.subject) || []).slice(0, 8).map((note, i) => (
              <KnowledgeObject
                key={note.id}
                note={note}
                position={noteShelfPosition(i, [0, 0])}
                onOpen={openHologram}
              />
            ))}
          </PalaceRoom>
        ))}

        {holograms.map((h) => (
          <NoteHologram key={h.note.id} note={h.note} position={h.position} onClose={closeHologram} />
        ))}

        <PlayerController
          controlsRef={controlsRef}
          onMove={handleMove}
          teleportTarget={teleportTarget}
          onTeleported={() => setTeleportTarget(null)}
          roomCenters={roomCenters}
        />
      </Canvas>

      {/* DOM overlays (outside Canvas) */}
      <PalaceNavigation
        rooms={rooms}
        playerPos={playerPos}
        breadcrumbs={breadcrumbs}
        onTeleport={handleTeleport}
      />

      {/* Overview HUD — top-left */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-sm">
        <div className="font-display text-xs font-bold text-accent-primary">🏛️ MEMORY PALACE</div>
        <div className="mt-1 flex gap-3 text-[10px] text-white/60">
          <span>{notes.length} objects</span>
          <span>{rooms.length} rooms</span>
          <span className={cn(dueCount > 0 ? 'text-accent-danger' : 'text-accent-success')}>
            {dueCount} due
          </span>
        </div>
      </div>

      {/* Crosshair */}
      {locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/50" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/50" />
        </div>
      )}

      {/* Click-to-enter prompt */}
      {!locked && (
        <button
          onClick={() => controlsRef.current?.lock()}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-center backdrop-blur-sm"
        >
          <span className="font-display text-2xl font-bold text-accent-primary text-glow">Enter the Palace</span>
          <span className="text-sm text-white/70">Click to explore · WASD to move · Mouse to look</span>
          <span className="text-xs text-white/40">Press ESC to release the cursor · Click glowing objects to open notes</span>
        </button>
      )}

      {/* lock listener bridge */}
      <LockBridge controlsRef={controlsRef} onChange={setLocked} />
    </div>
  );
}

// Bridges PointerLockControls lock/unlock events to React state without
// re-rendering the Canvas subtree.
function LockBridge({
  controlsRef,
  onChange,
}: {
  controlsRef: React.RefObject<PointerLockControlsImpl | null>;
  onChange: (locked: boolean) => void;
}) {
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const onLock = () => onChange(true);
    const onUnlock = () => onChange(false);
    c.addEventListener('lock', onLock);
    c.addEventListener('unlock', onUnlock);
    return () => {
      c.removeEventListener('lock', onLock);
      c.removeEventListener('unlock', onUnlock);
    };
    // controlsRef.current becomes available after first render of controller
  });
  return null;
}

export const MemoryPalaceApp = memo(MemoryPalaceAppInner);
export default MemoryPalaceApp;
