// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Scene (client-only)
// Walkable 3D palace built from your notes (spec 6.23 – 6.29):
//   • first-person PointerLockControls camera, WASD (+ arrows), Shift
//     sprint, Space jump, gravity, collision with walls + furniture
//   • rooms per GATE subject (PalaceRoomGenerator + RoomDecor)
//   • notes as knowledge objects (KnowledgeObject) whose glow follows
//     revision recency and whose border turns red when spaced
//     repetition (palace log + GATE Arena 'warrior-revisions') says due
//   • holograms (NoteHologram), minimap / teleport fly-through /
//     breadcrumbs (PalaceNavigation), overview (PalaceOverview)
//   • growth from note count with brick-by-brick build (PalaceGrowth)
// Data is read from localStorage (Notes Archive's 'warrior-notes') and
// re-read live, so a note written elsewhere grows the palace at once.
// Loaded through next/dynamic with ssr:false (see MemoryPalaceApp).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { Compass, Eye, Hammer, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { sendPendingEvent } from '@/components/achievements/pending-events';
import { recordStudyAction } from '@/components/achievements/study-streak';
import { NOTES_SEARCH_EVENT, type NotesSearchDetail } from '@/components/apps/notes-archive/deep-link';
import { unlockPhase6Achievement } from '@/components/creature/osBridge';
import {
  CARTOGRAPHER_ROOMS,
  GATE_REVISIONS_KEY,
  PALACE_ACHIEVEMENT_IDS,
  computeNoteReview,
  loadGateRevisions,
  loadPalaceProgress,
  loadRevisionLog,
  markNoteRevised,
  parsePalaceNotes,
  readNotesRaw,
  reconcilePalaceAchievements,
  savePalaceProgress,
  type GateRevisionEntry,
  type NoteReview,
  type PalaceNote,
  type PalaceProgress,
  type PalaceRevisionLog,
  type RecencyBucket,
} from './palaceData';
import {
  EYE_HEIGHT,
  GrowthBuilder,
  allocateRooms,
  buildPalaceLayout,
  computePalaceGrowth,
  locate,
  roomToWorld,
  type Collider,
  type PalaceLayout,
  type PlacedRoom,
} from './PalaceGrowth';
import {
  GrandHall,
  PalaceRoom,
  PalaceSigns,
  PalaceStructure,
  ROOM_CAPACITY,
  ROOM_SLOTS,
  RoomLightPool,
} from './PalaceRoomGenerator';
import { DECOR_FOOTPRINTS, SHELF_FOOTPRINTS, type LocalRect } from './RoomDecor';
import { KnowledgeObject } from './KnowledgeObject';
import { NoteHologram } from './NoteHologram';
import { PalaceNavigation, type Breadcrumb, type RoomLayout } from './PalaceNavigation';
import { PalaceOverview, type PalaceSummary } from './PalaceOverview';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.5;
const GRAVITY = 18;
const JUMP_SPEED = 5.2;
const FLY_SPEED = 15;
const MAX_CONCURRENT_BUILDS = 12;
const POLL_MS = 3000;
const ROOM_CULL_DISTANCE = 50;

// ─────────────────────────────────────────────────────────────
// Pointer lock bridge (three-stdlib PointerLockControls)
// ─────────────────────────────────────────────────────────────

