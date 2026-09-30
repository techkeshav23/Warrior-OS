// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: environment + bloom
//   ForgeEnvironment  offline reflections: three's RoomEnvironment with
//                     plasma / ember light strips added, baked through
//                     PMREMGenerator (no network HDRIs).
//   Bloom             EffectComposer (RenderPass → UnrealBloomPass →
//                     OutputPass) that takes over rendering from R3F
//                     (useFrame priority 1). Emissives are toneMapped
//                     off and pushed > 1, so the threshold keeps the
//                     bloom on seams, visor, reactor and rings only.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { WarriorFx } from './pose';
import { assign } from './mutate';

function strip(color: string, strength: number, w: number, h: number, pos: [number, number, number], rotY: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide })
  );
  m.position.set(...pos);
  m.rotation.y = rotY;
  return m;
}

export function ForgeEnvironment({ intensity = 0.55 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    // Dim the neutral studio so black armor stays black; the coloured
    // strips below then dominate the reflections.
    room.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.Material & { color?: THREE.Color; emissiveIntensity?: number };
      if (typeof mat.emissiveIntensity === 'number' && mat.emissiveIntensity > 1) {
        mat.emissiveIntensity *= 0.05; // area lights: 17…100 → ~1…5
      } else if (mat.color) {
        mat.color.multiplyScalar(0.15);
      }
    });
    // Colour the reflections: plasma strips left/back, an ember strip right.
    const extras = [
      strip('#2fd6f5', 22, 0.5, 9, [-6.5, 3, -2], Math.PI / 2),
      strip('#ff8a3d', 18, 0.45, 8, [6.5, 2.5, -3], -Math.PI / 2),
      strip('#2fd6f5', 5, 6, 0.25, [0, 7, -5], 0),
    ];
    extras.forEach((m) => room.add(m));
    const rt = pmrem.fromScene(room, 0.035);
    const prev = scene.environment;
    const prevIntensity = scene.environmentIntensity;
    assign(scene, { environment: rt.texture, environmentIntensity: intensity });
    return () => {
      assign(scene, { environment: prev, environmentIntensity: prevIntensity });
      rt.dispose();
      pmrem.dispose();
      extras.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      room.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
        }
      });
    };
  }, [gl, scene, intensity]);
  return null;
}

interface BloomProps {
  strength?: number;
  radius?: number;
  threshold?: number;
  fxRef?: RefObject<WarriorFx>;
}

export function Bloom({ strength = 0.9, radius = 0.55, threshold = 0.82, fxRef }: BloomProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomRef = useRef<UnrealBloomPass | null>(null);

  useEffect(() => {
    const composer = new EffectComposer(gl);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), strength, radius, threshold);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    composerRef.current = composer;
    bloomRef.current = bloom;
    return () => {
      composer.dispose();
      bloom.dispose();
      composerRef.current = null;
      bloomRef.current = null;
    };
  }, [gl, scene, camera, strength, radius, threshold]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [size, dpr, gl, scene, camera, strength, radius, threshold]);

  useFrame((_, delta) => {
    const composer = composerRef.current;
    if (!composer) {
      gl.render(scene, camera);
      return;
    }
    const bloom = bloomRef.current;
    if (bloom) bloom.strength = strength * (1 + (fxRef?.current?.surge ?? 0) * 0.9 + (fxRef?.current?.impact ?? 0) * 0.3);
    composer.render(delta);
  }, 1);

  return null;
}
