// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Memory Palace: Scene (client-only)
// Walkable 3D palace built from your own content (spec 6.23 – 6.29):
//   • first-person PointerLockControls camera, WASD (+ arrows), Shift
//     sprint, Space jump, gravity, collision with walls + furniture
//   • rooms from your note folders / shared tags, your Training Grounds
//     decks and your Project Forge projects, themed by content type
//     (palaceContent + PalaceRoomGenerator + RoomDecor); starter rooms
//     for content types that are still empty
//   • notes, cards and projects as knowledge objects (KnowledgeObject)
//     whose glow follows recency and whose border turns red when spaced
//     repetition says due (useLearningStore reviews for cards and for
//     notes linked to a deck/topic, the palace log for other notes)
//   • holograms (NoteHologram): revise notes, self-grade cards straight
//     into Training Grounds, jump to a project; minimap / teleport
//     fly-through / breadcrumbs (PalaceNavigation), overview
//   • growth from the object count, built brick by brick (PalaceGrowth)
// Notes are re-read live from localStorage ('warrior-notes'); decks,
// reviews and projects come from their stores, so the palace grows the
// moment something is written, studied or started elsewhere.
// Loaded through next/dynamic with ssr:false (see MemoryPalaceApp).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import { PointerLockControls as PointerLockControlsImpl } from 'three-stdlib';
import { CircleCheck, Compass, Footprints, Hammer, Info, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppIcon, Button, Kbd } from '@/components/ui';
import { FOCUS_EDGE } from '@/components/ui/armor';
import { PALACE } from './palaceTheme';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useLearningStore } from '@/stores/useLearningStore';
import { useProjectForgeStore } from '@/stores/useProjectForgeStore';
import { sendPendingEvent } from '@/components/achievements/pending-events';
import { recordStudyAction } from '@/components/achievements/study-streak';
import { NOTES_SEARCH_EVENT, type NotesSearchDetail } from '@/components/apps/notes-archive/deep-link';
import { TRAINING_START_EVENT, type TrainingStartDetail } from '@/components/apps/training-grounds/deep-link';
import { unlockPhase6Achievement } from '@/components/creature/osBridge';
import {
  CARTOGRAPHER_ROOMS,
  PALACE_ACHIEVEMENT_IDS,
  buildDeckSchedules,
  computeCardReview,
  computeNoteReview,
  computeProjectReview,
  loadPalaceProgress,
  loadRevisionLog,
  markNoteRevised,
  parsePalaceNotes,
  readNotesRaw,
  reconcilePalaceAchievements,
  savePalaceProgress,
  type PalaceItem,
  type PalaceProgress,
  type PalaceReview,
  type PalaceRevisionLog,
  type RecencyBucket,
  type RoomDecorData,
} from './palaceData';
import { buildPalaceGroups, buildRoomLevels } from './palaceContent';
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

