// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: GLB warrior (R3F)
// Clones the normalised GLB per instance (SkeletonUtils), plays its
// clips through an AnimationMixer with crossfades, returns one-shots to
// the base loop, and fills gaps procedurally: a missing clip becomes a
// whole-body move (lunge / recoil / rise / hop-spin) on a wrapper
// group, and a model without an idle clip still breathes. Emissive
// materials take the tier colour + decay flicker; seams found in the
// colour map (model.ts) stay ember. A small glowing "W" emblem rides the
// chest bone just above the arc reactor.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { actionFx } from './pose';
import { flicker, glitchJolt } from './flicker';
import { useWarriorActionStore } from './store';
import { isOneShot, type WarriorAction, type WarriorBaseAction } from './types';
import { GLB_SEAM_EMBER, useWarriorModelStore, type WarriorModelAsset } from './model';
import type { WarriorFigureProps } from './PlaceholderWarrior';

const FADE = 0.28;
/** Glowing "W" on the chest plate (GLB only). Flip off if it fights the model's own detail. */
const GLB_CHEST_EMBLEM = true;
/** Emblem plate size (model units; the warrior is ~1.8 tall). */
const EMBLEM_W = 0.092;
const EMBLEM_H = 0.068;
/** Seam glow relative to the tier glow — subtle. */
const SEAM_GLOW = 0.6;
const EMBER = new THREE.Color(GLB_SEAM_EMBER);
const HIT_RED = new THREE.Color('#ff3040');
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** White, soft-edged angular "W" on transparent (tinted by the material). */
function emblemTexture(): THREE.CanvasTexture {
  const w = 160;
  const h = 120;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const glyph = () => {
      ctx.beginPath();
      ctx.moveTo(22, 26);
      ctx.lineTo(50, 96);
      ctx.lineTo(80, 48);
      ctx.lineTo(110, 96);
      ctx.lineTo(138, 26);
    };
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 14;
    glyph();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 8;
    glyph();
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface ChestEmblem {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  anchor: THREE.Object3D;
  /** Chest-bone origin: the emblem faces away from it. */
  center: THREE.Object3D;
}
/** Procedural one-shot lengths when the GLB lacks the clip. */
const FALLBACK_DURATION: Record<WarriorAction, number> = {
  idle: 0,
  stance: 0,
  punch: 0.7,
  powerup: 2.2,
  victory: 1.6,
  hurt: 0.6,
};

interface GlbRuntime {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<WarriorAction, THREE.AnimationAction>>;
  emissive: THREE.MeshStandardMaterial[];
  current: THREE.AnimationAction | null;
  action: WarriorAction;
  base: WarriorBaseAction;
  started: number;
  /** One-shot running procedurally (no clip). */
  procedural: boolean;
  shockFired: boolean;
  materials: THREE.Material[];
  emblem: ChestEmblem | null;
}

function baseClip(rt: GlbRuntime, base: WarriorBaseAction): THREE.AnimationAction | null {
  return rt.actions[base] ?? rt.actions[base === 'stance' ? 'idle' : 'stance'] ?? null;
}

export function GlbWarrior({ asset, look, baseAction, stageId, fxRef, anchorRef, motion }: WarriorFigureProps & { asset: WarriorModelAsset }) {
  const wrapper = useRef<THREE.Group>(null);
  const rtRef = useRef<GlbRuntime | null>(null);
  const baseRef = useRef(baseAction);
  const report = useWarriorActionStore((s) => s.report);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const group = wrapper.current;
    if (!group) return;
    const model = cloneSkinned(asset.scene);
    // Per-instance materials so tier tints never leak between stages.
    const materials: THREE.Material[] = [];
    const emissive: THREE.MeshStandardMaterial[] = [];
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const swap = (m: THREE.Material) => {
        const c = m.clone();
        materials.push(c);
        const std = c as THREE.MeshStandardMaterial;
        if (std.isMeshStandardMaterial && (std.emissiveMap || std.emissive.getHex() !== 0)) emissive.push(std);
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
    group.add(model);

    const mixer = new THREE.AnimationMixer(model);
    const actions: GlbRuntime['actions'] = {};
    syncActions(mixer, actions, asset);
    const rt: GlbRuntime = {
      model,
      mixer,
      actions,
      emissive,
      current: null,
      action: baseRef.current,
      base: baseRef.current,
      started: 0,
      procedural: false,
      shockFired: false,
      materials,
      emblem: null,
    };
    const start = baseClip(rt, rt.base);
    if (start) {
      start.play();
      rt.current = start;
    }
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action !== rt.current || !isOneShot(rt.action)) return;
      returnToBase(rt);
    };
    mixer.addEventListener('finished', onFinished as never);
    rtRef.current = rt;

    // Arc-reactor anchor: chest bone (+ local offset) or a static point.
    const reactorAnchor = new THREE.Object3D();
    const center = new THREE.Object3D();
    let bone: THREE.Object3D | undefined;
    if (asset.chestBone) bone = model.getObjectByName(asset.chestBone);
    if (bone && asset.chestLocal) {
      reactorAnchor.position.copy(asset.chestLocal);
      bone.add(reactorAnchor);
      bone.add(center);
    } else {
      reactorAnchor.position.copy(asset.chestPoint);
      center.position.set(asset.chestPoint.x, asset.chestPoint.y, 0);
      model.add(reactorAnchor, center);
    }
    anchorRef.current = { anchor: reactorAnchor, center };

    // Chest emblem: follows its own anchor on the chest bone (see useFrame).
    if (GLB_CHEST_EMBLEM && bone && asset.emblemLocal) {
      const anchor = new THREE.Object3D();
      anchor.position.copy(asset.emblemLocal);
      bone.add(anchor);
      const mat = new THREE.MeshBasicMaterial({
        map: emblemTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(EMBLEM_W, EMBLEM_H), mat);
      mesh.name = 'WarriorChestEmblem';
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      group.add(mesh);
      rt.emblem = { mesh, anchor, center };
    }
    report(stageId, rt.action);

    return () => {
      mixer.removeEventListener('finished', onFinished as never);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      group.remove(model);
      materials.forEach((m) => m.dispose());
      reactorAnchor.removeFromParent();
      center.removeFromParent();
      if (rt.emblem) {
        const { mesh, anchor } = rt.emblem;
        mesh.removeFromParent();
        anchor.removeFromParent();
        mesh.geometry.dispose();
        mesh.material.map?.dispose();
        mesh.material.dispose();
        rt.emblem = null;
      }
      anchorRef.current = null;
      if (rtRef.current === rt) rtRef.current = null;
    };
    function returnToBase(r: GlbRuntime) {
      const next = baseClip(r, r.base);
      if (next && r.current !== next) {
        next.reset().play();
        if (r.current) r.current.crossFadeTo(next, FADE, false);
        r.current = next;
      }
      r.action = r.base;
      r.procedural = false;
      report(stageId, r.action);
    }
  }, [asset, stageId, report, anchorRef]);

  // Clips from separate animation files arrive after the model: add them
  // to the running mixer and move onto a better base loop if one came in.
  const clipsVersion = useWarriorModelStore((s) => s.clipsVersion);
  useEffect(() => {
    const rt = rtRef.current;
    if (!rt || clipsVersion === 0) return;
    if (!syncActions(rt.mixer, rt.actions, asset)) return;
    if (!isOneShot(rt.action)) {
      const next = baseClip(rt, rt.base);
      if (next && next !== rt.current) play(rt, rt.base, performance.now() / 1000);
    }
  }, [asset, clipsVersion]);

  useEffect(() => {
    baseRef.current = baseAction;
    const rt = rtRef.current;
    if (!rt) return;
    rt.base = baseAction;
    if (!isOneShot(rt.action)) play(rt, baseAction, performance.now() / 1000);
    // play() is a stable module-level helper (below).
  }, [baseAction]);

  useEffect(() => {
    let lastSeq = useWarriorActionStore.getState().request?.seq ?? 0;
    return useWarriorActionStore.subscribe((s) => {
      const req = s.request;
      if (!req || req.seq === lastSeq) return;
      lastSeq = req.seq;
      if (req.target && req.target !== stageId) return;
      const rt = rtRef.current;
      if (!rt) return;
      play(rt, req.action, performance.now() / 1000);
      report(stageId, rt.action);
    });
  }, [stageId, report]);

  useFrame((state, delta) => {
    const rt = rtRef.current;
    const f = fxRef.current;
    const group = wrapper.current;
    if (!rt || !f || !group) return;
    const dt = Math.min(delta, 0.25);
    const now = performance.now() / 1000;
    rt.mixer.update(dt);

    const local = now - rt.started;
    const oneShot = isOneShot(rt.action);
    // Procedural one-shots end on a timer.
    if (oneShot && rt.procedural && local >= FALLBACK_DURATION[rt.action]) {
      rt.action = rt.base;
      rt.procedural = false;
      report(stageId, rt.action);
    }

    // FX envelopes (same shape as the procedural warrior).
    const env = actionFx(rt.action, oneShot ? local : 0);
    f.surge += (env.surge - f.surge) * Math.min(1, dt * 8);
    f.hit = Math.max(env.hit, f.hit - dt * 3);
    f.impact = Math.max(env.impact, f.impact - dt * 4);
    if (env.shock && !rt.shockFired) {
      rt.shockFired = true;
      f.shockAt = now;
    }

    // Wrapper motion: procedural one-shots + breathing when no loop clip.
    const t = state.clock.elapsedTime;
    const p = rt.procedural ? Math.min(1, local / Math.max(0.01, FALLBACK_DURATION[rt.action])) : 0;
    const bell = Math.sin(p * Math.PI);
    const px = 0;
    let py = 0;
    let pz = 0;
    let ry = 0;
    let rx = 0;
    let s = 1;
    if (rt.procedural) {
      switch (rt.action) {
        case 'punch':
          pz = bell * 0.12;
          ry = -bell * 0.25;
          rx = bell * 0.08;
          break;
        case 'hurt':
          pz = -bell * 0.1;
          rx = -bell * 0.15;
          break;
        case 'powerup':
          py = bell * 0.05;
          s = 1 + bell * 0.03 + (p < 0.5 ? (Math.random() - 0.5) * 0.006 : 0);
          break;
        case 'victory':
          py = Math.max(0, Math.sin(Math.min(1, p * 2.2) * Math.PI)) * 0.18;
          ry = p * Math.PI * 2;
          break;
      }
    }
    const breathing = !baseClip(rt, rt.base) ? Math.sin(t * 1.7) * 0.008 * motion : 0;
    const jolt = glitchJolt(t, look.damage, look.critical);
    group.position.set(px + jolt * 0.03, py, pz);
    group.rotation.set(rx, ry, 0);
    group.scale.set(s, s * (1 + breathing), s);

    // Emissives: tier tint × glow × flicker × surge.
    const fl = flicker(t, look.damage, look.critical, 2);
    for (const m of rt.emissive) {
      const seam = m.userData.warriorSeam === true;
      if (seam) m.emissive.copy(EMBER);
      else m.emissive.set(look.trim);
      m.emissiveIntensity = look.glow * fl * (1 + f.surge * 1.5) * (seam ? SEAM_GLOW : 1.5);
      if (f.hit > 0) m.emissive.lerp(HIT_RED, f.hit * 0.8);
    }

    // Chest emblem: sit on the anchor (in the wrapper's space), face out of the chest.
    const em = rt.emblem;
    if (em) {
      const pos = em.mesh.position;
      em.anchor.getWorldPosition(pos);
      group.worldToLocal(pos);
      em.center.getWorldPosition(tmpV);
      group.worldToLocal(tmpV);
      tmpV.subVectors(pos, tmpV).setY(0);
      if (tmpV.lengthSq() > 1e-8) em.mesh.quaternion.setFromUnitVectors(Z_AXIS, tmpV.normalize());
      const mat = em.mesh.material;
      mat.color.set(look.trim).multiplyScalar(1.5 * look.glow * fl * (1 + f.surge * 1.2));
      if (f.hit > 0) mat.color.lerp(HIT_RED, f.hit * 0.7);
    }
  });

  return <group ref={wrapper} />;
}

