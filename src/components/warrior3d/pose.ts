// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: procedural poses + animator
// Key poses per action (joint Euler rotations + hips offsets),
// keyframed one-shots, additive "alive" layers (breathing, weight
// shift, boxer bounce, micro head motion) and exponential damping, so
// switching actions always crossfades. Feet are planted on y=0 every
// frame (lowest sole touches the floor) unless a pose lifts off.
// ═══════════════════════════════════════════════════════════

import * as THREE from 'three';
import { JOINTS, type AnimatableRig, type JointName } from './rig';
import { isOneShot, type WarriorAction, type WarriorBaseAction } from './types';

type V3 = [number, number, number];

export interface Pose {
  j: Partial<Record<JointName, V3>>;
  /** How far the hips sink (bent knees), metres. */
  drop?: number;
  /** Hips shift x / z. */
  shift?: [number, number];
  /** Airborne lift after planting (jumps). */
  lift?: number;
  /** Hand grip, 0 open … 1 fist (rigs with finger bones; the placeholder's fists ignore it). */
  grip?: number;
}

interface Key {
  t: number;
  pose: Pose;
}

// ─── Key poses ───

const STANCE: Pose = {
  drop: 0.07,
  grip: 1,
  shift: [0.01, 0],
  j: {
    hips: [0, -0.42, 0],
    spine: [0.14, 0.06, 0],
    chest: [0.06, -0.12, 0.02],
    neck: [-0.08, 0.2, 0],
    head: [-0.1, 0.22, 0],
    shoulderL: [-0.95, 0.1, 0.32],
    elbowL: [-1.75, 0, 0],
    handL: [0.1, 0, 0],
    shoulderR: [-0.55, -0.1, -0.35],
    elbowR: [-2.2, 0, 0],
    handR: [0.2, 0, 0],
    thighL: [-0.42, 0.3, 0.3],
    kneeL: [0.6, 0, 0],
    thighR: [0.3, 0.2, -0.26],
    kneeR: [0.55, 0, 0],
  },
};

const IDLE: Pose = {
  drop: 0.02,
  grip: 0.35,
  j: {
    hips: [0, -0.18, 0],
    spine: [0.03, 0.03, 0],
    chest: [-0.02, -0.02, 0],
    neck: [0, 0.1, 0],
    head: [0.02, 0.06, 0],
    shoulderL: [-0.18, 0, 0.2],
    elbowL: [-0.75, 0, 0],
    handL: [0, 0.3, 0],
    shoulderR: [-0.1, 0, -0.22],
    elbowR: [-0.6, 0, 0],
    handR: [0, -0.3, 0],
    thighL: [-0.12, 0.15, 0.1],
    kneeL: [0.14, 0, 0],
    thighR: [0.1, 0.05, -0.11],
    kneeR: [0.1, 0, 0],
  },
};

function over(base: Pose, patch: Partial<Pose>): Pose {
  return {
    drop: patch.drop ?? base.drop,
    shift: patch.shift ?? base.shift,
    lift: patch.lift ?? 0,
    grip: patch.grip ?? base.grip,
    j: { ...base.j, ...(patch.j ?? {}) },
  };
}

const PUNCH_WIND = over(STANCE, {
  drop: 0.09,
  j: {
    hips: [0, -0.55, 0],
    chest: [0.08, -0.22, 0],
    shoulderR: [-0.35, -0.2, -0.45],
    elbowR: [-2.4, 0, 0],
    head: [-0.1, 0.3, 0],
  },
});

const PUNCH_HIT = over(STANCE, {
  drop: 0.1,
  shift: [0, 0.07],
  j: {
    hips: [0, 0.1, 0],
    spine: [0.2, 0.2, 0],
    chest: [0.06, 0.3, -0.05],
    neck: [-0.1, -0.2, 0],
    head: [-0.12, -0.25, 0],
    shoulderR: [-1.52, 0.15, -0.12],
    elbowR: [-0.06, 0, 0],
    handR: [0, -1.4, 0],
    shoulderL: [-0.7, 0.2, 0.42],
    elbowL: [-2.3, 0, 0],
    thighL: [-0.62, 0.1, 0.12],
    kneeL: [0.62, 0, 0],
    thighR: [0.45, -0.2, -0.1],
    kneeR: [0.3, 0, 0],
  },
});