/** Up to 3 letters for a minimap tile: initials of the words, else the start of the name. */
function shortLabel(label: string): string {
  const words = label.replace(/^#/, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? label).slice(0, 3);
  return initials.slice(0, 3).toUpperCase();
}

const EMPTY_DECOR: RoomDecorData = { words: [], levels: [], dueRatio: 0, newRatio: 0 };

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
  const [revisionLog, setRevisionLog] = useState<PalaceRevisionLog>(() => loadRevisionLog());
  const [progress, setProgress] = useState<PalaceProgress>(() => loadPalaceProgress());
  const [now, setNow] = useState(() => Date.now());
  // Stores: select the raw state and derive with pure helpers below.
  const decks = useLearningStore((s) => s.decks);
  const cardReviews = useLearningStore((s) => s.reviews);
  const projects = useProjectForgeStore((s) => s.projects);

  const notes = useMemo(() => parsePalaceNotes(notesRaw), [notesRaw]);

  // Live refresh: other windows write localStorage in the same tab, so poll
  // cheaply (string compare) + listen for cross-tab storage events.
  useEffect(() => {
    const refresh = () => {
      const n = readNotesRaw();
      setNotesRaw((prev) => (prev === n ? prev : n));
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

  // ── Content → rooms + review state ──
  const groups = useMemo(() => buildPalaceGroups({ notes, decks, projects }), [notes, decks, projects]);
  const items = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const schedules = useMemo(() => buildDeckSchedules(decks, cardReviews), [decks, cardReviews]);
  const roomLevels = useMemo(() => buildRoomLevels(decks, cardReviews, projects), [decks, cardReviews, projects]);

  const reviews = useMemo(() => {
    const m = new Map<string, PalaceReview>();
    for (const item of items) {
      if (item.kind === 'note') {
        const note = noteById.get(item.sourceId);
        if (note) m.set(item.id, computeNoteReview(note, revisionLog, schedules, now));
      } else if (item.kind === 'card') {
        m.set(item.id, computeCardReview(item, cardReviews[item.sourceId], now));
      } else {
        m.set(item.id, computeProjectReview(item.updatedAt, now));
      }
    }
    return m;
  }, [items, noteById, revisionLog, schedules, cardReviews, now]);

  // ── Growth + layout ──
  const growth = useMemo(() => computePalaceGrowth(items.length), [items.length]);
  const allocation = useMemo(() => allocateRooms(groups, growth.roomSlots), [groups, growth.roomSlots]);
  const layout = useMemo(() => buildPalaceLayout(allocation, growth), [allocation, growth]);
  /** Groups that have a room right now (starter rooms don't count toward visits). */
  const roomGroups = useMemo(
    () => [...new Set(layout.rooms.filter((r) => !r.starter).map((r) => r.group))],
    [layout.rooms]
  );

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
  const sessionRooms = useRef<Set<string>>(new Set());
  const currentRoomRef = useRef<string | null>(null);
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
    reconcilePalaceAchievements(progress, items.length, roomGroups);
  }, [progress, items.length, roomGroups]);

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

  // Entering a built room: breadcrumb trail, visits (Cartographer, Palace of Wisdom).
  const recordRoomVisit = useCallback(
    (room: PlacedRoom) => {
      setBreadcrumbs((prev) =>
        prev[prev.length - 1]?.key === room.key
          ? prev
          : [...prev.filter((b) => b.key !== room.key).slice(-7), { key: room.key, label: room.label, accent: room.theme.accent }]
      );
      if (room.starter) return;
      sessionRooms.current.add(room.group);
      if (sessionRooms.current.size >= CARTOGRAPHER_ROOMS) unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.cartographer);
      updateProgress((p) =>
        p.visitedRooms.includes(room.group) ? p : { ...p, visitedRooms: [...p.visitedRooms, room.group] }
      );
    },
    [updateProgress]
  );

  const validUnits = useMemo(() => new Set(layout.units.map((u) => u.key)), [layout.units]);
  const handleBuilt = useCallback(
    (key: string) => {
      // Units that no longer exist (content deleted) are forgotten here, so the
      // list stays bounded and a unit that comes back animates again.
      updateProgress((p) =>
        p.builtRooms.includes(key) ? p : { ...p, builtRooms: [...p.builtRooms.filter((k) => validUnits.has(k)), key] }
      );
      // Standing inside a room while it was built → it counts as entered now.
      if (currentRoomRef.current === key) {
        const room = layout.rooms.find((r) => r.key === key);
        if (room) recordRoomVisit(room);
      }
    },
    [updateProgress, validUnits, layout.rooms, recordRoomVisit]
  );

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
        group: r.group,
        short: shortLabel(r.label),
        accent: r.theme.accent,
        center: r.center,
        objectCount: r.items.length,
        dueCount: r.items.filter((i) => reviews.get(i.id)?.isDue).length,
      })),
    [layout.rooms, reviews]
  );

  const summary: PalaceSummary = useMemo(() => {
    const recency: Record<RecencyBucket, number> = { today: 0, week: 0, month: 0, stale: 0 };
    const kinds = { note: 0, card: 0, project: 0 };
    let due = 0;
    let overdue = 0;
    let fresh = 0;
    let synced = 0;
    for (const item of items) {
      kinds[item.kind] += 1;
      const r = reviews.get(item.id);
      if (!r) continue;
      recency[r.recency] += 1;
      if (r.isDue) due += 1;
      if (r.overdueDays > 0) overdue += 1;
      if (r.isNew) fresh += 1;
      if (r.source === 'deck' || r.source === 'card') synced += 1;
    }
    return {
      objects: items.length,
      notes: kinds.note,
      cards: kinds.card,
      projects: kinds.project,
      rooms: layout.rooms.length,
      due,
      overdue,
      fresh,
      recency,
      synced,
      unhoused: layout.unhoused.length,
    };
  }, [items, reviews, layout.rooms.length, layout.unhoused.length]);

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
      if (roomKey === currentRoomRef.current) return;
      currentRoomRef.current = roomKey;
      setCurrentRoomKey(roomKey);
      const room = roomKey ? layout.rooms.find((r) => r.key === roomKey) : undefined;
      if (room && !hidden.has(room.key)) recordRoomVisit(room);
    },
    [layout, hidden, recordRoomVisit]
  );

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
    (item: PalaceItem, origin: [number, number, number]) => {
      const review = reviews.get(item.id);
      if (review?.recency === 'stale') unlockPhase6Achievement(PALACE_ACHIEVEMENT_IDS.ghostOfKnowledge);
      setHolograms((prev) => {
        if (prev.some((h) => h.id === item.id && !h.closing)) return prev;
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
        return [...prev.filter((h) => h.id !== item.id), { id: item.id, origin, target, closing: false }];
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

  /** One revision / review per object per day counts toward "Curator" and the study streak. */
  const countRevision = useCallback(() => {
    updateProgress((p) => ({ ...p, revisions: p.revisions + 1 }));
    try {
      recordStudyAction();
    } catch {
      /* streak bookkeeping is best-effort */
    }
  }, [updateProgress]);

  const reviseNote = useCallback(
    (item: PalaceItem) => {
      const note = noteById.get(item.sourceId);
      if (!note) return;
      const { log, counted } = markNoteRevised(note, revisionLog, schedules, Date.now());
      setRevisionLog(log);
      setNow(Date.now());
      if (counted) countRevision();
      const next = log[note.id];
      showBanner(`“${note.title}” revised · next review in ${next?.interval ?? 1}d`, 'success');
    },
    [noteById, revisionLog, schedules, countRevision, showBanner]
  );

  // Self-graded recall of a deck card, recorded in Training Grounds' spaced repetition.
  const gradeCard = useCallback(
    (item: PalaceItem, recalled: boolean) => {
      const counted = !reviews.get(item.id)?.revisedToday;
      const next = useLearningStore.getState().recordAttempt({
        cardId: item.sourceId,
        correct: recalled,
        grade: recalled ? 'good' : 'again',
        source: 'review',
      });
      setNow(Date.now());
      if (!next) {
        showBanner('This card no longer exists', 'info');
        return;
      }
      if (counted) countRevision();
      const days = Math.max(0, Math.round((next.dueAt - Date.now()) / 86_400_000));
      showBanner(
        recalled
          ? `Recalled · next review ${days > 0 ? `in ${days}d` : 'later today'}`
          : 'Back in the queue · it returns in a few minutes',
        recalled ? 'success' : 'info'
      );
    },
    [reviews, countRevision, showBanner]
  );

  const openSource = useCallback(
    (item: PalaceItem) => {
      releaseLock();
      const workspace = useWorkspaceStore.getState().activeWorkspaceId;
      try {
        if (item.kind === 'note') {
          useAppStore.getState().launchApp('notes', workspace);
          const detail: NotesSearchDetail = { query: item.title };
          sendPendingEvent(NOTES_SEARCH_EVENT, detail);
        } else if (item.kind === 'card') {
          useAppStore.getState().launchApp('training-grounds', workspace);
          const detail: TrainingStartDetail = { subject: item.card?.deckName, mode: 'flashcards' };
          sendPendingEvent(TRAINING_START_EVENT, detail);
        } else {
          useAppStore.getState().launchApp('project-tracker', workspace);
        }
      } catch {
        showBanner('Could not open that app', 'info');
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
    return layout.unhoused.slice(0, 18).map((item, i) => ({
      item,
      pos: [tx - 1.05 + (i % 6) * 0.42, 1.2, tz - 0.45 + Math.floor(i / 6) * 0.45] as [number, number, number],
    }));
  }, [layout]);

  // Live decor values per room: its words, topic mastery / stage share, due + new share.
  const decorByRoom = useMemo(() => {
    const m = new Map<string, RoomDecorData>();
    for (const room of layout.rooms) {
      let due = 0;
      let fresh = 0;
      for (const item of room.items) {
        const r = reviews.get(item.id);
        if (r?.isDue) due += 1;
        if (r?.isNew) fresh += 1;
      }
      const total = Math.max(1, room.items.length);
      m.set(room.key, {
        words: room.words,
        levels: roomLevels.get(room.group) ?? [],
        dueRatio: due / total,
        newRatio: fresh / total,
      });
    }
    return m;
  }, [layout.rooms, reviews, roomLevels]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-steel-950"
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
        <color attach="background" args={[PALACE.void]} />
        <fog attach="fog" args={[PALACE.void, PALACE.fogNear, PALACE.fogFar]} />
        <hemisphereLight args={[PALACE.sky, PALACE.ground, 0.55]} />
        <ambientLight intensity={0.22} />
        <pointLight position={[0, 4, 0]} color={PALACE.keyLight} intensity={10} distance={14} decay={1.5} />

        <PalaceStructure layout={layout} hidden={hidden} />
        <PalaceSigns signs={layout.signs} hidden={hidden} />
        <GrowthBuilder layout={layout} building={building} onBuilt={handleBuilt} />
        <RoomLightPool rooms={layout.rooms} hidden={hidden} />
        {!hidden.has('hall') && <GrandHall layout={layout} />}

        {layout.rooms.map((room) =>
          hidden.has(room.key) || Math.abs(room.center[1] - cullZ) > ROOM_CULL_DISTANCE ? null : (
            <PalaceRoom key={room.key} room={room} decor={decorByRoom.get(room.key) ?? EMPTY_DECOR}>
              {room.items.slice(0, ROOM_CAPACITY).map((item, i) => {
                const review = reviews.get(item.id);
                if (!review) return null;
                return (
                  <KnowledgeObject
                    key={item.id}
                    item={item}
                    review={review}
                    position={ROOM_SLOTS[i]}
                    lifted={openIds.has(item.id)}
                    onOpen={openHologram}
                  />
                );
              })}
            </PalaceRoom>
          )
        )}

        {/* Objects waiting for a room, on the entrance-hall archive table */}
        {archiveSlots.map(({ item, pos }) => {
          const review = reviews.get(item.id);
          if (!review) return null;
          return <KnowledgeObject key={item.id} item={item} review={review} position={pos} lifted={openIds.has(item.id)} onOpen={openHologram} />;
        })}

        {holograms.map((h) => {
          const item = itemById.get(h.id);
          const review = reviews.get(h.id);
          if (!item || !review) return null;
          return (
            <NoteHologram
              key={h.id}
              item={item}
              review={review}
              origin={h.origin}
              target={h.target}
              now={now}
              closing={h.closing}
              onRequestClose={requestCloseHologram}
              onClosed={removeHologram}
              onRevise={reviseNote}
              onGrade={gradeCard}
              onOpenSource={openSource}
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
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[45%] flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            releaseLock();
            setOverviewOpen(true);
          }}
          title="Open the palace overview (O)"
          className={cn(
            'armor-popover rivets group flex items-center gap-2.5 py-2 pl-2 pr-4 text-left [--cut:10px] [--cut-tr:0px] [--cut-bl:0px] [--rivet-inset:1px]',
            'transition-[filter] duration-120 ease-out-quint hover:brightness-125',
            FOCUS_EDGE
          )}
        >
          <AppIcon appId="memory-palace" size={28} />
          <span className="min-w-0">
            <span className="block truncate font-display text-ui font-semibold uppercase tracking-[0.08em] text-fg">Memory Palace</span>
            <span className="tabular mt-0.5 flex gap-2.5 font-mono text-2xs text-fg-muted">
              <span>{summary.objects} objects</span>
              <span>{summary.rooms} rooms</span>
              <span className={summary.due > 0 ? 'text-danger' : 'text-success'}>{summary.due} due</span>
            </span>
          </span>
        </button>
        {currentRoom && (
          <div
            className="armor-popover flex min-w-0 items-center gap-2.5 px-3 py-2 animate-fade-in [--cut:6px] [--cut-tl:0px] [--cut-br:0px]"
            style={{ '--room': currentRoom.theme.accent } as React.CSSProperties}
          >
            <span className="h-7 w-0.5 shrink-0 bg-[var(--room)] shadow-[0_0_8px_var(--room)]" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-fg" title={currentRoom.label}>
                {currentRoom.label}
              </span>
              <span className="block truncate text-2xs text-fg-subtle" title={currentRoom.theme.vibe}>
                {currentRoom.theme.vibe}
              </span>
            </span>
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
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-6 -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-[5px] rotate-45 border border-fg/35" />
          <span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ember-400 shadow-[0_0_6px_var(--color-ember-500)]" />
          <span className="absolute left-1/2 top-0 h-1.5 w-px -translate-x-1/2 bg-fg/55" />
          <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-fg/55" />
          <span className="absolute left-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-fg/55" />
          <span className="absolute right-0 top-1/2 h-px w-1.5 -translate-y-1/2 bg-fg/55" />
        </div>
      )}

      {/* Walk / inspect hint */}
      {started && !locked && !overviewOpen && flight === null && (
        <div className="armor-popover pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 py-1.5 pl-3.5 pr-1.5 text-xs text-fg-muted animate-fade-in [--cut:8px]">
          <MousePointer2 size={14} strokeWidth={1.75} className="shrink-0 text-ember-400" aria-hidden />
          <span className="whitespace-nowrap">Inspect mode: click objects or holograms</span>
          <Button size="sm" variant="primary" leadingIcon={Footprints} onClick={requestLock}>
            Walk
          </Button>
        </div>
      )}
      {locked && flight === null && (
        <div className="armor-popover pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap px-4 py-1.5 text-2xs text-fg-subtle [--cut:8px]">
          <span className="flex items-center gap-1">
            <Kbd size="sm">W</Kbd>
            <Kbd size="sm">A</Kbd>
            <Kbd size="sm">S</Kbd>
            <Kbd size="sm">D</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd size="sm">Shift</Kbd> sprint
          </span>
          <span className="flex items-center gap-1">
            <Kbd size="sm">Space</Kbd> jump
          </span>
          <span className="flex items-center gap-1">
            <Kbd size="sm">O</Kbd> overview
          </span>
          <span className="flex items-center gap-1">
            <Kbd size="sm">Esc</Kbd> cursor
          </span>
        </div>
      )}
      {flight !== null && (
        <div
          role="status"
          className="armor-popover ember-edge pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ember-300 [--cut:8px]"
        >
          <Compass size={14} strokeWidth={1.75} className="animate-spin" aria-hidden /> Travelling
        </div>
      )}

      {/* Growth / action banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'armor-popover pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[50%] -translate-x-1/2 items-center gap-2 px-4 py-1.5 text-xs [--cut:8px]',
              banner.tone === 'build' && 'ember-edge text-ember-300',
              banner.tone === 'success' && 'text-success',
              banner.tone === 'info' && 'text-fg-muted'
            )}
          >
            {banner.tone === 'build' && <Hammer size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />}
            {banner.tone === 'success' && <CircleCheck size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />}
            {banner.tone === 'info' && <Info size={14} strokeWidth={1.75} className="shrink-0" aria-hidden />}
            <span className="truncate">{banner.text}</span>
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
            hasContent={items.length > 0}
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