/** Create / refresh mixer actions for asset.clips. Returns true when anything changed. */
function syncActions(mixer: THREE.AnimationMixer, actions: GlbRuntime['actions'], asset: WarriorModelAsset): boolean {
  let changed = false;
  for (const [key, clip] of Object.entries(asset.clips)) {
    const name = key as WarriorAction;
    if (!clip || actions[name]?.getClip() === clip) continue;
    const action = mixer.clipAction(clip);
    if (isOneShot(name)) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    actions[name] = action;
    changed = true;
  }
  return changed;
}

function play(rt: GlbRuntime, action: WarriorAction, now: number): void {
  if (action === 'idle' || action === 'stance') rt.base = action;
  const clip = rt.actions[action] ?? (isOneShot(action) ? undefined : baseClip(rt, action as WarriorBaseAction) ?? undefined);
  rt.action = action;
  rt.started = now;
  rt.shockFired = false;
  if (!clip) {
    // No clip: run the move procedurally on top of the base loop.
    rt.procedural = isOneShot(action);
    return;
  }
  rt.procedural = false;
  if (clip === rt.current && !isOneShot(action)) return;
  clip.reset();
  clip.setEffectiveWeight(1);
  clip.play();
  if (rt.current && rt.current !== clip) rt.current.crossFadeTo(clip, FADE, false);
  rt.current = clip;
}
