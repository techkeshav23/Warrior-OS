// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: procedural warrior (R3F)
// Builds the rig for the current tier, runs the ProceduralAnimator,
// listens to the action store and drives the emissives from the look
// (tier colour, decay flicker, power-up surge, hit flash).
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildWarriorRig, type WarriorRig } from './rig';
import { ProceduralAnimator, type WarriorFx } from './pose';
import { flicker } from './flicker';
import { useWarriorActionStore } from './store';
import type { WarriorBaseAction, WarriorLook } from './types';
import type { ReactorAnchor } from './ArcReactor';

export interface WarriorFigureProps {
  look: WarriorLook;
  baseAction: WarriorBaseAction;
  stageId: string;
  fxRef: RefObject<WarriorFx>;
  /** Filled with the arc-reactor anchor once the figure exists. */
  anchorRef: RefObject<ReactorAnchor | null>;
  /** 0…1 — scales idle motion (reduced motion → small). */
  motion: number;
}

const HIT_RED = new THREE.Color('#ff3040');
const PLASMA = new THREE.Color('#2fd6f5');
const WHITE_HOT = new THREE.Color('#e8fbff');

export function PlaceholderWarrior({ look, baseAction, stageId, fxRef, anchorRef, motion }: WarriorFigureProps) {
  const holder = useRef<THREE.Group>(null);
  const rigRef = useRef<WarriorRig | null>(null);
  const animRef = useRef<ProceduralAnimator | null>(null);
  const baseRef = useRef(baseAction);
  const report = useWarriorActionStore((s) => s.report);
  const { tier, trim } = look;

  // Build / rebuild the rig when the tier (armor set) changes.
  useLayoutEffect(() => {
    const group = holder.current;
    if (!group) return;
    const rig = buildWarriorRig(tier, trim);
    group.add(rig.root);
    rigRef.current = rig;
    const anim = new ProceduralAnimator(rig, baseRef.current);
    anim.onActionChange = (a) => report(stageId, a);
    animRef.current = anim;
    anchorRef.current = { anchor: rig.socket, center: rig.chestCenter };
    report(stageId, anim.current);
    return () => {
      group.remove(rig.root);
      rig.dispose();
      if (rigRef.current === rig) rigRef.current = null;
      if (animRef.current === anim) animRef.current = null;
      anchorRef.current = null;
    };
  }, [tier, trim, stageId, report, anchorRef]);

  useEffect(() => {
    baseRef.current = baseAction;
    animRef.current?.setBase(baseAction);
  }, [baseAction]);

  // Action requests from anywhere (playWarriorAction).
  useEffect(() => {
    let lastSeq = useWarriorActionStore.getState().request?.seq ?? 0;
    return useWarriorActionStore.subscribe((s) => {
      const req = s.request;
      if (!req || req.seq === lastSeq) return;
      lastSeq = req.seq;
      if (req.target && req.target !== stageId) return;
      animRef.current?.play(req.action, performance.now() / 1000);
    });
  }, [stageId]);

  useFrame((state, delta) => {
    const rig = rigRef.current;
    const anim = animRef.current;
    const f = fxRef.current;
    if (!rig || !anim || !f) return;
    const now = performance.now() / 1000;
    const dt = Math.min(delta, 0.25);
    anim.update(now, dt, f, motion);

    // Emissives: tier colour × glow × decay flicker × surge, red on hit.
    const t = state.clock.elapsedTime;
    const fl = flicker(t, look.damage, look.critical, 1);
    const boost = 2.4 * look.glow * fl * (1 + f.surge * 1.6 + f.impact * 0.5);
    const { trim: trimMat, visor, cape } = rig.materials;
    trimMat.color.set(look.trim).multiplyScalar(boost);
    if (f.hit > 0) trimMat.color.lerp(HIT_RED, f.hit * 0.8);
    const visorFl = flicker(t, look.damage, look.critical, 5);
    visor.color
      .copy(look.tier >= 5 ? WHITE_HOT : PLASMA)
      .multiplyScalar((2.2 + f.surge * 3) * visorFl);
    if (f.hit > 0) visor.color.lerp(HIT_RED, f.hit);
    if (cape) {
      cape.uniforms.uTime.value = t;
      cape.uniforms.uIntensity.value = (0.8 + f.surge * 1.2) * fl;
    }
  });

  return <group ref={holder} />;
}
