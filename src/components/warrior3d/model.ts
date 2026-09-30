// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: GLB model loading
// public/models/warrior.glb is optional. Animations may also come as
// separate files sharing the rig — public/models/warrior-<action>.glb
// (idle / stance / punch / powerup / victory / hurt, or any name the
// clip keywords recognise): they load after the main model is on
// stage, only their clips are kept, and a filename-mapped clip wins
// over one guessed from clip names. The file is probed once
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
  /** Chest emblem spot just above the reactor, in the chest bone's local space (when chestBone). */
  emblemLocal: THREE.Vector3 | null;
}

interface WarriorModelState {
  status: WarriorModelStatus;
  asset: WarriorModelAsset | null;
  error: string | null;
  /** Human-readable summary: clip names found, mapped actions. */
  detail: string | null;
  /** Bumps whenever clips from separate animation files join asset.clips. */
  clipsVersion: number;
}

export const useWarriorModelStore = create<WarriorModelState>()(() => ({
  status: 'idle',
  asset: null,
  error: null,
  detail: null,
  clipsVersion: 0,
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

/**
 * Textured armor: the base-colour map is multiplied by this tint so a
 * bright / silver bake reads as glossy gunmetal. One knob — lighten it
 * (towards #ffffff) if a future model comes out too dark.
 */
export const GLB_ARMOR_TINT = '#6b7280';
/** Roughness for textured armor without its own roughness map. */
const GLB_TEXTURED_ROUGHNESS = 0.3;
/** Ember glow for seams found in the base-colour map (kept subtle). */
export const GLB_SEAM_EMBER = '#ff6a1a';

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
  // Textured: darken the bake towards gunmetal (multiplies the map).
  if (src.map) m.color.multiply(new THREE.Color(GLB_ARMOR_TINT));
  // Polished armor: strongly metallic, glossy, lacquered.
  m.metalness = src.metalnessMap ? Math.max(0.75, src.metalness) : Math.max(0.82, src.metalness);
  m.roughness = src.roughnessMap
    ? Math.min(0.6, src.roughness)
    : src.map
      ? GLB_TEXTURED_ROUGHNESS
      : Math.min(0.34, Math.max(0.16, src.roughness * 0.6));
  m.clearcoat = 0.85;
  m.clearcoatRoughness = 0.12;
  m.envMapIntensity = 1.25;
  m.specularIntensity = 1;
  return m;
}

// ─── Ember seams (derived from the base-colour map) ───

const SEAM_MAX_SIZE = 1024;
/** Fraction of texels that must read as orange seams (else: none / painted armor). */
const SEAM_MIN_FRACTION = 0.0004;
const SEAM_MAX_FRACTION = 0.2;

type DrawableImage = CanvasImageSource & { width: number; height: number };

function isDrawable(img: unknown): img is DrawableImage {
  if (!img || typeof img !== 'object') return false;
  return (
    (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) ||
    (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement)
  );
}

/**
 * Orange texels of a base-colour map → a greyscale emissive mask, or null
 * when the map has no seams worth lighting (or can't be read).
 */
function seamMaskFor(map: THREE.Texture): THREE.Texture | null {
  const img: unknown = map.image;
  if (!isDrawable(img) || !img.width || !img.height) return null;
  const k = Math.min(1, SEAM_MAX_SIZE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  let hits = 0;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // Warm orange: red dominant, green between, blue low.
    const seam = r > 120 && r > g * 1.3 && g > b * 1.05 && r - b > 80;
    const v = seam ? Math.min(255, 90 + (r - b)) : 0;
    if (seam) hits++;
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  const fraction = hits / (w * h);
  if (fraction < SEAM_MIN_FRACTION || fraction > SEAM_MAX_FRACTION) return null;
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = map.flipY;
  tex.channel = map.channel;
  tex.wrapS = map.wrapS;
  tex.wrapT = map.wrapT;
  tex.offset.copy(map.offset);
  tex.repeat.copy(map.repeat);
  tex.center.copy(map.center);
  tex.rotation = map.rotation;
  tex.name = 'warrior-seams';
  return tex;
}

/**
 * Textured materials with no emissive of their own get a subtle ember
 * glow along the orange seams baked into their colour map. Tagged
 * userData.warriorSeam so the renderer keeps them ember, not tier-tinted.
 */
function addSeamEmissive(materials: THREE.Material[]): void {
  const cache = new Map<THREE.Texture, THREE.Texture | null>();
  for (const mat of materials) {
    const m = mat as THREE.MeshStandardMaterial;
    if (!m.isMeshStandardMaterial || !m.map || m.emissiveMap || m.emissive.getHex() !== 0) continue;
    let mask = cache.get(m.map);
    if (mask === undefined) {
      try {
        mask = seamMaskFor(m.map);
      } catch {
        mask = null; // compressed / tainted image: skip quietly
      }
      cache.set(m.map, mask);
    }
    if (!mask) continue;
    m.emissiveMap = mask;
    m.emissive.set(GLB_SEAM_EMBER);
    m.emissiveIntensity = 1;
    m.userData.warriorSeam = true;
    m.needsUpdate = true;
  }
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

/** Emblem sits this far (model units, ~1.8 tall) above the reactor centre. */
const EMBLEM_RISE = 0.115;

function surfaceZAt(meshes: THREE.Mesh[], x: number, y: number, box: THREE.Box3): number | null {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, box.max.z + 1), new THREE.Vector3(0, 0, -1));
  try {
    const hits = ray.intersectObjects(meshes, false);
    return hits.length > 0 ? hits[0].point.z : null;
  } catch {
    return null;
  }
}

function computeChest(
  root: THREE.Object3D,
  box: THREE.Box3
): Pick<WarriorModelAsset, 'chestBone' | 'chestLocal' | 'chestPoint' | 'emblemLocal'> {
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
  const surfaceZ = surfaceZAt(meshes, probe.x, probe.y, box) ?? box.min.z + (box.max.z - box.min.z) * 0.8;
  const point = new THREE.Vector3(probe.x, probe.y, surfaceZ + 0.012);
  let chestLocal: THREE.Vector3 | null = null;
  let emblemLocal: THREE.Vector3 | null = null;
  if (bone) {
    chestLocal = bone.worldToLocal(point.clone());
    // Emblem: on the plate just above the reactor (only when the ray finds the surface).
    const ey = probe.y + EMBLEM_RISE;
    const ez = surfaceZAt(meshes, probe.x, ey, box);
    if (ez !== null) emblemLocal = bone.worldToLocal(new THREE.Vector3(probe.x, ey, ez + 0.006));
  }
  return { chestBone: bone?.name ?? null, chestLocal, chestPoint: point, emblemLocal };
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

const MODELS_DIR = '/models/';
/** Separate animation files: warrior-<name>.glb. */
const EXTRA_FILE_RE = /^warrior-([a-z0-9_-]+)\.glb$/i;

interface ModelProbe {
  model: boolean;
  draco: boolean | null;
  /** Separate animation files (file names in /models/). */
  extras: string[];
}

/**
 * Is the GLB there (and are Draco decoders served, which animation files
 * sit next to it)? Asks /api/warrior-model first (a filesystem check, so
 * a missing model never shows up as a 404 in the console); when the
 * server can't tell, falls back to a HEAD request on the main file (no
 * extras then). Cached per session.
 */
async function probeModel(): Promise<ModelProbe> {
  try {
    const res = await fetch(PROBE_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { exists?: unknown; draco?: unknown; extras?: unknown };
      if (data.exists === true || data.exists === false) {
        const extras = Array.isArray(data.extras)
          ? data.extras.filter((f): f is string => typeof f === 'string' && EXTRA_FILE_RE.test(f))
          : [];
        return { model: data.exists, draco: typeof data.draco === 'boolean' ? data.draco : null, extras };
      }
    }
  } catch {
    /* fall through to HEAD */
  }
  return { model: await headOk(WARRIOR_MODEL_URL), draco: null, extras: [] };
}

/** Action for an animation file name (exact action name first, then the clip keywords). */
export function actionForAnimationFile(file: string): WarriorAction | null {
  const m = EXTRA_FILE_RE.exec(file);
  if (!m) return null;
  const stem = m[1].toLowerCase();
  const exact = stem.replace(/[_-]+/g, '');
  const direct = (['idle', 'stance', 'punch', 'powerup', 'victory', 'hurt'] as const).find((a) => a === exact);
  if (direct) return direct;
  const words = stem.replace(/[_-]+/g, ' ');
  const order: WarriorAction[] = ['stance', 'punch', 'hurt', 'victory', 'powerup', 'idle'];
  return order.find((a) => CLIP_KEYWORDS[a].test(words)) ?? null;
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

type Loader = import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

async function createLoader(dracoServed: boolean | null): Promise<Loader> {
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
  return loader;
}

async function loadAsset(loader: Loader): Promise<WarriorModelAsset> {
  const gltf = await loader.loadAsync(WARRIOR_MODEL_URL);
  const inner = gltf.scene;

  const upgraded = new Map<THREE.Material, THREE.Material>();
  const upgrade = (src: THREE.Material) => {
    let out = upgraded.get(src);
    if (!out) {
      out = upgradeMaterial(src);
      upgraded.set(src, out);
    }
    return out;
  };
  inner.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // skinned bounds lag behind animation
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(upgrade) : upgrade(mesh.material);
  });
  addSeamEmissive([...upgraded.values()]);

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

// ─── Separate animation files ───

/** Rig-name key: "mixamorig:LeftArm", "mixamorig1LeftArm", "LeftArm" → "leftarm". */
function boneKey(name: string): string {
  return name
    .replace(/^mixamorig\d*[:_]?/i, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/**
 * Retarget a clip's tracks onto the main model's node names (same rig,
 * possibly a different name prefix). Tracks with no matching node are
 * dropped. Returns null when nothing is left.
 */
function retargetClip(clip: THREE.AnimationClip, nodes: Map<string, string>, exact: Set<string>): THREE.AnimationClip | null {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    let parsed: { nodeName: string };
    try {
      parsed = THREE.PropertyBinding.parseTrackName(track.name) as { nodeName: string };
    } catch {
      continue;
    }
    const node = parsed.nodeName;
    if (exact.has(node)) {
      tracks.push(track);
      continue;
    }
    const target = nodes.get(boneKey(node));
    if (!target) continue;
    const copy = track.clone();
    copy.name = target + track.name.slice(node.length);
    tracks.push(copy);
  }
  if (tracks.length === 0) return null;
  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}

function disposeScene(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      m.dispose();
    }
  });
}

/**
 * Load the separate animation files into `asset` (in place), one by one.
 * Each file's first clip is renamed to its action and wins over clips
 * guessed from the main file; meshes / textures are thrown away.
 */
async function loadAnimationFiles(loader: Loader, asset: WarriorModelAsset, files: string[]): Promise<string[]> {
  const nodes = new Map<string, string>();
  const exact = new Set<string>();
  asset.scene.traverse((o) => {
    if (!o.name) return;
    exact.add(o.name);
    const key = boneKey(o.name);
    if (key && !nodes.has(key)) nodes.set(key, o.name);
  });
  const loaded: string[] = [];
  for (const file of files) {
    const action = actionForAnimationFile(file);
    let gltf: Awaited<ReturnType<Loader['loadAsync']>>;
    try {
      gltf = await loader.loadAsync(MODELS_DIR + file);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn(`[warrior3d] animation file ${file} failed:`, err);
      continue;
    }
    disposeScene(gltf.scene);
    const source = gltf.animations.find((c) => c.tracks.length > 0);
    const clip = source ? retargetClip(source, nodes, exact) : null;
    if (!clip) continue;
    clip.name = action ?? (EXTRA_FILE_RE.exec(file)?.[1] ?? file);
    stripRootMotion([clip]);
    asset.animations.push(clip);
    if (action) asset.clips[action] = clip;
    loaded.push(`${file}→${action ?? 'unmapped'}`);
    useWarriorModelStore.setState((s) => ({ clipsVersion: s.clipsVersion + 1 }));
  }
  return loaded;
}

/** Resolve after the next painted frame + a short breather (lets the model render first). */
function afterFirstRender(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') return resolve();
    requestAnimationFrame(() => setTimeout(resolve, 250));
  });
}

function describeAsset(asset: WarriorModelAsset, extras: string[]): string {
  const mapped = Object.entries(asset.clips)
    .map(([action, clip]) => `${action}→${clip?.name}`)
    .join(', ');
  return (
    `${asset.animations.length} clip(s)${mapped ? ` · ${mapped}` : ''}` +
    (extras.length ? ` · files: ${extras.join(', ')}` : '') +
    (asset.chestBone ? ` · chest: ${asset.chestBone}` : '')
  );
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
    let loader: Loader;
    let asset: WarriorModelAsset;
    try {
      loader = await createLoader(probe.draco);
      asset = await loadAsset(loader);
      set({ status: 'glb', asset, error: null, detail: describeAsset(asset, []) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV !== 'production') console.warn('[warrior3d] GLB failed, using placeholder:', message);
      set({ status: 'error', error: message, detail: 'GLB failed — placeholder in use' });
      return;
    }
    // Separate animation files: after the model is on stage, never blocking it.
    if (probe.extras.length > 0) {
      await afterFirstRender();
      const loaded = await loadAnimationFiles(loader, asset, probe.extras);
      if (loaded.length > 0) set({ detail: describeAsset(asset, loaded) });
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