const POWER_GATHER: Pose = over(STANCE, {
  drop: 0.2,
  grip: 1,
  shift: [0, 0],
  j: {
    hips: [0, 0, 0],
    spine: [0.4, 0, 0],
    chest: [0.18, 0, 0],
    neck: [0.1, 0, 0],
    head: [0.28, 0, 0],
    shoulderL: [-0.55, 0, -0.35],
    elbowL: [-1.0, 0, 0],
    handL: [0, 0, 0],
    shoulderR: [-0.55, 0, 0.35],
    elbowR: [-1.0, 0, 0],
    handR: [0, 0, 0],
    thighL: [-0.55, 0.2, 0.3],
    kneeL: [1.0, 0, 0],
    thighR: [-0.55, -0.2, -0.3],
    kneeR: [1.0, 0, 0],
  },
});

const POWER_BURST: Pose = over(STANCE, {
  drop: 0.06,
  grip: 0,
  shift: [0, 0],
  j: {
    hips: [0, 0, 0],
    spine: [-0.18, 0, 0],
    chest: [-0.2, 0, 0],
    neck: [-0.15, 0, 0],
    head: [-0.35, 0, 0],
    shoulderL: [0.3, 0, 0.8],
    elbowL: [-0.45, 0, 0],
    handL: [0, 0, 0],
    shoulderR: [0.3, 0, -0.8],
    elbowR: [-0.45, 0, 0],
    handR: [0, 0, 0],
    thighL: [-0.05, 0.25, 0.32],
    kneeL: [0.35, 0, 0],
    thighR: [-0.05, -0.25, -0.32],
    kneeR: [0.35, 0, 0],
  },
});

const VICTORY_UP: Pose = over(IDLE, {
  drop: 0.0,
  grip: 1,
  j: {
    hips: [0, -0.1, 0],
    spine: [-0.08, 0, 0],
    chest: [-0.12, 0.05, 0.05],
    neck: [-0.1, 0.05, 0],
    head: [-0.28, 0.1, 0],
    shoulderR: [0.05, 0, -2.75],
    elbowR: [-0.3, 0, 0],
    handR: [0, 0.4, 0],
    shoulderL: [0.05, 0, 0.45],
    elbowL: [-1.5, 0, 0],
    handL: [0, 0, 0],
    thighL: [-0.1, 0.2, 0.18],
    kneeL: [0.1, 0, 0],
    thighR: [0.05, -0.1, -0.16],
    kneeR: [0.08, 0, 0],
  },
});

const VICTORY_CROUCH = over(VICTORY_UP, {
  drop: 0.16,
  j: { thighL: [-0.6, 0.2, 0.2], kneeL: [1.0, 0, 0], thighR: [-0.5, -0.1, -0.18], kneeR: [0.95, 0, 0], shoulderR: [-0.4, 0, -0.9], elbowR: [-1.8, 0, 0], spine: [0.3, 0, 0], head: [0.1, 0, 0] },
});

const HURT_HIT = over(STANCE, {
  drop: 0.12,
  grip: 0.2,
  shift: [0, -0.1],
  j: {
    hips: [0, -0.3, 0.05],
    spine: [-0.35, 0.1, 0],
    chest: [-0.22, -0.2, 0.1],
    neck: [-0.2, 0.3, 0],
    head: [-0.4, 0.3, 0.1],
    shoulderL: [-0.25, 0, 0.75],
    elbowL: [-0.6, 0, 0],
    shoulderR: [-0.1, 0, -0.7],
    elbowR: [-0.8, 0, 0],
    thighL: [-0.25, 0.25, 0.14],
    kneeL: [0.7, 0, 0],
  },
});