function PointerLockBridge({
  controlsRef,
  onLockChange,
}: {
  controlsRef: React.MutableRefObject<PointerLockControlsImpl | null>;
  onLockChange: (locked: boolean) => void;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setEvents = useThree((s) => s.setEvents);
  const get = useThree((s) => s.get);
  const onLockChangeRef = useRef(onLockChange);

  useEffect(() => {
    onLockChangeRef.current = onLockChange;
  });

  useEffect(() => {
    const controls = new PointerLockControlsImpl(camera, gl.domElement);
    controls.pointerSpeed = 0.9;
    controlsRef.current = controls;
    const originalCompute = get().events.compute;
    const onLock = () => {
      // While the cursor is captured, raycast from the screen centre (crosshair).
      setEvents({
        compute(_event, state) {
          state.pointer.set(0, 0);
          state.raycaster.setFromCamera(state.pointer, state.camera);
        },
      });
      onLockChangeRef.current(true);
    };
    const onUnlock = () => {
      setEvents({ compute: originalCompute });
      onLockChangeRef.current(false);
    };
    controls.addEventListener('lock', onLock);
    controls.addEventListener('unlock', onUnlock);
    return () => {
      controls.removeEventListener('lock', onLock);
      controls.removeEventListener('unlock', onUnlock);
      if (controls.isLocked) {
        try {
          document.exitPointerLock();
        } catch {
          /* ignore */
        }
      }
      controls.dispose();
      setEvents({ compute: originalCompute });
      controlsRef.current = null;
    };
  }, [camera, gl, setEvents, get, controlsRef]);

  return null;
}

// ─────────────────────────────────────────────────────────────
// Player (movement, gravity, collision, fly-through)
// ─────────────────────────────────────────────────────────────

export interface Flight {
  id: number;
  points: [number, number][];
  /** Where to look when the flight ends. */
  lookAt: [number, number] | null;
}

interface PlayerProps {
  locked: boolean;
  colliders: Collider[];
  bounds: PalaceLayout['bounds'];
  spawn: [number, number];
  flight: Flight | null;
  onFlightDone: (id: number) => void;
  onMove: (x: number, z: number, heading: number) => void;
}

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();

function collides(x: number, z: number, colliders: Collider[]): boolean {
  for (const c of colliders) {
    if (x + PLAYER_RADIUS > c.x0 && x - PLAYER_RADIUS < c.x1 && z + PLAYER_RADIUS > c.z0 && z - PLAYER_RADIUS < c.z1) return true;
  }
  return false;
}

function Player({ locked, colliders, bounds, spawn, flight, onFlightDone, onMove }: PlayerProps) {
  const camera = useThree((s) => s.camera);
  const keys = useRef<Record<string, boolean>>({});
  const vel = useRef(new THREE.Vector2());
  const vy = useRef(0);
  const y = useRef(EYE_HEIGHT);
  const report = useRef(0);
  const flightState = useRef<{ id: number; seg: number; t: number } | null>(null);
  const lockedRef = useRef(locked);

  useEffect(() => {
    lockedRef.current = locked;
    if (!locked) keys.current = {};
  }, [locked]);

  // Spawn once, looking down the corridor.
  useEffect(() => {
    camera.position.set(spawn[0], EYE_HEIGHT, spawn[1]);
    camera.rotation.set(0, 0, 0, 'YXZ');
    // spawn only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!lockedRef.current) return;
      keys.current[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const blur = () => {
      keys.current = {};
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (flight) flightState.current = { id: flight.id, seg: 0, t: 0 };
  }, [flight]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const pos = camera.position;

    // ── Fly-through (teleport) ──
    const fs = flightState.current;
    if (flight && fs && fs.id === flight.id) {
      const pts = flight.points;
      let remaining = FLY_SPEED * dt;
      while (remaining > 0 && fs.seg < pts.length - 1) {
        const [ax, az] = pts[fs.seg];
        const [bx, bz] = pts[fs.seg + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const left = len * (1 - fs.t);
        if (remaining >= left || len < 1e-4) {
          remaining -= left;
          fs.seg += 1;
          fs.t = 0;
        } else {
          fs.t += remaining / len;
          remaining = 0;
        }
      }
      const done = fs.seg >= pts.length - 1;
      const [ax, az] = pts[Math.min(fs.seg, pts.length - 1)];
      const [bx, bz] = pts[Math.min(fs.seg + 1, pts.length - 1)];
      pos.x = ax + (bx - ax) * fs.t;
      pos.z = az + (bz - az) * fs.t;
      y.current = EYE_HEIGHT;
      vy.current = 0;
      pos.y = EYE_HEIGHT;
      // Face the direction of travel; at the end face the room.
      let dx = bx - ax;
      let dz = bz - az;
      if (done || Math.hypot(dx, dz) < 1e-3) {
        if (flight.lookAt) {
          dx = flight.lookAt[0] - pos.x;
          dz = flight.lookAt[1] - pos.z;
        }
      }
      if (Math.hypot(dx, dz) > 1e-3) {
        _euler.setFromQuaternion(camera.quaternion);
        const targetYaw = Math.atan2(-dx, -dz);
        let diff = targetYaw - _euler.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        _euler.y += diff * Math.min(1, dt * 7);
        _euler.x += (0 - _euler.x) * Math.min(1, dt * 5);
        _euler.z = 0;
        camera.quaternion.setFromEuler(_euler);
      }
      if (done) {
        flightState.current = null;
        vel.current.set(0, 0);
        onFlightDone(flight.id);
      }
    } else {
      // ── Walking ──
      const k = keys.current;
      const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      const speed = k.ShiftLeft || k.ShiftRight ? SPRINT_SPEED : WALK_SPEED;
      camera.getWorldDirection(_fwd);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
      _fwd.normalize();
      _right.set(-_fwd.z, 0, _fwd.x);
      let wx = _fwd.x * fwd + _right.x * strafe;
      let wz = _fwd.z * fwd + _right.z * strafe;
      const len = Math.hypot(wx, wz);
      if (len > 0) {
        wx = (wx / len) * speed;
        wz = (wz / len) * speed;
      }
      // Smooth acceleration / friction.
      const a = Math.min(1, dt * 10);
      vel.current.x += (wx - vel.current.x) * a;
      vel.current.y += (wz - vel.current.y) * a;

      // Axis-separated collision (slides along walls).
      const nx = pos.x + vel.current.x * dt;
      if (!collides(nx, pos.z, colliders)) pos.x = nx;
      else vel.current.x = 0;
      const nz = pos.z + vel.current.y * dt;
      if (!collides(pos.x, nz, colliders)) pos.z = nz;
      else vel.current.y = 0;
      pos.x = Math.min(bounds.maxX - PLAYER_RADIUS, Math.max(bounds.minX + PLAYER_RADIUS, pos.x));
      pos.z = Math.min(bounds.maxZ - PLAYER_RADIUS, Math.max(bounds.minZ + PLAYER_RADIUS, pos.z));

      // Gravity + jump (floor at y = 0).
      const grounded = y.current <= EYE_HEIGHT + 1e-3;
      if (grounded && k.Space) vy.current = JUMP_SPEED;
      vy.current -= GRAVITY * dt;
      y.current += vy.current * dt;
      if (y.current < EYE_HEIGHT) {
        y.current = EYE_HEIGHT;
        vy.current = 0;
      }
      // Head-bob while walking.
      const moving = Math.hypot(vel.current.x, vel.current.y);
      const bob = grounded && moving > 0.5 ? Math.sin(performance.now() * 0.011 * (moving / WALK_SPEED)) * 0.035 : 0;
      pos.y = y.current + bob;
    }

    report.current += dt;
    if (report.current > 0.1) {
      report.current = 0;
      _euler.setFromQuaternion(camera.quaternion);
      onMove(pos.x, pos.z, _euler.y);
    }
  });

  return null;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function localRectToWorld(room: PlacedRoom, r: LocalRect): Collider {
  const [ax, az] = roomToWorld(room, r.x0, r.z0);
  const [bx, bz] = roomToWorld(room, r.x1, r.z1);
  return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) };
}

function stringsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function readRawKey(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

interface OpenHologram {
  id: string;
  origin: [number, number, number];
  target: [number, number, number];
  closing: boolean;
}

interface Banner {
  id: number;
  text: string;
  tone: 'build' | 'info' | 'success';
}

// ─────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────

function PalaceSceneInner() {
  // ── Data ──
  const [notesRaw, setNotesRaw] = useState<string>(() => readNotesRaw());
  const [gateRaw, setGateRaw] = useState<string>(() => readRawKey(GATE_REVISIONS_KEY));
  const [revisionLog, setRevisionLog] = useState<PalaceRevisionLog>(() => loadRevisionLog());
  const [progress, setProgress] = useState<PalaceProgress>(() => loadPalaceProgress());
  const [now, setNow] = useState(() => Date.now());

  const notes = useMemo(() => parsePalaceNotes(notesRaw), [notesRaw]);
  // gateRaw is the change signal for GATE Arena's schedule.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gateRevisions: GateRevisionEntry[] = useMemo(() => loadGateRevisions(), [gateRaw]);

  // Live refresh: other windows write localStorage in the same tab, so poll
  // cheaply (string compare) + listen for cross-tab storage events.
  useEffect(() => {
    const refresh = () => {
      const n = readNotesRaw();
      setNotesRaw((prev) => (prev === n ? prev : n));
      const g = readRawKey(GATE_REVISIONS_KEY);
      setGateRaw((prev) => (prev === g ? prev : g));
    };
    const id = window.setInterval(refresh, POLL_MS);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const reviews = useMemo(() => {
    const m = new Map<string, NoteReview>();
    for (const n of notes) m.set(n.id, computeNoteReview(n, revisionLog, gateRevisions, now));
    return m;
  }, [notes, revisionLog, gateRevisions, now]);

  // ── Growth + layout ──
  const growth = useMemo(() => computePalaceGrowth(notes.length), [notes.length]);
  const allocation = useMemo(() => allocateRooms(notes, growth.roomSlots), [notes, growth.roomSlots]);
  const layout = useMemo(() => buildPalaceLayout(allocation, growth), [allocation, growth]);

  // ── Session state ──
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [playerPos, setPlayerPos] = useState<[number, number]>(layout.spawn);
  const [heading, setHeading] = useState(0);
  const [currentRoomKey, setCurrentRoomKey] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [holograms, setHolograms] = useState<OpenHologram[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const sessionSubjects = useRef<Set<string>>(new Set());
  const controlsRef = useRef<PointerLockControlsImpl | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const hoverRef = useRef(false);
  const flightId = useRef(0);
  const bannerId = useRef(0);

  const showBanner = useCallback((text: string, tone: Banner['tone'] = 'info') => {
    bannerId.current += 1;
    setBanner({ id: bannerId.current, text, tone });
  }, []);
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner((b) => (b?.id === banner.id ? null : b)), 3800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const updateProgress = useCallback((fn: (p: PalaceProgress) => PalaceProgress) => {
    setProgress((prev) => {
      const next = fn(prev);
      if (next !== prev) savePalaceProgress(next);
      return next;
    });
  }, []);

  // Achievements already earned (e.g. data from an earlier session).
  useEffect(() => {
    reconcilePalaceAchievements(progress, notes.length);
  }, [progress, notes.length]);

  // ── Build queue (brick-by-brick growth animation) ──
  const unbuilt = useMemo(
    () => layout.units.map((u) => u.key).filter((k) => !progress.builtRooms.includes(k)),
    [layout.units, progress.builtRooms]
  );
  const building = useMemo(() => (started ? unbuilt.slice(0, MAX_CONCURRENT_BUILDS) : []), [started, unbuilt]);
  const hidden = useMemo(() => new Set(unbuilt), [unbuilt]);
  const buildingSet = useMemo(() => new Set(building), [building]);

  const buildingLabel = useMemo(() => {
    const labels = building.map((k) => layout.units.find((u) => u.key === k)?.label).filter(Boolean) as string[];
    if (labels.length === 0) return null;
    return labels.length === 1 ? labels[0] : `${labels[0]} +${labels.length - 1} more`;
  }, [building, layout.units]);

  const handleBuilt = useCallback(
    (key: string) => {
      updateProgress((p) => (p.builtRooms.includes(key) ? p : { ...p, builtRooms: [...p.builtRooms, key] }));
    },
    [updateProgress]
  );

  // Forget built units that no longer exist (notes deleted) so they animate
  // again if they come back; keeps the list bounded.
  useEffect(() => {
    const valid = new Set(layout.units.map((u) => u.key));
    updateProgress((p) => {
      const kept = p.builtRooms.filter((k) => valid.has(k));
      return stringsEqual(kept, p.builtRooms) ? p : { ...p, builtRooms: kept };
    });
  }, [layout.units, updateProgress]);

  // ── Colliders (built structure + furniture) ──
  const colliders = useMemo(() => {
    const list: Collider[] = [];
    for (const b of layout.boxes) {
      if (!b.solid || hidden.has(b.unit)) continue;
      list.push({ x0: b.x - b.sx / 2, x1: b.x + b.sx / 2, z0: b.z - b.sz / 2, z1: b.z + b.sz / 2 });
    }
    for (const room of layout.rooms) {
      if (hidden.has(room.key)) continue;
      for (const r of SHELF_FOOTPRINTS) list.push(localRectToWorld(room, r));
      for (const r of DECOR_FOOTPRINTS[room.theme.style] ?? []) list.push(localRectToWorld(room, r));
    }
    return list;
  }, [layout, hidden]);

  // ── Rooms summary (minimap + overview) ──
  const roomLayouts: RoomLayout[] = useMemo(
    () =>
      layout.rooms.map((r) => ({
        key: r.key,
        label: r.label,
        subject: r.subject,
        accent: r.theme.accent,
        center: r.center,
        noteCount: r.notes.length,
        dueCount: r.notes.filter((n) => reviews.get(n.id)?.isDue).length,
      })),
    [layout.rooms, reviews]
  );

  const summary: PalaceSummary = useMemo(() => {
    const recency: Record<RecencyBucket, number> = { today: 0, week: 0, month: 0, stale: 0 };
    let due = 0;
    let overdue = 0;
    let gateLinked = 0;
    for (const r of reviews.values()) {
      recency[r.recency] += 1;
      if (r.isDue) due += 1;
      if (r.overdueDays > 0) overdue += 1;
      if (r.source === 'gate') gateLinked += 1;
    }
    return { objects: notes.length, rooms: layout.rooms.length, due, overdue, recency, gateLinked, unhoused: layout.unhoused.length };
  }, [reviews, notes.length, layout.rooms.length, layout.unhoused.length]);

  // ── Pointer lock ──
  const requestLock = useCallback(() => {
    const el = controlsRef.current?.domElement;
    if (!el) return;
    try {
      const result = el.requestPointerLock() as unknown;
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
          /* user gesture missing / denied — stay unlocked */
        });
      }
    } catch {
      /* Pointer Lock API unavailable */
    }
  }, []);

  const releaseLock = useCallback(() => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const enter = useCallback(() => {
    setStarted(true);
    setOverviewOpen(false);
    requestLock();
    updateProgress((p) => (p.entered ? p : { ...p, entered: true }));
  }, [requestLock, updateProgress]);

  // ── Position tracking: rooms visited, breadcrumbs, achievements ──
  const handleMove = useCallback(
    (x: number, z: number, yaw: number) => {
      setPlayerPos((prev) => (Math.abs(prev[0] - x) < 0.05 && Math.abs(prev[1] - z) < 0.05 ? prev : [x, z]));
      setHeading((prev) => (Math.abs(prev - yaw) < 0.02 ? prev : yaw));
      const { roomKey } = locate(layout, x, z);
      setCurrentRoomKey((prev) => (prev === roomKey ? prev : roomKey));
    },
    [layout]
  );

  useEffect(() => {
    if (!currentRoomKey) return;
    const room = layout.rooms.find((r) => r.key === currentRoomKey);
    if (!room || hidden.has(room.key)) return;
    setBreadcrumbs((prev) =>
      prev[prev.length - 1]?.key === room.key
        ? prev
        : [...prev.filter((b) => b.key !== room.key).slice(-7), { key: room.key, label: room.label, accent: room.theme.accent }]
    );
    if (room.subject !== 'General') {
      sessionSubjects.current.add(room.subject);
      if (sessionSubjects.current.size >= CARTOGRAPHER_ROOMS) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.cartographer);
      updateProgress((p) =>
        p.visitedSubjects.includes(room.subject) ? p : { ...p, visitedSubjects: [...p.visitedSubjects, room.subject] }
      );
    }
  }, [currentRoomKey, layout.rooms, hidden, updateProgress]);

  // ── Teleport (fly through the corridors) ──
  const flyTo = useCallback(
    (points: [number, number][], lookAt: [number, number] | null) => {
      flightId.current += 1;
      setFlight({ id: flightId.current, points, lookAt });
    },
    []
  );

  const startPath = useCallback((): [number, number][] => {
    const [x, z] = playerPos;
    const pts: [number, number][] = [[x, z]];
    const here = locate(layout, x, z);
    const room = here.roomKey ? layout.rooms.find((r) => r.key === here.roomKey) : null;
    if (room) {
      pts.push(room.doorIn, room.doorOut);
    } else {
      pts.push([0, z]);
    }
    return pts;
  }, [playerPos, layout]);

  const teleportToRoom = useCallback(
    (key: string) => {
      const room = layout.rooms.find((r) => r.key === key);
      if (!room || hidden.has(key)) return;
      setOverviewOpen(false);
      if (!started) setStarted(true);
      const pts = startPath();
      if (currentRoomKey === key) {
        pts.splice(1);
        pts.push(room.viewPoint);
      } else {
        pts.push(room.doorOut, room.doorIn, room.viewPoint);
      }
      flyTo(pts, room.center);
    },
    [layout.rooms, hidden, started, startPath, currentRoomKey, flyTo]
  );

  const teleportHome = useCallback(() => {
    const pts = startPath();
    pts.push([0, layout.spawn[1] - 3], layout.spawn);
    flyTo(pts, [0, -20]);
  }, [startPath, layout.spawn, flyTo]);

  const handleFlightDone = useCallback((id: number) => {
    setFlight((f) => (f?.id === id ? null : f));
  }, []);

  // ── Holograms ──
  const openHologram = useCallback(
    (note: PalaceNote, origin: [number, number, number]) => {
      const review = reviews.get(note.id);
      if (review?.recency === 'stale') unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.ghostOfKnowledge);
      setHolograms((prev) => {
        if (prev.some((h) => h.id === note.id && !h.closing)) return prev;
        const cam = cameraRef.current;
        let target: [number, number, number] = [origin[0], 1.75, origin[2]];
        if (cam) {
          const dir = new THREE.Vector3();
          cam.getWorldDirection(dir);
          dir.y = 0;
          if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
          dir.normalize();
          const side = new THREE.Vector3(-dir.z, 0, dir.x);
          const open = prev.filter((h) => !h.closing).length;
          const offset = ((open % 3) - (open % 3 === 2 ? 3 : 0)) * 1.1; // 0, +1.1, -1.1
          // Float between you and the shelf (never behind the wall).
          const toObject = Math.hypot(origin[0] - cam.position.x, origin[2] - cam.position.z);
          const dist = Math.min(2.3, Math.max(1.2, toObject * 0.6));
          target = [
            cam.position.x + dir.x * dist + side.x * offset * (dist / 2.3),
            1.75 + Math.floor(open / 3) * 0.25,
            cam.position.z + dir.z * dist + side.z * offset * (dist / 2.3),
          ];
        }
        return [...prev.filter((h) => h.id !== note.id), { id: note.id, origin, target, closing: false }];
      });
      // Free the cursor so the panel's buttons can be used.
      releaseLock();
    },
    [reviews, releaseLock]
  );

  const requestCloseHologram = useCallback((id: string) => {
    setHolograms((prev) => prev.map((h) => (h.id === id ? { ...h, closing: true } : h)));
  }, []);

  const removeHologram = useCallback((id: string) => {
    setHolograms((prev) => prev.filter((h) => !(h.id === id && h.closing)));
  }, []);

  const reviseNote = useCallback(
    (note: PalaceNote) => {
      const { log, counted } = markNoteRevised(note, revisionLog, gateRevisions, Date.now());
      setRevisionLog(log);
      setNow(Date.now());
      if (counted) {
        updateProgress((p) => ({ ...p, revisions: p.revisions + 1 }));
        try {
          recordStudyAction();
        } catch {
          /* streak bookkeeping is best-effort */
        }
      }
      const next = log[note.id];
      showBanner(`“${note.title}” revised · next review in ${next?.interval ?? 1}d`, 'success');
    },
    [revisionLog, gateRevisions, updateProgress, showBanner]
  );

  const openInNotes = useCallback(
    (note: PalaceNote) => {
      releaseLock();
      try {
        useAppStore.getState().launchApp('notes', useWorkspaceStore.getState().activeWorkspaceId);
        const detail: NotesSearchDetail = { query: note.title };
        sendPendingEvent(NOTES_SEARCH_EVENT, detail);
      } catch {
        showBanner('Could not open Notes Archive', 'info');
      }
    },
    [releaseLock, showBanner]
  );

  // ── Keyboard: O overview · X close last hologram ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!locked && !hoverRef.current) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.code === 'KeyO' && started) {
        if (!overviewOpen) releaseLock();
        setOverviewOpen(!overviewOpen);
      } else if (e.code === 'KeyX') {
        setHolograms((prev) => {
          const open = prev.filter((h) => !h.closing);
          const last = open[open.length - 1];
          return last ? prev.map((h) => (h.id === last.id ? { ...h, closing: true } : h)) : prev;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, started, overviewOpen, releaseLock]);

  // A new structure started building → announce it.
  const lastAnnounced = useRef<string | null>(null);
  useEffect(() => {
    if (buildingLabel && buildingLabel !== lastAnnounced.current) {
      lastAnnounced.current = buildingLabel;
      showBanner(`Palace growing · building ${buildingLabel}`, 'build');
    }
    if (!buildingLabel) lastAnnounced.current = null;
  }, [buildingLabel, showBanner]);

  // Furnish only rooms near the player (the palace is one long corridor).
  const cullZ = Math.round(playerPos[1] / 6) * 6;
  const currentRoom = currentRoomKey ? layout.rooms.find((r) => r.key === currentRoomKey) ?? null : null;
  const openIds = useMemo(() => new Set(holograms.map((h) => h.id)), [holograms]);
  const archiveSlots = useMemo(() => {
    const [tx, tz] = layout.archiveTable;
    return layout.unhoused.slice(0, 18).map((n, i) => ({
      note: n,
      pos: [tx - 1.05 + (i % 6) * 0.42, 1.2, tz - 0.45 + Math.floor(i / 6) * 0.45] as [number, number, number],
    }));
  }, [layout]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#04040a]"
      onPointerEnter={() => {
        hoverRef.current = true;
      }}
      onPointerLeave={() => {
        hoverRef.current = false;
      }}
    >
      <Canvas
        camera={{ fov: 72, near: 0.05, far: 160, position: [layout.spawn[0], EYE_HEIGHT, layout.spawn[1]] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        onCreated={({ camera }) => {
          cameraRef.current = camera;
        }}
        onPointerMissed={() => {
          if (started && !locked && !overviewOpen) requestLock();
        }}
      >
        <color attach="background" args={['#04040a']} />
        <fog attach="fog" args={['#04040a', 14, 70]} />
        <hemisphereLight args={['#b8c4ff', '#1a1208', 0.55]} />
        <ambientLight intensity={0.22} />
        <pointLight position={[0, 4, 0]} color="#00f0ff" intensity={10} distance={14} decay={1.5} />

        <PalaceStructure layout={layout} hidden={hidden} />
        <PalaceSigns signs={layout.signs} hidden={hidden} />
        <GrowthBuilder layout={layout} building={building} onBuilt={handleBuilt} />
        <RoomLightPool rooms={layout.rooms} hidden={hidden} />
        {!hidden.has('hall') && <GrandHall layout={layout} />}

        {layout.rooms.map((room) =>
          hidden.has(room.key) || Math.abs(room.center[1] - cullZ) > ROOM_CULL_DISTANCE ? null : (
            <PalaceRoom key={room.key} room={room}>
              {room.notes.slice(0, ROOM_CAPACITY).map((note, i) => {
                const review = reviews.get(note.id);
                if (!review) return null;
                return (
                  <KnowledgeObject
                    key={note.id}
                    note={note}
                    review={review}
                    position={ROOM_SLOTS[i]}
                    lifted={openIds.has(note.id)}
                    onOpen={openHologram}
                  />
                );
              })}
            </PalaceRoom>
          )
        )}

        {/* Notes waiting for a room, on the entrance-hall archive table */}
        {archiveSlots.map(({ note, pos }) => {
          const review = reviews.get(note.id);
          if (!review) return null;
          return <KnowledgeObject key={note.id} note={note} review={review} position={pos} lifted={openIds.has(note.id)} onOpen={openHologram} />;
        })}

        {holograms.map((h) => {
          const note = noteById.get(h.id);
          const review = reviews.get(h.id);
          if (!note || !review) return null;
          return (
            <NoteHologram
              key={h.id}
              note={note}
              review={review}
              origin={h.origin}
              target={h.target}
              now={now}
              closing={h.closing}
              onRequestClose={requestCloseHologram}
              onClosed={removeHologram}
              onRevise={reviseNote}
              onOpenInNotes={openInNotes}
            />
          );
        })}

        <PointerLockBridge controlsRef={controlsRef} onLockChange={setLocked} />
        <Player
          locked={locked}
          colliders={colliders}
          bounds={layout.bounds}
          spawn={layout.spawn}
          flight={flight}
          onFlightDone={handleFlightDone}
          onMove={handleMove}
        />
      </Canvas>

      {/* ── HUD: overview chip (top-left) ── */}
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex flex-col gap-1.5">
        <button
          onClick={() => {
            releaseLock();
            setOverviewOpen(true);
          }}
          className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-left backdrop-blur-md transition-colors hover:border-white/20"
        >
          <div className="font-display text-[11px] font-bold tracking-widest text-accent-primary">🏛️ MEMORY PALACE</div>
          <div className="mt-1 flex gap-3 text-[10px] text-white/60">
            <span>{summary.objects} objects</span>
            <span>{summary.rooms} rooms</span>
            <span className={cn(summary.due > 0 ? 'text-accent-danger' : 'text-accent-success')}>{summary.due} due</span>
          </div>
        </button>
        {currentRoom && (
          <div className="rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-md">
            <div className="text-[11px] font-semibold" style={{ color: currentRoom.theme.accent }}>
              {currentRoom.label}
            </div>
            <div className="text-[9.5px] text-white/45">{currentRoom.theme.vibe}</div>
          </div>
        )}
      </div>

      <PalaceNavigation
        layout={layout}
        rooms={roomLayouts}
        building={buildingSet}
        playerPos={playerPos}
        heading={heading}
        currentRoomKey={currentRoomKey}
        breadcrumbs={breadcrumbs}
        flying={flight !== null}
        onTeleport={teleportToRoom}
        onTeleportHome={teleportHome}
      />

      {/* Crosshair */}
      {locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/60" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/60" />
        </div>
      )}

      {/* Walk / inspect hint */}
      {started && !locked && !overviewOpen && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-md">
          <MousePointer2 className="h-3.5 w-3.5 text-accent-primary" />
          <span>Inspect mode — click objects or holograms</span>
          <button onClick={requestLock} className="flex items-center gap-1 rounded-full bg-accent-primary/20 px-2 py-0.5 font-semibold text-accent-primary hover:bg-accent-primary/30">
            <Eye className="h-3 w-3" /> Walk
          </button>
        </div>
      )}
      {locked && flight === null && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-[10px] text-white/35">
          WASD move · Shift sprint · Space jump · click an object · O overview · Esc cursor
        </div>
      )}
      {flight !== null && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] text-accent-primary">
          <Compass className="h-3.5 w-3.5 animate-spin" /> Travelling…
        </div>
      )}

      {/* Growth / action banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] backdrop-blur-md',
              banner.tone === 'build' && 'border-amber-300/30 bg-amber-500/10 text-amber-200',
              banner.tone === 'success' && 'border-accent-success/30 bg-accent-success/10 text-accent-success',
              banner.tone === 'info' && 'border-white/15 bg-black/60 text-white/70'
            )}
          >
            {banner.tone === 'build' && <Hammer className="h-3.5 w-3.5" />}
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(!started || overviewOpen) && (
          <PalaceOverview
            key={started ? 'panel' : 'intro'}
            summary={summary}
            growth={growth}
            rooms={roomLayouts}
            mode={started ? 'panel' : 'intro'}
            hasNotes={notes.length > 0}
            onEnter={enter}
            onClose={() => setOverviewOpen(false)}
            onTeleport={teleportToRoom}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export const PalaceScene = memo(PalaceSceneInner);
export default PalaceScene;
