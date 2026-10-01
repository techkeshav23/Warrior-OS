// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: procedural poses → auto-rig bones
// The ProceduralAnimator (pose.ts) drives a bone-less "virtual" copy of
// the placeholder's joint hierarchy, built with the auto-rig's own
// proportions (so foot planting lands the real soles). Every frame each
// joint's rotation (relative to the rig root) is mapped onto the auto
// rig: placeholder poses are authored from an arms-down / legs-down
// rest, so limb bones carry a rest correction that takes the model's
// T / A-pose limb direction down to that rest first — the arms come
// down into a natural idle / guard. Crossfades come from the
// animator's damping; the hips carry drop / shift / planting.
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';
import { ProceduralAnimator, type WarriorFx } from './pose';
import type { AnimatableRig, JointName } from './rig';
import { AUTO_BONES, autoBoneParent, type AutoBoneName, type AutoRigInfo } from './autorig';
import type { WarriorBaseAction } from './types';

/** Arms rest this far (radians) out from the body so they clear the torso armor. */
const ARM_REST_ABDUCTION = 0.1;
/** Hand roll from the poses is damped (a rigid gauntlet can't twist far without shearing the wrist). */
const HAND_TWIST = 0.55;
/** Finger curl (radians) at full grip — the fingers fold toward the palm. */
const GRIP_CURL = 1.55;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** Share of the arm's swing (relative to the chest) the clavicle — and the pauldron on it — takes. */
const CLAVICLE_FOLLOW = 0.4;

/** Auto bone → placeholder joint whose world rotation it takes. */
const SOURCE: Partial<Record<AutoBoneName, JointName>> = {
  Hips: 'hips',
  Spine: 'spine',
  Spine2: 'chest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'chest',
  LeftArm: 'shoulderL',
  LeftForeArm: 'elbowL',
  LeftHand: 'handL',
  RightShoulder: 'chest',
  RightArm: 'shoulderR',
  RightForeArm: 'elbowR',
  RightHand: 'handR',
  LeftUpLeg: 'thighL',
  LeftLeg: 'kneeL',
  LeftFoot: 'ankleL',
  RightUpLeg: 'thighR',
  RightLeg: 'kneeR',
  RightFoot: 'ankleR',
};

const DOWN = new THREE.Vector3(0, -1, 0);

function buildVirtualRig(info: AutoRigInfo): AnimatableRig {
  const r = info.rest;
  const root = new THREE.Group();
  const add = (name: JointName, parent: THREE.Object3D, pos: THREE.Vector3) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.copy(pos);
    parent.add(g);
    return g;
  };
  const rel = (a: AutoBoneName, b: AutoBoneName) => r[a].clone().sub(r[b]);
  const down = (a: AutoBoneName, b: AutoBoneName) => new THREE.Vector3(0, -r[a].distanceTo(r[b]), 0);
  const hips = add('hips', root, r.Hips.clone());
  const spine = add('spine', hips, rel('Spine', 'Hips'));
  const chest = add('chest', spine, rel('Spine2', 'Spine'));
  const neck = add('neck', chest, rel('Neck', 'Spine2'));
  const head = add('head', neck, rel('Head', 'Neck'));
  const joints = { hips, spine, chest, neck, head } as Partial<Record<JointName, THREE.Group>>;
  const soles: THREE.Object3D[] = [];
  for (const [S, P] of [['L', 'Left'], ['R', 'Right']] as const) {
    const shoulder = add(`shoulder${S}`, chest, rel(`${P}Arm`, 'Spine2'));
    const elbow = add(`elbow${S}`, shoulder, down(`${P}ForeArm`, `${P}Arm`));
    const hand = add(`hand${S}`, elbow, down(`${P}Hand`, `${P}ForeArm`));
    const thigh = add(`thigh${S}`, hips, rel(`${P}UpLeg`, 'Hips'));
    const knee = add(`knee${S}`, thigh, down(`${P}Leg`, `${P}UpLeg`));
    const ankle = add(`ankle${S}`, knee, down(`${P}Foot`, `${P}Leg`));
    const sole = new THREE.Object3D();
    const foot = r[`${P}Foot`];
    sole.position.set(0, -foot.y, (r[`${P}ToeBase`].z - foot.z) * 0.3);
    ankle.add(sole);
    soles.push(sole);
    Object.assign(joints, { [`shoulder${S}`]: shoulder, [`elbow${S}`]: elbow, [`hand${S}`]: hand, [`thigh${S}`]: thigh, [`knee${S}`]: knee, [`ankle${S}`]: ankle });
  }
  return { root, joints: joints as Record<JointName, THREE.Group>, soles: [soles[0], soles[1]], hipsY: r.Hips.y, halo: null };
}

export class AutoRigDriver {
  readonly animator: ProceduralAnimator;
  private readonly virtual: AnimatableRig;
  private readonly bones = new Map<AutoBoneName, THREE.Bone>();
  /** Inverse rest corrections (model limb direction → placeholder rest). */
  private readonly fix = new Map<AutoBoneName, THREE.Quaternion>();
  private readonly world = new Map<AutoBoneName, THREE.Quaternion>();
  private readonly hipsRest: THREE.Vector3;
  private readonly q = new THREE.Quaternion();
  private readonly q2 = new THREE.Quaternion();
  private readonly ident = new THREE.Quaternion();
  private readonly curl = new THREE.Quaternion();