/** One-shot timelines. The last key returns to the base pose (filled at runtime). */
const TIMELINES: Record<Exclude<WarriorAction, WarriorBaseAction>, { duration: number; keys: Key[] }> = {
  punch: {
    duration: 0.95,
    keys: [
      { t: 0.14, pose: PUNCH_WIND },
      { t: 0.27, pose: PUNCH_HIT },
      { t: 0.45, pose: PUNCH_HIT },
    ],
  },
  powerup: {
    duration: 2.6,
    keys: [
      { t: 0.4, pose: POWER_GATHER },
      { t: 1.15, pose: POWER_GATHER },
      { t: 1.35, pose: POWER_BURST },
      { t: 2.1, pose: POWER_BURST },
    ],
  },
  victory: {
    duration: 2.9,
    keys: [
      { t: 0.25, pose: VICTORY_CROUCH },
      { t: 0.5, pose: { ...VICTORY_UP, lift: 0.14 } },
      { t: 0.72, pose: VICTORY_UP },
      { t: 2.4, pose: VICTORY_UP },
    ],
  },
  hurt: {
    duration: 0.8,
    keys: [
      { t: 0.07, pose: HURT_HIT },
      { t: 0.3, pose: over(HURT_HIT, { drop: 0.1, shift: [0, -0.06] }) },
    ],
  },
};

/** Seconds each one-shot lasts (procedural). */
export const ACTION_DURATION: Record<WarriorAction, number> = {
  idle: 0,
  stance: 0,
  punch: TIMELINES.punch.duration,
  powerup: TIMELINES.powerup.duration,
  victory: TIMELINES.victory.duration,
  hurt: TIMELINES.hurt.duration,
};

// ─── Sampling ───

const smooth = (x: number) => x * x * (3 - 2 * x);

function blendPose(a: Pose, b: Pose, k: number, out: Pose): Pose {
  out.drop = (a.drop ?? 0) + ((b.drop ?? 0) - (a.drop ?? 0)) * k;
  const as = a.shift ?? [0, 0];
  const bs = b.shift ?? [0, 0];
  out.shift = [as[0] + (bs[0] - as[0]) * k, as[1] + (bs[1] - as[1]) * k];
  out.lift = (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * k;
  out.grip = (a.grip ?? 0) + ((b.grip ?? 0) - (a.grip ?? 0)) * k;
  for (const name of JOINTS) {
    const va = a.j[name] ?? ZERO;
    const vb = b.j[name] ?? ZERO;
    out.j[name] = [va[0] + (vb[0] - va[0]) * k, va[1] + (vb[1] - va[1]) * k, va[2] + (vb[2] - va[2]) * k];
  }
  return out;
}

const ZERO: V3 = [0, 0, 0];

function sampleTimeline(action: Exclude<WarriorAction, WarriorBaseAction>, t: number, base: Pose, out: Pose): Pose {
  const { duration, keys } = TIMELINES[action];
  const all: Key[] = [{ t: 0, pose: base }, ...keys, { t: duration, pose: base }];
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i];
    const b = all[i + 1];
    if (t <= b.t) {
      const k = b.t > a.t ? smooth(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))) : 1;
      return blendPose(a.pose, b.pose, k, out);
    }
  }
  return blendPose(base, base, 0, out);
}

// ─── FX signals the rest of the scene reacts to ───

export interface WarriorFx {
  /** 0…1 — power-up surge (emissive boost, aura, bloom). */
  surge: number;
  /** 0…1 — got hit (red flash / glitch). */
  hit: number;
  /** Timestamp (s, clock time) of the last shockwave; -1 = none. */
  shockAt: number;
  /** Punch impact flash 0…1. */
  impact: number;
  /** 0…1 — voice drive of the arc reactor (set by ArcReactor). */
  voice: number;
}

export function createFx(): WarriorFx {
  return { surge: 0, hit: 0, shockAt: -1, impact: 0, voice: 0 };
}

