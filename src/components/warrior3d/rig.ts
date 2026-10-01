// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: procedural armored warrior (builder)
// A stylised armored humanoid made from faceted primitives: chamfered
// plates, a helmet with a V visor slit, layered pauldrons, a chest
// plate with an arc-reactor socket, segmented limbs and glowing seams.
// Built as a joint hierarchy (hips → spine → chest → neck → head,
// shoulders → elbows → hands, thighs → knees → ankles) so pose.ts can
// animate it. Pure three.js — no React.
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { WarriorTier } from './types';

export const JOINTS = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'shoulderL',
  'elbowL',
  'handL',
  'shoulderR',
  'elbowR',
  'handR',
  'thighL',
  'kneeL',
  'ankleL',
  'thighR',
  'kneeR',
  'ankleR',
] as const;

export type JointName = (typeof JOINTS)[number];

export interface RigMaterials {
  armor: THREE.MeshPhysicalMaterial;
  steel: THREE.MeshPhysicalMaterial;
  suit: THREE.MeshPhysicalMaterial;
  /** Tier-coloured emissive seams. */
  trim: THREE.MeshBasicMaterial;
  /** Plasma visor / comm lights. */
  visor: THREE.MeshBasicMaterial;
  /** Cape-light ribbons (tier 4+). */
  cape: THREE.ShaderMaterial | null;
}

export interface WarriorRig {
  root: THREE.Group;
  joints: Record<JointName, THREE.Group>;
  /** Sole anchors — used to plant the feet on y = 0. */
  soles: [THREE.Object3D, THREE.Object3D];
  /** Arc-reactor socket on the chest (+ chest centre for its facing). */
  socket: THREE.Object3D;
  chestCenter: THREE.Object3D;
  /** Rest height of the hips joint. */
  hipsY: number;
  materials: RigMaterials;
  /** Optional halo (tier 5) spun by the animator. */
  halo: THREE.Object3D | null;
  dispose: () => void;
}

/** What the ProceduralAnimator needs: a joint hierarchy + sole anchors. */
export type AnimatableRig = Pick<WarriorRig, 'root' | 'joints' | 'soles' | 'hipsY' | 'halo'>;

// ─── Geometry helpers ───

const geometries: THREE.BufferGeometry[] = [];

function track<T extends THREE.BufferGeometry>(g: T): T {
  geometries.push(g);
  return g;
}

/** Chamfered box (1 bevel segment = crisp faceted edges). */
function plate(w: number, h: number, d: number, bevel = 0.012): THREE.BufferGeometry {
  return track(new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, Math.min(w, h, d) * 0.45)));
}

/** Tapered 8-sided limb segment hanging down from y=0 to y=-len. */
function limb(rTop: number, rBottom: number, len: number, sides = 8): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, len, sides, 1);
  g.translate(0, -len / 2, 0);
  return track(g);
}

/** Faceted extruded plate from a 2D outline (x right, y up), centred in depth. */
function extruded(points: [number, number][], depth: number, bevel = 0.012): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  return track(g);
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  pos: [number, number, number] = [0, 0, 0],
  rot: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] | number = 1
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...pos);
  m.rotation.set(...rot);
  if (typeof scale === 'number') m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function joint(name: string, parent: THREE.Object3D, pos: [number, number, number]): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...pos);
  parent.add(g);
  return g;
}

// ─── Materials ───

const CAPE_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float down = 1.0 - uv.y;
    p.z -= down * down * 0.18 + sin(uTime * 2.1 + down * 5.0 + p.x * 6.0) * 0.035 * down;
    p.x += sin(uTime * 1.3 + down * 3.0) * 0.02 * down;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const CAPE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float fade = pow(vUv.y, 1.4);
    float lines = 0.55 + 0.45 * sin(vUv.y * 60.0 - uTime * 6.0);
    float rim = smoothstep(0.1, 0.0, vUv.x) + smoothstep(0.9, 1.0, vUv.x);
    float a = (edge * 0.35 * lines + rim * 0.9) * fade * uIntensity;
    gl_FragColor = vec4(uColor * (1.2 + rim), a);
  }
