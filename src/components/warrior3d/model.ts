// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: GLB model loading
// public/models/warrior.glb is optional. The file is probed once
// (via /api/warrior-model, HEAD as fallback; cached for the session), loaded with GLTFLoader (+ Meshopt,
// + Draco only when /draco/ decoder files are served locally), then
// normalised: ~1.8 units tall, feet on y=0, centred, shadows on, and
// materials upgraded to polished physical metal. Missing / broken →
// status 'placeholder' and the procedural warrior takes over.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { create } from 'zustand';
import type { WarriorAction } from './types';

export const WARRIOR_MODEL_URL = '/models/warrior.glb';
const DRACO_PATH = '/draco/';
const PROBE_URL = '/api/warrior-model';
export const WARRIOR_HEIGHT = 1.8;

export type WarriorModelStatus = 'idle' | 'checking' | 'loading' | 'glb' | 'placeholder' | 'error';

export interface WarriorModelAsset {
  /** Normalised source scene — clone it per instance (SkeletonUtils.clone). */
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  /** Clips resolved per action (missing entries fall back at play time). */
  clips: Partial<Record<WarriorAction, THREE.AnimationClip>>;
  /** Name of the chest bone (Spine2 / Chest / UpperChest) when found. */
  chestBone: string | null;
  /** Arc-reactor anchor in the chest bone's local space (when chestBone). */
  chestLocal: THREE.Vector3 | null;
  /** Arc-reactor anchor in model space (bind pose) — fallback. */
  chestPoint: THREE.Vector3;
}

interface WarriorModelState {
  status: WarriorModelStatus;
  asset: WarriorModelAsset | null;
  error: string | null;
  /** Human-readable summary: clip names found, mapped actions. */
  detail: string | null;
}

export const useWarriorModelStore = create<WarriorModelState>()(() => ({
  status: 'idle',
  asset: null,
  error: null,
  detail: null,
}));

// ─── Clip mapping ───

const CLIP_KEYWORDS: Record<WarriorAction, RegExp> = {
  stance: /fight|stance|boxing|guard|combat|ready/i,
  idle: /idle|breath|stand/i,
  punch: /punch|jab|attack|hook|strike|cross|uppercut|kick/i,
  powerup: /power|charge|flex|roar|taunt|buff/i,
  victory: /victory|cheer|celebrat|win|triumph|dance/i,
  hurt: /hit|hurt|react|damage|impact|stagger/i,
};

/** Match clips to actions by name keywords. Exported for tests / readouts. */
export function mapClips(clips: THREE.AnimationClip[]): Partial<Record<WarriorAction, THREE.AnimationClip>> {
  const used = new Set<THREE.AnimationClip>();
  const out: Partial<Record<WarriorAction, THREE.AnimationClip>> = {};
  // Most specific first so "Boxing Idle" lands on stance, "Hit Reaction" on hurt.
  const order: WarriorAction[] = ['stance', 'punch', 'hurt', 'victory', 'powerup', 'idle'];
  for (const action of order) {
    const re = CLIP_KEYWORDS[action];
    const hit = clips.find((c) => !used.has(c) && re.test(c.name)) ?? clips.find((c) => re.test(c.name));
    if (hit) {
      out[action] = hit;
      used.add(hit);
    }
  }
  // A lone unnamed clip ("mixamo.com", "Take 001") is most likely the idle.
  if (!out.idle && !out.stance && clips.length > 0) {
    const spare = clips.find((c) => !used.has(c));
    if (spare) out.idle = spare;
  }
  return out;
}

// ─── Material upgrade ───

function isPlainWhite(c: THREE.Color): boolean {
  return c.r > 0.75 && c.g > 0.75 && c.b > 0.75;
}