/** Timeline-driven FX envelopes for an action at local time t. */
export function actionFx(action: WarriorAction, t: number): { surge: number; hit: number; impact: number; shock: boolean } {
  switch (action) {
    case 'powerup': {
      const gather = t > 0.3 && t < 1.35 ? smooth(Math.min(1, (t - 0.3) / 0.9)) * 0.45 : 0;
      const burst = t >= 1.35 ? Math.max(0, 1 - Math.max(0, t - 1.9) / 0.7) : 0;
      return { surge: Math.max(gather, burst), hit: 0, impact: 0, shock: t >= 1.35 };
    }
    case 'punch':
      return { surge: 0, hit: 0, impact: t > 0.24 && t < 0.5 ? 1 - Math.abs(t - 0.3) / 0.2 : 0, shock: false };
    case 'hurt':
      return { surge: 0, hit: Math.max(0, 1 - t / 0.55), impact: 0, shock: false };
    case 'victory':
      return { surge: t > 0.5 ? Math.max(0, 0.6 - Math.max(0, t - 1.8) * 0.6) : 0, hit: 0, impact: 0, shock: t >= 0.72 };
    default:
      return { surge: 0, hit: 0, impact: 0, shock: false };
  }
}

// ─── Animator ───

export class ProceduralAnimator {
  private rig: AnimatableRig;
  private action: WarriorAction;
  private base: WarriorBaseAction;
  private started = 0;
  private shockFired = false;
  private target: Pose = { j: {} };
  private tmpV = new THREE.Vector3();
  private dropNow = 0;
  private shiftNow: [number, number] = [0, 0];
  private liftNow = 0;
  private gripNow = 0;
  onActionChange: ((action: WarriorAction) => void) | null = null;

  constructor(rig: AnimatableRig, base: WarriorBaseAction) {
    this.rig = rig;
    this.base = base;
    this.action = base;
    // Start in pose.
    const pose = base === 'stance' ? STANCE : IDLE;
    for (const name of JOINTS) {
      const r = pose.j[name];
      if (r) rig.joints[name].rotation.set(r[0], r[1], r[2]);
    }
    this.dropNow = pose.drop ?? 0;
    this.gripNow = pose.grip ?? 0;
  }

  /** Current (damped) hand grip, 0 open … 1 fist. */
  get grip(): number {
    return this.gripNow;
  }

  get current(): WarriorAction {
    return this.action;
  }

  setBase(base: WarriorBaseAction): void {
    this.base = base;
    if (!isOneShot(this.action)) this.setAction(base);
  }

  play(action: WarriorAction, now: number): void {
    if (action === 'idle' || action === 'stance') {
      this.base = action;
      this.setAction(action);
      return;
    }
    this.started = now;
    this.shockFired = false;
    this.setAction(action);
  }

  private setAction(action: WarriorAction) {
    if (this.action === action && !isOneShot(action)) return;
    this.action = action;
    this.onActionChange?.(action);
  }