`;

export function createRigMaterials(tier: WarriorTier, trimHex: string): RigMaterials {
  const armor = new THREE.MeshPhysicalMaterial({
    color: '#15181d',
    metalness: 0.9,
    roughness: 0.24,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    flatShading: true,
    envMapIntensity: 1.5,
  });
  const steel = new THREE.MeshPhysicalMaterial({
    color: tier >= 4 ? '#8a7c62' : '#5d6773',
    metalness: 1,
    roughness: 0.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    flatShading: true,
    envMapIntensity: 1.6,
  });
  const suit = new THREE.MeshPhysicalMaterial({
    color: '#0a0c10',
    metalness: 0.55,
    roughness: 0.5,
    sheen: 0.4,
    sheenColor: new THREE.Color('#1b3a44'),
    envMapIntensity: 0.8,
  });
  const trim = new THREE.MeshBasicMaterial({ color: trimHex, toneMapped: false });
  const visor = new THREE.MeshBasicMaterial({ color: '#2fd6f5', toneMapped: false });
  const cape =
    tier >= 4
      ? new THREE.ShaderMaterial({
          vertexShader: CAPE_VERT,
          fragmentShader: CAPE_FRAG,
          uniforms: {
            uColor: { value: new THREE.Color(trimHex) },
            uIntensity: { value: 1 },
            uTime: { value: 0 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        })
      : null;
  return { armor, steel, suit, trim, visor, cape };
}

// ─── Builder ───

/** Build the procedural warrior for a tier. Call rig.dispose() when done. */
export function buildWarriorRig(tier: WarriorTier, trimHex: string): WarriorRig {
  geometries.length = 0;
  const mats = createRigMaterials(tier, trimHex);
  const { armor, steel, suit, trim, visor } = mats;
  const big = tier >= 2 ? 1.28 : 1.15;

  const root = new THREE.Group();
  root.name = 'WarriorRig';

  const HIPS_Y = 0.94;
  const hips = joint('hips', root, [0, HIPS_Y, 0]);

  // ── Pelvis: belt, buckle, tassets ──
  mesh(limb(0.155, 0.14, 0.12, 8), suit, hips, [0, 0.03, 0]);
  mesh(limb(0.165, 0.16, 0.065, 8), armor, hips, [0, 0.07, 0]);
  mesh(extruded([[-0.035, -0.03], [0.035, -0.03], [0.045, 0.0], [0.035, 0.03], [-0.035, 0.03], [-0.045, 0.0]], 0.02, 0.006), steel, hips, [0, 0.035, 0.165]);
  mesh(plate(0.05, 0.012, 0.012, 0.004), trim, hips, [0, 0.035, 0.182]);
  // Front tassets (two angled plates) + side tassets.
  for (const side of [-1, 1]) {
    mesh(plate(0.12, 0.15, 0.022, 0.008), armor, hips, [side * 0.075, -0.05, 0.14], [0.18, side * 0.12, side * 0.06]);
    mesh(plate(0.1, 0.006, 0.006, 0.002), trim, hips, [side * 0.075, -0.115, 0.157], [0.18, side * 0.12, side * 0.06]);
    mesh(plate(0.022, 0.16, 0.13, 0.008), armor, hips, [side * 0.17, -0.05, 0.0], [0, 0, side * 0.14]);
  }
  mesh(plate(0.22, 0.14, 0.02, 0.008), armor, hips, [0, -0.04, -0.14], [-0.16, 0, 0]);

  // ── Spine / abdomen ──
  const spine = joint('spine', hips, [0, 0.1, 0]);
  mesh(limb(0.135, 0.15, 0.2, 8), suit, spine, [0, 0.2, 0]);
  for (let i = 0; i < 3; i++) {
    const y = 0.03 + i * 0.058;
    const w = 0.19 + i * 0.022;
    mesh(plate(w, 0.048, 0.07, 0.012), armor, spine, [0, y, 0.095]);
    mesh(plate(w * 0.72, 0.005, 0.01, 0.002), trim, spine, [0, y + 0.029, 0.126]);
  }
  for (const side of [-1, 1]) {
    mesh(plate(0.03, 0.16, 0.12, 0.008), armor, spine, [side * 0.13, 0.08, 0.0], [0, 0, side * -0.08]);
  }

  // ── Chest ──
  const chest = joint('chest', spine, [0, 0.19, 0]);
  const chestCenter = joint('chestCenter', chest, [0, 0.16, 0]);
  // Core cuirass: shield outline, deep extrude, faceted bevels.
  mesh(
    extruded(
      [[-0.16, 0.0], [-0.24, 0.15], [-0.235, 0.28], [-0.12, 0.33], [0.12, 0.33], [0.235, 0.28], [0.24, 0.15], [0.16, 0.0], [0.07, -0.04], [-0.07, -0.04]],
      0.23,
      0.03
    ),
    armor,
    chest,
    [0, 0, 0]
  );
  // Pectoral plates, angled like a V to catch the rim light.
  for (const side of [-1, 1]) {
    mesh(
      extruded([[0, 0], [0.18, 0.03], [0.19, 0.15], [0.11, 0.2], [0.0, 0.18]], 0.03, 0.01),
      armor,
      chest,
      [side * 0.012, 0.11, 0.14],
      [0.05, side * 0.32, 0],
      [side, 1, 1]
    );
    // Seam that traces the lower edge of each pectoral.
    mesh(plate(0.17, 0.006, 0.008, 0.002), trim, chest, [side * 0.1, 0.105, 0.172], [0, side * 0.32, side * 0.19]);
    // Lats / side ribs.
    mesh(plate(0.035, 0.22, 0.17, 0.01), armor, chest, [side * 0.24, 0.15, 0], [0, 0, side * 0.12]);
  }
  // Centre ridge down the sternum.
  mesh(plate(0.03, 0.12, 0.03, 0.008), steel, chest, [0, 0.03, 0.15]);
  mesh(plate(0.006, 0.1, 0.006, 0.002), trim, chest, [0, 0.03, 0.167]);
  // Arc-reactor socket: steel collar ring + dark well.
  const socketBase = joint('socketBase', chest, [0, 0.16, 0.19]);
  const collar = new THREE.TorusGeometry(0.052, 0.013, 6, 10);
  track(collar);
  mesh(collar, steel, socketBase, [0, 0, 0]);
  mesh(track(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 10)), suit, socketBase, [0, 0, -0.008], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    mesh(plate(0.018, 0.03, 0.012, 0.004), steel, socketBase, [Math.cos(a) * 0.072, Math.sin(a) * 0.072, 0.002], [0, 0, a + Math.PI / 2]);
  }
  const socket = joint('socket', socketBase, [0, 0, 0.012]);
  // Back plate + power spine.
  mesh(plate(0.4, 0.3, 0.07, 0.022), armor, chest, [0, 0.15, -0.13], [0.06, 0, 0]);
  for (let i = 0; i < 3; i++) {
    mesh(plate(0.07, 0.04, 0.04, 0.01), steel, chest, [0, 0.07 + i * 0.07, -0.175]);
    mesh(plate(0.05, 0.008, 0.01, 0.002), trim, chest, [0, 0.07 + i * 0.07, -0.198]);
  }
  // Gorget (tier 2+) / plain collar.
  mesh(limb(0.105, 0.14, tier >= 2 ? 0.08 : 0.05, 8), tier >= 2 ? armor : suit, chest, [0, 0.35, 0]);
  if (tier >= 4) {
    // Chest trim ring around the socket.
    const ring = new THREE.TorusGeometry(0.095, 0.004, 4, 24);
    track(ring);
    mesh(ring, trim, socketBase, [0, 0, -0.004]);
  }

  // ── Neck + head ──
  const neck = joint('neck', chest, [0, 0.34, 0]);
  mesh(limb(0.055, 0.065, 0.09, 8), suit, neck, [0, 0.08, 0]);
  const head = joint('head', neck, [0, 0.09, 0.01]);
  // Helmet dome — faceted.
  const dome = new THREE.SphereGeometry(0.12, 9, 7);
  track(dome);
  mesh(dome, armor, head, [0, 0.1, -0.01], [0, 0, 0], [0.92, 1.05, 1.08]);
  // Faceplate: angular jaw mask in front of the dome.
  mesh(
    extruded([[-0.085, 0.03], [-0.095, 0.1], [-0.07, 0.14], [0.07, 0.14], [0.095, 0.1], [0.085, 0.03], [0.03, -0.035], [-0.03, -0.035]], 0.05, 0.012),
    armor,
    head,
    [0, 0.0, 0.075],
    [-0.08, 0, 0]
  );
  // Brow ridge.
  mesh(plate(0.2, 0.03, 0.06, 0.01), steel, head, [0, 0.145, 0.07], [0.22, 0, 0]);
  // Visor slit: a shallow V of two plasma bars.
  for (const side of [-1, 1]) {
    mesh(plate(0.085, 0.014, 0.012, 0.004), visor, head, [side * 0.043, 0.112, 0.128], [0, side * 0.26, side * -0.14]);
  }
  // Jaw: a dark vent grille in a chamfered chin guard.
  mesh(plate(0.07, 0.04, 0.02, 0.008), steel, head, [0, 0.03, 0.118], [-0.25, 0, 0]);
  for (let i = 0; i < 4; i++) {
    mesh(plate(0.05, 0.004, 0.006, 0.001), suit, head, [0, 0.018 + i * 0.008, 0.129], [-0.25, 0, 0]);
  }
  // Cheek plates sweeping back from the visor.
  for (const side of [-1, 1]) {
    mesh(plate(0.012, 0.06, 0.08, 0.005), armor, head, [side * 0.088, 0.07, 0.07], [0, side * 0.5, side * 0.12]);
  }
  // Comm pods on the sides.
  for (const side of [-1, 1]) {
    mesh(track(new THREE.CylinderGeometry(0.03, 0.036, 0.03, 8)), steel, head, [side * 0.112, 0.1, -0.005], [0, 0, Math.PI / 2]);
    const pod = new THREE.TorusGeometry(0.02, 0.004, 4, 12);
    track(pod);
    mesh(pod, visor, head, [side * 0.129, 0.1, -0.005], [0, Math.PI / 2, 0]);
  }
  // Crest (tier 3+): a swept fin from brow to nape.
  if (tier >= 3) {
    mesh(
      extruded([[0.12, 0.0], [0.06, 0.07], [-0.08, 0.1], [-0.2, 0.04], [-0.06, 0.02]], 0.012, 0.004),
      steel,
      head,
      [0, 0.2, 0.02],
      [0, Math.PI / 2, 0]
    );
    mesh(plate(0.006, 0.006, 0.2, 0.002), trim, head, [0, 0.285, -0.02], [-0.25, 0, 0]);
  }
  let halo: THREE.Object3D | null = null;
  if (tier >= 5) {
    const ringGeo = new THREE.TorusGeometry(0.15, 0.0045, 4, 48);
    track(ringGeo);
    const haloGroup = joint('halo', head, [0, 0.14, -0.15]);
    mesh(ringGeo, trim, haloGroup, [0, 0, 0], [0.25, 0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      mesh(plate(0.008, 0.03, 0.004, 0.001), trim, haloGroup, [Math.cos(a) * 0.17, Math.sin(a) * 0.17 * Math.cos(0.25), Math.sin(a) * 0.17 * Math.sin(0.25)], [0.25, 0, a - Math.PI / 2]);
    }
    halo = haloGroup;
  }

  // ── Arms ──
  const joints = { hips, spine, chest, neck, head } as Partial<Record<JointName, THREE.Group>>;
  for (const side of [1, -1] as const) {
    const S = side === 1 ? 'L' : 'R';
    const shoulder = joint(`shoulder${S}`, chest, [side * 0.275, 0.27, -0.005]);
    // Deltoid ball + pauldron (layered).
    mesh(track(new THREE.SphereGeometry(0.075, 8, 6)), suit, shoulder, [0, -0.01, 0]);
    const pauldron = new THREE.Group();
    pauldron.position.set(side * 0.03, 0.02, 0);
    pauldron.rotation.set(0, 0, side * -0.28);
    pauldron.scale.setScalar(big);
    shoulder.add(pauldron);
    const shell = new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
    track(shell);
    mesh(shell, armor, pauldron, [0, 0, 0], [0, 0, 0], [1.05, 0.95, 1.12]);
    for (let i = 0; i < 2; i++) {
      const lame = new THREE.CylinderGeometry(0.098 - i * 0.008, 0.104 - i * 0.008, 0.035, 8, 1, true);
      track(lame);
      const m = mesh(lame, armor, pauldron, [0, -0.02 - i * 0.034, 0], [0, 0, 0], [1.05, 1, 1.12]);
      m.material = armor;
    }
    const rim = new THREE.TorusGeometry(0.1, 0.0035, 3, 20, Math.PI);
    track(rim);
    mesh(rim, trim, pauldron, [0, -0.086, 0], [Math.PI / 2, 0, 0], [1.08, 1.14, 1]);
    if (tier >= 3) {
      mesh(extruded([[0, 0], [0.05, 0.02], [0.02, 0.09], [-0.03, 0.03]], 0.01, 0.004), steel, pauldron, [side * 0.03, 0.07, -0.02], [0, Math.PI / 2, side * -0.3]);
    }

    // Upper arm.
    mesh(limb(0.062, 0.052, 0.27, 8), suit, shoulder, [0, -0.02, 0]);
    mesh(plate(0.085, 0.17, 0.115, 0.016), armor, shoulder, [side * 0.03, -0.15, 0], [0, 0, side * 0.04]);
    mesh(plate(0.006, 0.12, 0.006, 0.002), trim, shoulder, [side * 0.074, -0.15, 0.0], [0, 0, side * 0.04]);

    const elbow = joint(`elbow${S}`, shoulder, [0, -0.29, 0]);
    mesh(track(new THREE.IcosahedronGeometry(0.056, 0)), steel, elbow, [0, 0, -0.01]);
    mesh(plate(0.07, 0.07, 0.03, 0.01), armor, elbow, [0, 0, -0.045], [0.3, 0, 0]);
    // Vambrace: faceted tapered gauntlet + glow strip + wrist ring.
    mesh(limb(0.074, 0.058, 0.24, 7), armor, elbow, [0, -0.02, 0]);
    mesh(plate(0.035, 0.18, 0.06, 0.012), steel, elbow, [side * 0.06, -0.13, 0.0]);
    mesh(plate(0.006, 0.16, 0.006, 0.002), trim, elbow, [side * 0.079, -0.13, 0.0]);
    mesh(limb(0.064, 0.064, 0.024, 8), steel, elbow, [0, -0.245, 0]);

    const hand = joint(`hand${S}`, elbow, [0, -0.275, 0]);
    // Fist: palm block + knuckle guard + thumb.
    mesh(plate(0.08, 0.095, 0.095, 0.02), suit, hand, [0, -0.045, 0.005]);
    mesh(plate(0.086, 0.034, 0.06, 0.008), armor, hand, [0, -0.072, 0.032]);
    mesh(plate(0.02, 0.05, 0.03, 0.008), armor, hand, [side * -0.035, -0.03, 0.04], [0, 0, side * 0.3]);
    mesh(plate(0.05, 0.004, 0.004, 0.001), trim, hand, [0, -0.052, 0.06]);

    joints[`shoulder${S}` as JointName] = shoulder;
    joints[`elbow${S}` as JointName] = elbow;
    joints[`hand${S}` as JointName] = hand;
  }

  // ── Cape-light ribbons (tier 4+) ──
  if (mats.cape) {
    const capeGeo = new THREE.PlaneGeometry(0.2, 0.95, 1, 16);
    capeGeo.translate(0, -0.475, 0);
    track(capeGeo);
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(capeGeo, mats.cape);
      m.position.set(side * 0.13, 0.3, -0.17);
      m.rotation.set(0.08, side * 0.12, 0);
      m.castShadow = false;
      m.renderOrder = 2;
      chest.add(m);
    }
  }

  // ── Legs ──
  const soles: THREE.Object3D[] = [];
  for (const side of [1, -1] as const) {
    const S = side === 1 ? 'L' : 'R';
    const thigh = joint(`thigh${S}`, hips, [side * 0.1, -0.04, 0]);
    mesh(limb(0.095, 0.07, 0.42, 8), suit, thigh, [0, 0, 0]);
    // Cuisse (front thigh plate) + side plate.
    mesh(plate(0.15, 0.25, 0.065, 0.018), armor, thigh, [side * 0.005, -0.16, 0.066], [-0.04, 0, 0]);
    mesh(plate(0.006, 0.2, 0.006, 0.002), trim, thigh, [side * 0.04, -0.16, 0.102], [-0.04, 0, 0]);
    mesh(plate(0.045, 0.21, 0.11, 0.012), armor, thigh, [side * 0.075, -0.15, 0], [0, 0, side * -0.05]);

    const knee = joint(`knee${S}`, thigh, [0, -0.42, 0]);
    // Poleyn: faceted knee cop with a glow dot.
    mesh(track(new THREE.OctahedronGeometry(0.06, 0)), steel, knee, [0, 0.0, 0.055], [0, Math.PI / 4, 0], [1, 1.1, 0.8]);
    mesh(plate(0.1, 0.05, 0.03, 0.01), armor, knee, [0, 0.03, 0.06], [-0.3, 0, 0]);
    mesh(plate(0.016, 0.016, 0.01, 0.004), trim, knee, [0, 0.0, 0.104]);
    // Greave: tapered faceted shin.
    mesh(limb(0.078, 0.056, 0.38, 7), armor, knee, [0, -0.02, 0]);
    mesh(extruded([[-0.05, 0], [0.05, 0], [0.034, -0.3], [0, -0.33], [-0.034, -0.3]], 0.02, 0.008), steel, knee, [0, -0.05, 0.068], [0.05, 0, 0]);
    mesh(plate(0.006, 0.24, 0.006, 0.002), trim, knee, [0, -0.19, 0.094], [0.05, 0, 0]);

    const ankle = joint(`ankle${S}`, knee, [0, -0.42, 0]);
    // Sabaton: layered foot + toe cap, sole flat at ankle-local y=-0.075.
    mesh(plate(0.115, 0.075, 0.22, 0.02), armor, ankle, [0, -0.038, 0.04]);
    mesh(plate(0.1, 0.05, 0.085, 0.014), steel, ankle, [0, -0.048, 0.14], [0.2, 0, 0]);
    mesh(limb(0.066, 0.075, 0.06, 7), armor, ankle, [0, 0.04, -0.005]);
    mesh(plate(0.08, 0.004, 0.004, 0.001), trim, ankle, [0, -0.024, 0.176]);
    const sole = new THREE.Object3D();
    sole.position.set(0, -0.075, 0.03);
    ankle.add(sole);
    soles.push(sole);

    joints[`thigh${S}` as JointName] = thigh;
    joints[`knee${S}` as JointName] = knee;
    joints[`ankle${S}` as JointName] = ankle;
  }

  const owned = geometries.slice();
  geometries.length = 0;
  return {
    root,
    joints: joints as Record<JointName, THREE.Group>,
    soles: [soles[0], soles[1]],
    socket,
    chestCenter,
    hipsY: HIPS_Y,
    materials: mats,
    halo,
    dispose: () => {
      owned.forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => (m as THREE.Material | null)?.dispose());
    },
  };
}