  constructor(model: THREE.Object3D, info: AutoRigInfo, base: WarriorBaseAction) {
    for (const name of AUTO_BONES) {
      const bone = model.getObjectByName(info.boneNames[name]) as THREE.Bone | undefined;
      if (bone) this.bones.set(name, bone);
      this.world.set(name, new THREE.Quaternion());
    }
    const r = info.rest;
    this.hipsRest = r.Hips.clone();
    const correct = (name: AutoBoneName, from: THREE.Vector3, to: THREE.Vector3) => {
      const dir = to.clone().sub(from).normalize();
      this.fix.set(name, new THREE.Quaternion().setFromUnitVectors(DOWN, dir).invert());
    };
    for (const [P, s] of [['Left', 1], ['Right', -1]] as const) {
      // One axis for the whole arm (landmarks sit on the fitted arm line).
      const u = r[`${P}Hand`].clone().sub(r[`${P}Arm`]).normalize();
      const rest = new THREE.Vector3(s * Math.sin(ARM_REST_ABDUCTION), -Math.cos(ARM_REST_ABDUCTION), 0);
      const fix = new THREE.Quaternion().setFromUnitVectors(rest, u).invert();
      for (const b of [`${P}Arm`, `${P}ForeArm`, `${P}Hand`] as const) this.fix.set(b, fix.clone());
      correct(`${P}UpLeg`, r[`${P}UpLeg`], r[`${P}Leg`]);
      correct(`${P}Leg`, r[`${P}Leg`], r[`${P}Foot`]);
    }
    this.virtual = buildVirtualRig(info);
    this.animator = new ProceduralAnimator(this.virtual, base);
    this.apply();
  }

  /** Advance the animator and pose the bones. */
  update(now: number, dt: number, fx: WarriorFx, motion: number): void {
    this.animator.update(now, dt, fx, motion);
    this.apply();
  }

  private apply(): void {
    const { root, joints } = this.virtual;
    root.updateMatrixWorld(true);
    const q = this.q;
    for (const name of AUTO_BONES) {
      const out = this.world.get(name) as THREE.Quaternion;
      const src = SOURCE[name];
      if (name === 'Spine1') {
        // Halfway between spine and chest.
        this.q2.copy(this.ident).slerp(joints.chest.quaternion, 0.5);
        joints.spine.getWorldQuaternion(out).multiply(this.q2);
      } else if (src) {
        joints[src].getWorldQuaternion(out);
        if (name === 'LeftHand' || name === 'RightHand') {
          // Damp the roll about the forearm axis.
          joints[src === 'handL' ? 'elbowL' : 'elbowR'].getWorldQuaternion(q);
          out.copy(q.slerp(out, HAND_TWIST));
        }
      } else if (name === 'LeftHandMiddle1' || name === 'RightHandMiddle1') {
        // Palms face down in a T / A pose → medially once the arm hangs; curl toward them.
        const P = name === 'LeftHandMiddle1' ? 'Left' : 'Right';
        const fix = this.fix.get(`${P}Hand`) as THREE.Quaternion;
        this.curl.setFromAxisAngle(Z_AXIS, (P === 'Left' ? -1 : 1) * GRIP_CURL * this.animator.grip);
        out
          .copy(this.world.get(`${P}Hand`) as THREE.Quaternion)
          .multiply(q.copy(fix).invert())
          .multiply(this.curl)
          .multiply(fix);
        continue;
      } else {
        const parent = autoBoneParent(name);
        out.copy(parent ? (this.world.get(parent) as THREE.Quaternion) : this.ident);
        continue;
      }
      const fix = this.fix.get(name);
      if (fix) out.multiply(fix);
    }
    // Clavicles take part of their arm's swing so the shoulder plate settles with it.
    const chest = this.world.get('Spine2') as THREE.Quaternion;
    for (const P of ['Left', 'Right'] as const) {
      const clav = this.world.get(`${P}Shoulder`) as THREE.Quaternion;
      q.copy(chest).invert().multiply(this.world.get(`${P}Arm`) as THREE.Quaternion);
      this.q2.copy(this.ident).slerp(q, CLAVICLE_FOLLOW);
      clav.copy(chest).multiply(this.q2);
    }
    for (const name of AUTO_BONES) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      const parent = autoBoneParent(name);
      const w = this.world.get(name) as THREE.Quaternion;
      if (parent) bone.quaternion.copy(q.copy(this.world.get(parent) as THREE.Quaternion).invert().multiply(w));
      else bone.quaternion.copy(w);
    }
    const hips = this.bones.get('Hips');
    const vh = joints.hips.position;
    if (hips) hips.position.set(this.hipsRest.x + vh.x, vh.y, this.hipsRest.z + vh.z);
  }
}