  /** Advance one frame. `motion` 0…1 scales the alive layers (reduced motion). */
  update(now: number, dt: number, fx: WarriorFx, motion = 1): void {
    const basePose = this.base === 'stance' ? STANCE : IDLE;
    let pose = basePose;
    let local = 0;
    if (isOneShot(this.action)) {
      local = now - this.started;
      const a = this.action as Exclude<WarriorAction, WarriorBaseAction>;
      if (local >= TIMELINES[a].duration) {
        this.setAction(this.base);
      } else {
        pose = sampleTimeline(a, local, basePose, this.target);
      }
    }

    // FX envelopes.
    const env = actionFx(this.action, local);
    fx.surge += (env.surge - fx.surge) * Math.min(1, dt * 8);
    fx.hit = Math.max(env.hit, fx.hit - dt * 3);
    fx.impact = Math.max(env.impact, fx.impact - dt * 4);
    if (env.shock && !this.shockFired) {
      this.shockFired = true;
      fx.shockAt = now;
    }

    // Damping: one-shots snap faster than idle transitions.
    const rate = isOneShot(this.action) ? 16 : 5;
    const k = 1 - Math.exp(-rate * dt);

    const t = now;
    const m = motion;
    const inStance = this.base === 'stance' && !isOneShot(this.action);
    const breathe = Math.sin(t * 1.7) * m;
    const sway = Math.sin(t * 0.63) * m;
    const bounce = inStance ? Math.abs(Math.sin(t * 3.1)) * m : 0;
    const shake = this.action === 'powerup' && local > 0.4 && local < 1.35 ? m : 0;

    const joints = this.rig.joints;
    for (const name of JOINTS) {
      const r = pose.j[name];
      if (!r) continue;
      let x = r[0];
      let y = r[1];
      let z = r[2];
      // Additive alive layers.
      switch (name) {
        case 'chest':
          x += breathe * 0.025;
          break;
        case 'spine':
          x += breathe * 0.01;
          z += sway * 0.02;
          break;
        case 'hips':
          y += sway * 0.04;
          z += sway * 0.015;
          break;
        case 'head':
          x += Math.sin(t * 0.9 + 1.3) * 0.03 * m;
          y += Math.sin(t * 0.43) * 0.06 * m;
          break;
        case 'shoulderL':
        case 'shoulderR':
          x -= breathe * 0.02 + (inStance ? Math.sin(t * 3.1 + (name === 'shoulderL' ? 0 : 1.2)) * 0.035 * m : 0);
          break;
        case 'elbowL':
        case 'elbowR':
          x += inStance ? Math.sin(t * 2.4 + (name === 'elbowL' ? 0.5 : 2)) * 0.05 * m : 0;
          break;
      }
      if (shake) {
        x += (Math.random() - 0.5) * 0.025;
        z += (Math.random() - 0.5) * 0.025;
      }
      const rot = joints[name].rotation;
      rot.x += (x - rot.x) * k;
      rot.y += (y - rot.y) * k;
      rot.z += (z - rot.z) * k;
    }

    // Ankles: keep soles roughly flat — cancel the leg chain's pitch/roll.
    for (const S of ['L', 'R'] as const) {
      const th = joints[`thigh${S}`].rotation;
      const kn = joints[`knee${S}`].rotation;
      const an = joints[`ankle${S}`].rotation;
      const hipPitch = joints.hips.rotation.x;
      an.x = -(th.x + kn.x + hipPitch);
      an.z = -th.z * 0.9;
      an.y = 0;
    }

    // Hips offsets (damped) + bounce.
    this.dropNow += ((pose.drop ?? 0) + bounce * 0.018 + breathe * 0.004 - this.dropNow) * k;
    const sh = pose.shift ?? [0, 0];
    this.shiftNow[0] += (sh[0] + sway * 0.02 - this.shiftNow[0]) * k;
    this.shiftNow[1] += (sh[1] - this.shiftNow[1]) * k;
    this.liftNow += ((pose.lift ?? 0) - this.liftNow) * Math.min(1, k * 1.4);
    this.gripNow += ((pose.grip ?? 0) - this.gripNow) * k;

    const hips = joints.hips;
    hips.position.set(this.shiftNow[0], this.rig.hipsY - this.dropNow, this.shiftNow[1]);

    // Plant: lowest sole on y = 0 (in rig-root space), then lift.
    const root = this.rig.root;
    root.updateMatrixWorld(true);
    let minY = Infinity;
    for (const sole of this.rig.soles) {
      sole.getWorldPosition(this.tmpV);
      root.worldToLocal(this.tmpV);
      minY = Math.min(minY, this.tmpV.y);
    }
    if (Number.isFinite(minY)) hips.position.y -= minY - 0.002;
    hips.position.y += this.liftNow;

    if (this.rig.halo) this.rig.halo.rotation.z += dt * 0.4 * (1 + fx.surge * 4);
  }
}
