// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: automatic humanoid rigging
// A static (unskinned) humanoid GLB gets a skeleton at load time:
// landmarks are read off the vertex cloud with horizontal cross-
// sections (crotch = where the legs split, armpit = where the width
// jumps to the arm span, shoulder line = where the pauldrons join the
// head, …) and an arm-axis fit (T vs A pose), then a Mixamo-named bone
// hierarchy is placed on them and every vertex is weighted by region
// (arm / leg / torso) with smooth cascades across the joints: sharp at
// elbows / knees / wrists (rigid armor), wider at shoulders and hips.
// Runs on the normalised model (≈1.8 tall, feet on y = 0, centred).
// Pure three.js — no React.
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';

export const AUTO_RIG_PREFIX = 'mixamorig';

export const AUTO_BONES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'HeadTop_End',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'LeftHandMiddle1',
  'LeftHand_End',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'RightHandMiddle1',
  'RightHand_End',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
] as const;

export type AutoBoneName = (typeof AUTO_BONES)[number];

const PARENT: Record<AutoBoneName, AutoBoneName | null> = {
  Hips: null,
  Spine: 'Hips',
  Spine1: 'Spine',
  Spine2: 'Spine1',
  Neck: 'Spine2',
  Head: 'Neck',
  HeadTop_End: 'Head',
  LeftShoulder: 'Spine2',
  LeftArm: 'LeftShoulder',
  LeftForeArm: 'LeftArm',
  LeftHand: 'LeftForeArm',
  LeftHandMiddle1: 'LeftHand',
  LeftHand_End: 'LeftHandMiddle1',
  RightShoulder: 'Spine2',
  RightArm: 'RightShoulder',
  RightForeArm: 'RightArm',
  RightHand: 'RightForeArm',
  RightHandMiddle1: 'RightHand',
  RightHand_End: 'RightHandMiddle1',
  LeftUpLeg: 'Hips',
  LeftLeg: 'LeftUpLeg',
  LeftFoot: 'LeftLeg',
  LeftToeBase: 'LeftFoot',
  RightUpLeg: 'Hips',
  RightLeg: 'RightUpLeg',
  RightFoot: 'RightLeg',
  RightToeBase: 'RightFoot',
};

export function autoBoneParent(name: AutoBoneName): AutoBoneName | null {
  return PARENT[name];
}

/** Landmarks of one side (character left = +x, the model faces +z). */
export interface AutoRigSide {
  clavicle: THREE.Vector3;
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  wrist: THREE.Vector3;
  /** Finger root (knuckles) — the grip bone curls everything past it. */
  knuckles: THREE.Vector3;
  handTip: THREE.Vector3;
  upLeg: THREE.Vector3;
  knee: THREE.Vector3;
  ankle: THREE.Vector3;
  toe: THREE.Vector3;
}

export interface AutoRigLandmarks {
  height: number;
  headTop: THREE.Vector3;
  head: THREE.Vector3;
  neck: THREE.Vector3;
  spine2: THREE.Vector3;
  spine1: THREE.Vector3;
  spine: THREE.Vector3;
  hips: THREE.Vector3;
  crotchY: number;
  armpitY: number;
  /** Top of the shoulder line (where the head's silhouette widens). */
  shoulderTopY: number;
  /** Torso half-width just under the armpits. */
  chestHalfWidth: number;
  left: AutoRigSide;
  right: AutoRigSide;
  /** Arm angle below horizontal (radians): ~0 T-pose, larger = A-pose. */
  armTilt: number;
  armPose: 'T' | 'A';
  handLength: number;
  /** Direction the source mesh faced (+1 = +z). −z models are turned around. */
  facing: 1 | -1;
  /** Chest arc-reactor spot found in the colour map (model space), if any. */
  reactor: THREE.Vector3 | null;
}

export interface AutoRigInfo {
  landmarks: AutoRigLandmarks;
  /** Bone name (with prefix) per auto bone. */
  boneNames: Record<AutoBoneName, string>;
  /** Bind-pose position (rig space) per auto bone. Bind rotations are identity. */
  rest: Record<AutoBoneName, THREE.Vector3>;
  /** Name of the group holding the skinned meshes + bone hierarchy. */
  rootName: string;
  vertexCount: number;
}

/** Reads the base-colour map at a UV (0…1 per channel), or null. */
export type ColorSampler = (u: number, v: number) => [number, number, number] | null;

// ─── Smooth normals ───