function upgradeMaterial(src: THREE.Material): THREE.Material {
  if (!(src instanceof THREE.MeshStandardMaterial)) return src;
  const m = new THREE.MeshPhysicalMaterial();
  m.name = src.name;
  m.color.copy(src.color);
  m.map = src.map;
  m.normalMap = src.normalMap;
  m.normalScale.copy(src.normalScale);
  m.aoMap = src.aoMap;
  m.aoMapIntensity = src.aoMapIntensity;
  m.roughnessMap = src.roughnessMap;
  m.metalnessMap = src.metalnessMap;
  m.emissive.copy(src.emissive);
  m.emissiveMap = src.emissiveMap;
  m.emissiveIntensity = Math.max(1, src.emissiveIntensity);
  m.alphaMap = src.alphaMap;
  m.transparent = src.transparent;
  m.opacity = src.opacity;
  m.alphaTest = src.alphaTest;
  m.side = src.side;
  m.vertexColors = src.vertexColors;
  // Untextured scans come in flat white / grey — make them gunmetal.
  if (!src.map && isPlainWhite(src.color)) m.color.set('#23272e');
  // Polished armor: strongly metallic, glossy, lacquered.
  m.metalness = src.metalnessMap ? Math.max(0.75, src.metalness) : Math.max(0.82, src.metalness);
  m.roughness = src.roughnessMap ? Math.min(0.6, src.roughness) : Math.min(0.34, Math.max(0.16, src.roughness * 0.6));
  m.clearcoat = 0.85;
  m.clearcoatRoughness = 0.12;
  m.envMapIntensity = 1.25;
  m.specularIntensity = 1;
  return m;
}

// ─── Chest anchor ───

const CHEST_BONE_RE = [/spine2$/i, /upperchest$/i, /chest$/i, /spine_?03$/i, /spine1$/i];

function findChestBone(root: THREE.Object3D): THREE.Bone | null {
  const bones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  for (const re of CHEST_BONE_RE) {
    const b = bones.find((bone) => re.test(bone.name.replace(/^mixamorig[:_]?/i, '')));
    if (b) return b;
  }
  return null;
}

function computeChest(root: THREE.Object3D, box: THREE.Box3): Pick<WarriorModelAsset, 'chestBone' | 'chestLocal' | 'chestPoint'> {
  root.updateMatrixWorld(true);
  const bone = findChestBone(root);
  const height = box.max.y - box.min.y;
  const probe = new THREE.Vector3(0, box.min.y + height * 0.72, 0);
  if (bone) {
    bone.getWorldPosition(probe);
    probe.y += height * 0.03; // reactor sits a touch above the bone pivot
  }
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const ray = new THREE.Raycaster(new THREE.Vector3(probe.x, probe.y, box.max.z + 1), new THREE.Vector3(0, 0, -1));
  let surfaceZ = box.min.z + (box.max.z - box.min.z) * 0.8;
  try {
    const hits = ray.intersectObjects(meshes, false);
    if (hits.length > 0) surfaceZ = hits[0].point.z;
  } catch {
    /* keep estimate */
  }
  const point = new THREE.Vector3(probe.x, probe.y, surfaceZ + 0.012);
  let chestLocal: THREE.Vector3 | null = null;
  if (bone) {
    chestLocal = bone.worldToLocal(point.clone());
  }
  return { chestBone: bone?.name ?? null, chestLocal, chestPoint: point };
}

// ─── Loading ───

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    return !type.includes('text/html'); // SPA fallbacks serve HTML for anything
  } catch {
    return false;
  }
}

/**
 * Is the GLB there (and are Draco decoders served)? Asks /api/warrior-model first (a filesystem check, so
 * a missing model never shows up as a 404 in the console); when the
 * server can't tell, falls back to a HEAD request. Cached per session.
 */
async function probeModel(): Promise<{ model: boolean; draco: boolean | null }> {
  try {
    const res = await fetch(PROBE_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { exists?: unknown; draco?: unknown };
      if (data.exists === true || data.exists === false) {
        return { model: data.exists, draco: typeof data.draco === 'boolean' ? data.draco : null };
      }
    }
  } catch {
    /* fall through to HEAD */
  }
  return { model: await headOk(WARRIOR_MODEL_URL), draco: null };
}

