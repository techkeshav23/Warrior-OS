// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: arc reactor
// A plasma-cyan core on the chest with its own point light. It follows
// an anchor (placeholder socket / GLB chest bone), breathes gently, and
// while NEXUS speaks it pulses with the voice: the cloud-voice level
// meter when available, else a procedural talk rhythm.
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNexusVoiceStore } from '@/lib/nexus/voice-store';
import { getCloudSpeechLevel } from '@/lib/jarvis/voice';
import { flicker } from './flicker';
import type { WarriorFx } from './pose';
import type { WarriorLook } from './types';

export interface ReactorAnchor {
  /** Where the reactor sits (world transform read every frame). */
  anchor: THREE.Object3D;
  /** A point behind it (chest centre) — the reactor faces away from it. */
  center: THREE.Object3D;
}

interface ArcReactorProps {
  anchorRef: RefObject<ReactorAnchor | null>;
  fxRef: RefObject<WarriorFx>;
  look: WarriorLook;
  /** Force the speaking state (previews); undefined = follow NEXUS. */
  speaking?: boolean;
  /** Point light on/off (cheap card variant skips it). */
  light?: boolean;
  scale?: number;
}

const PLASMA = new THREE.Color('#2fd6f5');
const CORE = new THREE.Color('#d9fbff');
const Z = new THREE.Vector3(0, 0, 1);

/** Procedural speech envelope: syllables inside phrases. */
function talkPulse(t: number): number {
  const phrase = Math.max(0, Math.sin(t * 0.9) * 0.6 + 0.55);
  const syll = Math.abs(Math.sin(t * 7.3)) * 0.6 + Math.abs(Math.sin(t * 11.1 + 1.3)) * 0.4;
  return Math.min(1, phrase * syll * 1.2);
}

function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(160,240,255,0.75)');
    g.addColorStop(0.45, 'rgba(47,214,245,0.22)');
    g.addColorStop(1, 'rgba(47,214,245,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function ArcReactor({ anchorRef, fxRef, look, speaking, light = true, scale = 1 }: ArcReactorProps) {
  const group = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.SpriteMaterial>(null);
  const halo = useRef<THREE.Sprite>(null);
  const pointLight = useRef<THREE.PointLight>(null);
  const spinner = useRef<THREE.Group>(null);
  const level = useRef(0);
  const tex = useMemo(() => glowTexture(), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), c: new THREE.Vector3(), q: new THREE.Quaternion() }), []);

  const segments = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);
  const coilMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PLASMA, toneMapped: false }), []);

  useFrame((state, delta) => {
    const g = group.current;
    const a = anchorRef.current;
    if (!g || !a || !g.parent) {
      if (g) g.visible = false;
      return;
    }
    g.visible = true;
    // Follow the anchor in our parent's space, facing out of the chest.
    a.anchor.getWorldPosition(tmp.a);
    a.center.getWorldPosition(tmp.c);
    g.parent.worldToLocal(tmp.a);
    g.parent.worldToLocal(tmp.c);
    g.position.copy(tmp.a);
    tmp.c.subVectors(tmp.a, tmp.c);
    tmp.c.setY(0);
    if (tmp.c.lengthSq() > 1e-8) {
      tmp.q.setFromUnitVectors(Z, tmp.c.normalize());
      g.quaternion.copy(tmp.q);
    }

    const t = state.clock.elapsedTime;
    const talking = speaking ?? useNexusVoiceStore.getState().speaking;
    let target = 0;
    if (talking) {
      const cloud = getCloudSpeechLevel();
      target = cloud > 0.01 ? cloud : talkPulse(t);
    }
    // Fast attack, slower release.
    const k = target > level.current ? Math.min(1, delta * 22) : Math.min(1, delta * 7);
    level.current += (target - level.current) * k;
    const f = fxRef.current;
    if (f) f.voice = level.current;

    const idle = 0.5 + 0.5 * Math.sin(t * 2.1);
    const surge = f?.surge ?? 0;
    const fl = flicker(t, look.damage, look.critical, 9);
    const drive = (1.1 + idle * 0.35 + level.current * 2.4 + surge * 2.5) * fl;

    coreMat.current?.color.copy(CORE).multiplyScalar(1.4 + drive * 1.3);
    coilMat.color.copy(PLASMA).multiplyScalar(1.2 + drive);
    if (haloMat.current) haloMat.current.opacity = Math.min(1, 0.45 + drive * 0.22);
    if (halo.current) halo.current.scale.setScalar(scale * (0.12 + drive * 0.035 + level.current * 0.1));
    if (pointLight.current) pointLight.current.intensity = (0.25 + drive * 0.3) * scale;
    if (spinner.current) spinner.current.rotation.z -= delta * (0.6 + level.current * 5 + surge * 6);
  });

  return (
    <group ref={group} scale={scale} visible={false}>
      {/* Core disc */}
      <mesh position={[0, 0, 0.004]}>
        <circleGeometry args={[0.03, 18]} />
        <meshBasicMaterial ref={coreMat} toneMapped={false} />
      </mesh>
      {/* Segmented coil ring */}
      <group ref={spinner}>
        {segments.map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.002]} rotation={[0, 0, a]} material={coilMat}>
            <boxGeometry args={[0.009, 0.014, 0.006]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0, 0.001]}>
        <ringGeometry args={[0.047, 0.052, 24]} />
        <meshBasicMaterial color={PLASMA} toneMapped={false} />
      </mesh>
      <sprite ref={halo} position={[0, 0, 0.02]}>
        <spriteMaterial
          ref={haloMat}
          map={tex}
          color={PLASMA}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {light && <pointLight ref={pointLight} color={PLASMA} distance={2.2} decay={2} position={[0, 0.05, 0.85]} />}
    </group>
  );
}