/**
 * Smooth vertex normals for a geometry that has none. Vertices sharing a
 * position (UV seams split them) share a normal, so seams don't crease.
 * Returns false when normals already existed.
 */
export function ensureSmoothNormals(geometry: THREE.BufferGeometry): boolean {
  if (geometry.getAttribute('normal')) return false;
  const pos = geometry.getAttribute('position');
  if (!pos) return false;
  const n = pos.count;
  const group = new Int32Array(n);
  const keys = new Map<string, number>();
  let groups = 0;
  const q = 1e4 / Math.max(1e-6, boxOf(pos).getSize(new THREE.Vector3()).length());
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * q)}|${Math.round(pos.getY(i) * q)}|${Math.round(pos.getZ(i) * q)}`;
    let g = keys.get(key);
    if (g === undefined) {
      g = groups++;
      keys.set(key, g);
    }
    group[i] = g;
  }
  const sum = new Float32Array(groups * 3);
  const index = geometry.getIndex();
  const tris = index ? index.count : n;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < tris; t += 3) {
    const ia = index ? index.getX(t) : t;
    const ib = index ? index.getX(t + 1) : t + 1;
    const ic = index ? index.getX(t + 2) : t + 2;
    a.fromBufferAttribute(pos, ia);
    b.fromBufferAttribute(pos, ib).sub(a);
    c.fromBufferAttribute(pos, ic).sub(a);
    b.cross(c); // area-weighted face normal
    for (const i of [ia, ib, ic]) {
      const g = group[i] * 3;
      sum[g] += b.x;
      sum[g + 1] += b.y;
      sum[g + 2] += b.z;
    }
  }
  const normals = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const g = group[i] * 3;
    a.set(sum[g], sum[g + 1], sum[g + 2]);
    if (a.lengthSq() < 1e-20) a.set(0, 1, 0);
    a.normalize();
    normals[i * 3] = a.x;
    normals[i * 3 + 1] = a.y;
    normals[i * 3 + 2] = a.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return true;
}

function boxOf(pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): THREE.Box3 {
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i));
  return box;
}

// ─── Point cloud + cross-sections ───

interface Cloud {
  /** Vertex positions (xyz). */
  p: Float32Array;
  count: number;
  /** Triangles as vertex indices into p. */
  tri: Uint32Array;
  uv: (Float32Array | null)[];
  /** Per vertex: which source mesh (for colour sampling). */
  meshOf: Uint16Array;
  minY: number;
  maxY: number;
}

interface Interval {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Horizontal cross-section at height y: merged x-intervals (with their z-range). */
function section(cloud: Cloud, y: number, tol: number): Interval[] {
  const { p, tri } = cloud;
  const raw: Interval[] = [];
  const hx: number[] = [];
  const hz: number[] = [];
  for (let t = 0; t < tri.length; t += 3) {
    const i0 = tri[t] * 3;
    const i1 = tri[t + 1] * 3;
    const i2 = tri[t + 2] * 3;
    const y0 = p[i0 + 1];
    const y1 = p[i1 + 1];
    const y2 = p[i2 + 1];
    if ((y0 < y && y1 < y && y2 < y) || (y0 > y && y1 > y && y2 > y)) continue;
    hx.length = 0;
    hz.length = 0;
    const edge = (a: number, b: number, ya: number, yb: number) => {
      if ((ya - y) * (yb - y) > 0 || ya === yb) return;
      const k = (y - ya) / (yb - ya);
      hx.push(p[a] + (p[b] - p[a]) * k);
      hz.push(p[a + 2] + (p[b + 2] - p[a + 2]) * k);
    };
    edge(i0, i1, y0, y1);
    edge(i1, i2, y1, y2);
    edge(i2, i0, y2, y0);
    if (hx.length === 0) continue;
    raw.push({ x0: Math.min(...hx), x1: Math.max(...hx), z0: Math.min(...hz), z1: Math.max(...hz) });
  }
  raw.sort((a, b) => a.x0 - b.x0);
  const out: Interval[] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r.x0 <= last.x1 + tol) {
      last.x1 = Math.max(last.x1, r.x1);
      last.z0 = Math.min(last.z0, r.z0);
      last.z1 = Math.max(last.z1, r.z1);
    } else out.push({ ...r });
  }
  return out;
}

function centerInterval(ivs: Interval[]): Interval | null {
  return ivs.find((iv) => iv.x0 <= 0 && iv.x1 >= 0) ?? null;
}

function halfWidth(iv: Interval | null): number {
  return iv ? Math.max(-iv.x0, iv.x1) : 0;
}

/** Innermost interval on a side (s = +1 left / −1 right) that doesn't straddle x = 0. */
function sideInterval(ivs: Interval[], s: number): Interval | null {
  let best: Interval | null = null;
  for (const iv of ivs) {
    const mid = (iv.x0 + iv.x1) / 2;
    if (mid * s <= 0 || (iv.x0 < 0 && iv.x1 > 0)) continue;
    if (!best || Math.abs(mid) < Math.abs((best.x0 + best.x1) / 2)) best = iv;
  }
  return best;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ─── Landmarks ───

function detectFacing(cloud: Cloud, H: number): 1 | -1 {
  // Toes stick out the way the figure faces: compare the soles' z with the shins'.
  const { p, count } = cloud;
  let footZ = 0;
  let footN = 0;
  let shinZ = 0;
  let shinN = 0;
  for (let i = 0; i < count; i++) {
    const y = p[i * 3 + 1] - cloud.minY;
    const z = p[i * 3 + 2];
    if (y < 0.035 * H) {
      footZ += z;
      footN++;
    } else if (y > 0.15 * H && y < 0.25 * H) {
      shinZ += z;
      shinN++;
    }
  }
  if (!footN || !shinN) return 1;
  const d = footZ / footN - shinZ / shinN;
  return d < -0.004 * H ? -1 : 1;
}

function findLandmarks(cloud: Cloud, facing: 1 | -1, sampleColor: ColorSampler[] | null): AutoRigLandmarks | null {
  const { p, count, minY, maxY } = cloud;
  const H = maxY - minY;
  if (!(H > 0)) return null;
  const tol = 0.004 * H;
  const cache = new Map<number, Interval[]>();
  const sec = (y: number) => {
    const key = Math.round(y * 1e4);
    let s = cache.get(key);
    if (!s) {
      s = section(cloud, y, tol);
      cache.set(key, s);
    }
    return s;
  };
  const step = H / 200;
  const Y = (f: number) => minY + f * H;

  // Crotch: descending from the belly, the first height where x = 0 is empty.
  let crotchY = NaN;
  for (let y = Y(0.62); y > Y(0.2); y -= step) {
    if (!centerInterval(sec(y))) {
      crotchY = y + step / 2;
      break;
    }
  }
  if (!Number.isFinite(crotchY)) return null;

  // Torso half-width profile above the crotch; the armpit is where it jumps to the arm span.
  let armpitY = NaN;
  let prevW = halfWidth(centerInterval(sec(crotchY + 0.1 * H)));
  for (let y = crotchY + 0.1 * H + step; y < Y(0.92); y += step) {
    const w = halfWidth(centerInterval(sec(y)));
    if (w - prevW > 0.025 * H) {
      armpitY = y - step;
      break;
    }
    prevW = w;
  }
  if (!Number.isFinite(armpitY)) return null;
  const chestHalf = halfWidth(centerInterval(sec(armpitY - 0.015 * H)));

  // Head + shoulder line: descending from the top, the head's silhouette widens at the shoulders.
  let headHalf = 0;
  for (let y = maxY - 0.02 * H; y > maxY - 0.1 * H; y -= step) headHalf = Math.max(headHalf, halfWidth(centerInterval(sec(y))));
  let shoulderTopY = NaN;
  for (let y = maxY - 0.06 * H; y > armpitY; y -= step) {
    if (halfWidth(centerInterval(sec(y))) > headHalf * 1.6) {
      shoulderTopY = y;
      break;
    }
  }
  if (!Number.isFinite(shoulderTopY)) shoulderTopY = maxY - 0.14 * H;

  const zMid = (y: number, fallback = 0) => {
    const iv = centerInterval(sec(y));
    return iv ? (iv.z0 + iv.z1) / 2 : fallback;
  };

  // Spine chain.
  const hipsY = crotchY + 0.07 * H;
  const headY = shoulderTopY + 0.3 * (maxY - shoulderTopY);
  const neckY = shoulderTopY - 0.02 * H;
  const at = (y: number) => new THREE.Vector3(0, y, zMid(y));
  const hips = at(hipsY);
  const spine = at(hipsY + (neckY - hipsY) * 0.22);
  const spine1 = at(hipsY + (neckY - hipsY) * 0.45);
  const spine2 = at(hipsY + (neckY - hipsY) * 0.68);
  const neck = at(neckY);
  const head = at(headY);
  const headTop = new THREE.Vector3(0, maxY, head.z);

  // Ankle: where the leg's depth grows into the foot.
  const legAt = (y: number, s: number) => sideInterval(sec(y), s);

  const sides: Partial<Record<'left' | 'right', AutoRigSide>> = {};
  let tiltSum = 0;
  let handLength = 0.105 * H;
  for (const [key, s] of [['left', 1], ['right', -1]] as const) {
    // ─ Leg ─
    const shin = legAt(Y(0.2), s);
    if (!shin) return null;
    const shinDepth = shin.z1 - shin.z0;
    let ankleY = Y(0.055);
    for (let y = Y(0.15); y > Y(0.03); y -= step) {
      const iv = legAt(y, s);
      if (iv && iv.z1 - iv.z0 > shinDepth * 1.35) {
        ankleY = Math.min(Y(0.09), Math.max(Y(0.035), y + 0.01 * H));
        break;
      }
    }
    const legPoint = (y: number, sampleY = y) => {
      const iv = legAt(sampleY, s);
      if (!iv) return null;
      return new THREE.Vector3((iv.x0 + iv.x1) / 2, y, (iv.z0 + iv.z1) / 2);
    };
    const thighTop = legPoint(crotchY + 0.035 * H, crotchY - 0.04 * H);
    const kneeY = minY + (crotchY - minY) * 0.63;
    const knee = legPoint(kneeY);
    const ankle = legPoint(ankleY, ankleY + 0.03 * H);
    if (!thighTop || !knee || !ankle) return null;
    thighTop.z = hips.z;
    // Toe: the front-most sole point of this foot.
    let toeZ = -Infinity;
    let toeX = 0;
    for (let i = 0; i < count; i++) {
      const x = p[i * 3];
      const y = p[i * 3 + 1];
      if (y > ankleY || x * s <= 0) continue;
      if (Math.abs(x - ankle.x) > 0.12 * H) continue;
      if (p[i * 3 + 2] > toeZ) {
        toeZ = p[i * 3 + 2];
        toeX = x;
      }
    }
    const toe = new THREE.Vector3((toeX + ankle.x) / 2, minY + 0.02 * H, Math.max(ankle.z, toeZ - 0.02 * H));

    // ─ Arm ─ tip = the lateral extreme above the hips.
    let tipI = -1;
    for (let i = 0; i < count; i++) {
      if (p[i * 3 + 1] < hipsY) continue;
      if (tipI < 0 || p[i * 3] * s > p[tipI * 3] * s) tipI = i;
    }
    if (tipI < 0) return null;
    const tipX = p[tipI * 3];
    if (tipX * s < chestHalf * 1.6) return null; // arms hang down — not a T / A pose
    // Fit the arm axis through x-slices of the upper arm + forearm.
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];
    const span = tipX * s - chestHalf;
    const band = 0.012 * H;
    for (let f = 0.4; f <= 0.72; f += 0.04) {
      const cx = s * (chestHalf + span * f);
      let y0 = Infinity;
      let y1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (let i = 0; i < count; i++) {
        if (Math.abs(p[i * 3] - cx) > band || p[i * 3 + 1] < crotchY) continue;
        y0 = Math.min(y0, p[i * 3 + 1]);
        y1 = Math.max(y1, p[i * 3 + 1]);
        z0 = Math.min(z0, p[i * 3 + 2]);
        z1 = Math.max(z1, p[i * 3 + 2]);
      }
      if (y1 < y0) continue;
      xs.push(cx);
      ys.push((y0 + y1) / 2);
      zs.push((z0 + z1) / 2);
    }
    if (xs.length < 3) return null;
    const fit = (vs: number[]) => {
      const n = xs.length;
      const mx = xs.reduce((a, b) => a + b, 0) / n;
      const mv = vs.reduce((a, b) => a + b, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - mx) * (vs[i] - mv);
        den += (xs[i] - mx) ** 2;
      }
      const slope = den > 0 ? num / den : 0;
      return (x: number) => mv + slope * (x - mx);
    };
    const lineY = fit(ys);
    const lineZ = fit(zs);
    const on = (x: number) => new THREE.Vector3(x, lineY(x), lineZ(x));
    const shoulderX = s * chestHalf * 0.95;
    const shoulder = on(shoulderX);
    shoulder.y = Math.min(shoulder.y, neckY - 0.01 * H);
    // Depth: the arm line's slope is unreliable that far in — sit in the torso's middle.
    shoulder.z = zMid(Math.min(shoulder.y, armpitY), spine2.z);
    const tipOn = on(tipX);
    const u = tipOn.clone().sub(shoulder).normalize();
    tiltSum += Math.atan2(-u.y, Math.abs(u.x));
    handLength = 0.105 * H;
    const wrist = tipOn.clone().addScaledVector(u, -handLength);
    const knuckles = tipOn.clone().addScaledVector(u, -handLength * 0.52);
    const elbow = shoulder.clone().lerp(wrist, 0.54);
    const clavicle = new THREE.Vector3(s * chestHalf * 0.28, shoulder.y + 0.01 * H, spine2.z);
    const handTip = new THREE.Vector3(tipX, p[tipI * 3 + 1], p[tipI * 3 + 2]);
    sides[key] = { clavicle, shoulder, elbow, wrist, knuckles, handTip: tipOn.lerp(handTip, 0.5), upLeg: thighTop, knee, ankle, toe };
  }
  const left = sides.left as AutoRigSide;
  const right = sides.right as AutoRigSide;

  // Sanity: the chain has to run bottom-up.
  const order = [left.ankle.y, left.knee.y, left.upLeg.y, hips.y, spine.y, spine1.y, spine2.y, neck.y, head.y, maxY];
  for (let i = 1; i < order.length; i++) if (!(order[i] > order[i - 1])) return null;

  const armTilt = tiltSum / 2;
  const landmarks: AutoRigLandmarks = {
    height: H,
    headTop,
    head,
    neck,
    spine2,
    spine1,
    spine,
    hips,
    crotchY,
    armpitY,
    shoulderTopY,
    chestHalfWidth: chestHalf,
    left,
    right,
    armTilt,
    armPose: armTilt < THREE.MathUtils.degToRad(12) ? 'T' : 'A',
    handLength,
    facing,
    reactor: null,
  };
  if (sampleColor) landmarks.reactor = findReactor(cloud, landmarks, sampleColor);
  return landmarks;
}

/** Bright cyan texels on the front of the chest → the baked arc reactor. */
function findReactor(cloud: Cloud, lm: AutoRigLandmarks, samplers: ColorSampler[]): THREE.Vector3 | null {
  const { p, count, uv, meshOf } = cloud;
  const acc = new THREE.Vector3();
  let wsum = 0;
  let maxZ = -Infinity;
  let hits = 0;
  for (let i = 0; i < count; i++) {
    const x = p[i * 3];
    const y = p[i * 3 + 1];
    const z = p[i * 3 + 2];
    if (y < lm.spine1.y || y > lm.neck.y || Math.abs(x) > lm.chestHalfWidth * 0.7 || z < lm.spine2.z) continue;
    const m = meshOf[i];
    const uvs = uv[m];
    const sample = samplers[m];
    if (!uvs || !sample) continue;
    const c = sample(uvs[i * 2], uvs[i * 2 + 1]);
    if (!c) continue;
    const [r, g, b] = c;
    if (!(b > 0.55 && g > 0.45 && b - r > 0.2)) continue;
    const w = g + b;
    acc.x += x * w;
    acc.y += y * w;
    wsum += w;
    maxZ = Math.max(maxZ, z);
    hits++;
  }
  if (hits < 3 || wsum <= 0) return null;
  return new THREE.Vector3(acc.x / wsum, acc.y / wsum, maxZ);
}

// ─── Skin weights ───

interface CascadeJoint {
  pos: THREE.Vector3;
  axis: THREE.Vector3;
  width: number;
}

function joint(pos: THREE.Vector3, from: THREE.Vector3, to: THREE.Vector3, width: number): CascadeJoint {
  const a = pos.clone().sub(from).normalize();
  const b = to.clone().sub(pos).normalize();
  const axis = a.add(b);
  if (axis.lengthSq() < 1e-8) axis.copy(b);
  return { pos, axis: axis.normalize(), width };
}

/** Distribute `scale` along a chain: bones[k] | joints[k] | bones[k+1] … */
function cascade(p: THREE.Vector3, joints: CascadeJoint[], bones: number[], scale: number, out: Float32Array): void {
  if (scale <= 0) return;
  let carry = scale;
  const d = new THREE.Vector3();
  for (let k = 0; k < joints.length; k++) {
    const j = joints[k];
    const c = smoothstep(-j.width, j.width, d.subVectors(p, j.pos).dot(j.axis));
    out[bones[k]] += carry * (1 - c);
    carry *= c;
  }
  out[bones[bones.length - 1]] += carry;
}

/** Shoulder weight split, out along the arm from the pivot (fraction of height). */
const SHOULDER_SPLIT = 0.05;

// ─── Main ───

/**
 * Rig every (unskinned) mesh under `root` onto one auto-built humanoid
 * skeleton. Geometry is baked into `root`'s space (turned to face +z if
 * needed); the meshes are replaced by SkinnedMeshes inside a new group.
 * Returns null (and leaves the scene untouched) when the figure doesn't
 * read as a T / A-pose humanoid.
 */
export function autoRigHumanoid(root: THREE.Object3D, options: { samplers?: Map<THREE.Mesh, ColorSampler | null> } = {}): AutoRigInfo | null {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry?.getAttribute('position')) meshes.push(m);
  });
  if (meshes.length === 0 || meshes.length > 64) return null;

  // Bake each mesh into root space (non-indexed geometry gets an index).
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const baked = meshes.map((m) => {
    const g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld));
    if (!g.getIndex()) {
      const n = g.getAttribute('position').count;
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    return g;
  });
  const build = (): Cloud => {
    let count = 0;
    let tris = 0;
    for (const g of baked) {
      count += g.getAttribute('position').count;
      tris += (g.getIndex() as THREE.BufferAttribute).count;
    }
    const p = new Float32Array(count * 3);
    const tri = new Uint32Array(tris);
    const meshOf = new Uint16Array(count);
    const uv: (Float32Array | null)[] = [];
    let off = 0;
    let toff = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    baked.forEach((g, mi) => {
      const pos = g.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        p[(off + i) * 3] = pos.getX(i);
        p[(off + i) * 3 + 1] = y;
        p[(off + i) * 3 + 2] = pos.getZ(i);
        meshOf[off + i] = mi;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const index = g.getIndex() as THREE.BufferAttribute;
      for (let i = 0; i < index.count; i++) tri[toff + i] = index.getX(i) + off;
      const uva = g.getAttribute('uv');
      // Per-mesh UVs addressed by the global vertex index (offset-padded).
      if (uva) {
        const arr = new Float32Array(count * 2);
        for (let i = 0; i < uva.count; i++) {
          arr[(off + i) * 2] = uva.getX(i);
          arr[(off + i) * 2 + 1] = uva.getY(i);
        }
        uv[mi] = arr;
      } else uv[mi] = null;
      off += pos.count;
      toff += index.count;
    });
    return { p, count, tri, uv, meshOf, minY, maxY };
  };

  let cloud = build();
  const facing = detectFacing(cloud, cloud.maxY - cloud.minY);
  if (facing === -1) {
    const turn = new THREE.Matrix4().makeRotationY(Math.PI);
    for (const g of baked) g.applyMatrix4(turn);
    cloud = build();
  }
  const samplers = options.samplers ? meshes.map((m) => options.samplers?.get(m) ?? null) : null;
  const lm = findLandmarks(cloud, facing, samplers && samplers.some(Boolean) ? (samplers as ColorSampler[]) : null);
  if (!lm) {
    baked.forEach((g) => g.dispose());
    return null;
  }

  // ─ Skeleton ─
  const rest: Record<AutoBoneName, THREE.Vector3> = {
    Hips: lm.hips,
    Spine: lm.spine,
    Spine1: lm.spine1,
    Spine2: lm.spine2,
    Neck: lm.neck,
    Head: lm.head,
    HeadTop_End: lm.headTop,
    LeftShoulder: lm.left.clavicle,
    LeftArm: lm.left.shoulder,
    LeftForeArm: lm.left.elbow,
    LeftHand: lm.left.wrist,
    LeftHandMiddle1: lm.left.knuckles,
    LeftHand_End: lm.left.handTip,
    RightShoulder: lm.right.clavicle,
    RightArm: lm.right.shoulder,
    RightForeArm: lm.right.elbow,
    RightHand: lm.right.wrist,
    RightHandMiddle1: lm.right.knuckles,
    RightHand_End: lm.right.handTip,
    LeftUpLeg: lm.left.upLeg,
    LeftLeg: lm.left.knee,
    LeftFoot: lm.left.ankle,
    LeftToeBase: lm.left.toe,
    RightUpLeg: lm.right.upLeg,
    RightLeg: lm.right.knee,
    RightFoot: lm.right.ankle,
    RightToeBase: lm.right.toe,
  };
  const boneNames = {} as Record<AutoBoneName, string>;
  const bones = {} as Record<AutoBoneName, THREE.Bone>;
  for (const name of AUTO_BONES) {
    const bone = new THREE.Bone();
    bone.name = AUTO_RIG_PREFIX + name;
    boneNames[name] = bone.name;
    bones[name] = bone;
    const parent = PARENT[name];
    bone.position.copy(rest[name]);
    if (parent) {
      bone.position.sub(rest[parent]);
      bones[parent].add(bone);
    }
  }
  const boneList = AUTO_BONES.map((n) => bones[n]);
  const bi = (n: AutoBoneName) => AUTO_BONES.indexOf(n);

  // ─ Weights ─
  const H = lm.height;
  const up = new THREE.Vector3(0, 1, 0);
  const torsoJoints: CascadeJoint[] = [
    { pos: lm.spine, axis: up, width: 0.035 * H },
    { pos: lm.spine1, axis: up, width: 0.035 * H },
    { pos: lm.spine2, axis: up, width: 0.035 * H },
    { pos: lm.neck, axis: up, width: 0.02 * H },
    { pos: lm.head, axis: up, width: 0.012 * H },
  ];
  const torsoBones = (['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'] as const).map(bi);
  const armChain = (s: AutoRigSide, pre: 'Left' | 'Right') => {
    const u = s.wrist.clone().sub(s.shoulder).normalize();
    return {
      joints: [
        // Shoulder split sits out along the arm and blends wide: the pauldron /
        // back-of-shoulder shell rides the clavicle (which follows the arm part-way).
        { pos: s.shoulder.clone().addScaledVector(u, SHOULDER_SPLIT * H), axis: u, width: 0.04 * H },
        { pos: s.elbow, axis: u, width: 0.012 * H },
        { pos: s.wrist, axis: u, width: 0.008 * H },
        { pos: s.knuckles, axis: u, width: 0.01 * H },
      ] as CascadeJoint[],
      bones: ([`${pre}Shoulder`, `${pre}Arm`, `${pre}ForeArm`, `${pre}Hand`, `${pre}HandMiddle1`] as AutoBoneName[]).map(bi),
      from: s.shoulder,
      to: s.handTip,
    };
  };
  const legChain = (s: AutoRigSide, pre: 'Left' | 'Right') => ({
    joints: [joint(s.knee, s.upLeg, s.ankle, 0.016 * H), joint(s.ankle, s.knee, s.toe, 0.01 * H)],
    bones: ([`${pre}UpLeg`, `${pre}Leg`, `${pre}Foot`] as AutoBoneName[]).map(bi),
  });
  const arms = { L: armChain(lm.left, 'Left'), R: armChain(lm.right, 'Right') };
  const legs = { L: legChain(lm.left, 'Left'), R: legChain(lm.right, 'Right') };

  // Torso half-width by height (measured under the armpits, held above).
  const tol = 0.004 * H;
  const widthCache = new Map<number, number>();
  const torsoHalfAt = (y: number) => {
    const yy = Math.min(y, lm.armpitY - 0.015 * H);
    const key = Math.round(yy / (H / 150));
    let w = widthCache.get(key);
    if (w === undefined) {
      w = halfWidth(centerInterval(section(cloud, key * (H / 150), tol))) || lm.chestHalfWidth;
      widthCache.set(key, w);
    }
    return Math.min(w, lm.chestHalfWidth * 1.05);
  };

  const total = new Float32Array(AUTO_BONES.length);
  const seg = new THREE.Line3();
  const closest = new THREE.Vector3();
  const v = new THREE.Vector3();
  const hipLine = Math.abs(lm.left.upLeg.x - lm.right.upLeg.x) / 2;
  let offset = 0;
  const skinned = baked.map((g, mi) => {
    const pos = g.getAttribute('position');
    const n = pos.count;
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      total.fill(0);
      const ax = Math.abs(v.x);
      // Leg share: full below the crotch, fading out over the hips.
      const leg = 1 - smoothstep(lm.crotchY - 0.015 * H, lm.left.upLeg.y + 0.035 * H, v.y);
      // Arm share: outside the torso's silhouette, above the hips.
      let arm = 0;
      if (v.y > lm.hips.y - 0.04 * H || ax > hipLine + 0.12 * H) {
        const edge = torsoHalfAt(v.y);
        const shoulderZone = v.y > lm.armpitY + 0.005 * H;
        arm = shoulderZone ? smoothstep(edge - 0.012 * H, edge + 0.03 * H, ax) : smoothstep(edge - 0.004 * H, edge + 0.01 * H, ax);
        if (!shoulderZone && arm > 0) {
          // Under the armpit, what sits just outside the torso outline is arm only when it hugs
          // the arm's axis (loose hip / tasset plates aren't); well outside the outline
          // (plates hanging behind / under the arm) it is always arm.
          const c = v.x >= 0 ? arms.L : arms.R;
          seg.set(c.from, c.to);
          seg.closestPointToPoint(v, true, closest);
          const nearBody = 1 - smoothstep(edge + 0.04 * H, edge + 0.08 * H, ax);
          arm *= 1 - smoothstep(0.07 * H, 0.1 * H, closest.distanceTo(v)) * nearBody;
        }
        arm *= smoothstep(lm.hips.y - 0.04 * H, lm.hips.y + 0.02 * H, v.y) || (ax > hipLine + 0.12 * H ? 1 : 0);
      }
      const legShare = Math.min(leg, 1 - arm);
      const torso = Math.max(0, 1 - arm - legShare);
      cascade(v, torsoJoints, torsoBones, torso, total);
      if (arm > 0) {
        const c = v.x >= 0 ? arms.L : arms.R;
        cascade(v, c.joints, c.bones, arm, total);
      }
      if (legShare > 0) {
        // Blend the sides across the crotch so the inseam doesn't tear.
        const wl = smoothstep(-0.015 * H, 0.015 * H, v.x);
        cascade(v, legs.L.joints, legs.L.bones, legShare * wl, total);
        cascade(v, legs.R.joints, legs.R.bones, legShare * (1 - wl), total);
      }
      // Top 4 influences, normalised.
      const top: number[] = [];
      for (let b = 0; b < total.length; b++) {
        if (total[b] <= 1e-4) continue;
        top.push(b);
      }
      top.sort((a, b) => total[b] - total[a]);
      top.length = Math.min(4, top.length);
      let sum = 0;
      for (const b of top) sum += total[b];
      if (sum <= 0) {
        skinIndex[i * 4] = bi('Hips');
        skinWeight[i * 4] = 1;
        continue;
      }
      top.forEach((b, k) => {
        skinIndex[i * 4 + k] = b;
        skinWeight[i * 4 + k] = total[b] / sum;
      });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    offset += n;
    const src = meshes[mi];
    const sm = new THREE.SkinnedMesh(g, src.material);
    sm.name = src.name || `warrior-skin-${mi}`;
    sm.castShadow = src.castShadow;
    sm.receiveShadow = src.receiveShadow;
    sm.frustumCulled = false;
    sm.renderOrder = src.renderOrder;
    return sm;
  });

  // ─ Swap into the scene ─
  const group = new THREE.Group();
  group.name = 'WarriorAutoRig';
  group.add(bones.Hips);
  for (const m of meshes) {
    m.removeFromParent();
    m.geometry.dispose(); // replaced by its baked, skinned copy
  }
  for (const sm of skinned) group.add(sm);
  root.add(group);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(boneList);
  for (const sm of skinned) sm.bind(skeleton);

  return {
    landmarks: lm,
    boneNames,
    rest,
    rootName: group.name,
    vertexCount: offset,
  };
}

/** One-line landmark summary for logs / the lab readout. */
export function describeLandmarks(lm: AutoRigLandmarks): string {
  const f = (n: number) => n.toFixed(2);
  const v = (p: THREE.Vector3) => `${f(p.x)},${f(p.y)},${f(p.z)}`;
  return (
    `${lm.armPose}-pose ${Math.round(THREE.MathUtils.radToDeg(lm.armTilt))}° · crotch ${f(lm.crotchY)} · armpit ${f(lm.armpitY)} · ` +
    `shoulders ${v(lm.left.shoulder)} · wrist ${v(lm.left.wrist)} · knee ${v(lm.left.knee)} · ankle ${v(lm.left.ankle)} · ` +
    `head ${f(lm.head.y)} · faced ${lm.facing > 0 ? '+z' : '−z'}` +
    (lm.reactor ? ` · reactor ${v(lm.reactor)}` : '')
  );
}