/** Strip horizontal root drift so clips play in place on the platform. */
function stripRootMotion(clips: THREE.AnimationClip[]): void {
  for (const clip of clips) {
    for (const track of clip.tracks) {
      if (!/hips\.position$/i.test(track.name) || track.getValueSize() !== 3) continue;
      const v = track.values;
      const x0 = v[0];
      const z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0;
        v[i + 2] = z0;
      }
    }
  }
}

async function loadAsset(dracoServed: boolean | null): Promise<WarriorModelAsset> {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (dracoServed ?? (await headOk(`${DRACO_PATH}draco_decoder.wasm`))) {
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    loader.setDRACOLoader(draco);
  }
  const gltf = await loader.loadAsync(WARRIOR_MODEL_URL);
  const inner = gltf.scene;

  inner.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // skinned bounds lag behind animation
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(upgradeMaterial) : upgradeMaterial(mesh.material);
  });

  // Normalise: ~1.8 tall, feet on y=0, centred on x/z.
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner, true);
  const size = box.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.y)) throw new Error('Model has no measurable height');
  const scale = WARRIOR_HEIGHT / size.y;
  inner.scale.multiplyScalar(scale);
  inner.updateMatrixWorld(true);
  box.setFromObject(inner, true);
  const center = box.getCenter(new THREE.Vector3());
  inner.position.x -= center.x;
  inner.position.z -= center.z;
  inner.position.y -= box.min.y;
  inner.updateMatrixWorld(true);
  box.setFromObject(inner, true);

  const scene = new THREE.Group();
  scene.name = 'WarriorGLB';
  scene.add(inner);
  scene.updateMatrixWorld(true);

  stripRootMotion(gltf.animations);
  const clips = mapClips(gltf.animations);
  return { scene, animations: gltf.animations, clips, ...computeChest(scene, box) };
}

let pending: Promise<void> | null = null;

/** Probe + load once per session. Safe to call repeatedly. */
export function ensureWarriorModel(): Promise<void> {
  if (pending) return pending;
  const set = useWarriorModelStore.setState;
  pending = (async () => {
    set({ status: 'checking' });
    const probe = await probeModel();
    if (!probe.model) {
      set({ status: 'placeholder', detail: 'No model at ' + WARRIOR_MODEL_URL });
      return;
    }
    set({ status: 'loading' });
    try {
      const asset = await loadAsset(probe.draco);
      const mapped = Object.entries(asset.clips)
        .map(([action, clip]) => `${action}→${clip?.name}`)
        .join(', ');
      set({
        status: 'glb',
        asset,
        error: null,
        detail: `${asset.animations.length} clip(s)${mapped ? ` · ${mapped}` : ''}${asset.chestBone ? ` · chest: ${asset.chestBone}` : ''}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV !== 'production') console.warn('[warrior3d] GLB failed, using placeholder:', message);
      set({ status: 'error', error: message, detail: 'GLB failed — placeholder in use' });
    }
  })();
  return pending;
}

export interface WarriorModelInfo {
  status: WarriorModelStatus;
  asset: WarriorModelAsset | null;
  error: string | null;
  detail: string | null;
  /** True when the procedural warrior should render (no file / failed). */
  usePlaceholder: boolean;
  /** True while probing / loading. */
  pending: boolean;
}

/** Probe for public/models/warrior.glb and load it (cached). */
export function useWarriorModel(): WarriorModelInfo {
  const status = useWarriorModelStore((s) => s.status);
  const asset = useWarriorModelStore((s) => s.asset);
  const error = useWarriorModelStore((s) => s.error);
  const detail = useWarriorModelStore((s) => s.detail);
  useEffect(() => {
    void ensureWarriorModel();
  }, []);
  return {
    status,
    asset,
    error,
    detail,
    usePlaceholder: status === 'placeholder' || status === 'error',
    pending: status === 'idle' || status === 'checking' || status === 'loading',
  };
}
