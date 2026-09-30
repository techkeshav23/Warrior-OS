// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: particles + aura
//   Embers       floating plasma/ember sparks around the stage (GPU-animated)
//   Aura         streak aura: a flame-like fresnel shell + rising motes
//   DecaySparks  decay stage 5: shorting sparks bursting off the armor
// ═══════════════════════════════════════════════════════════

'use client';

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WarriorFx } from './pose';
import { setUniform } from './mutate';
import type { WarriorLook } from './types';

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ─── Embers ───

const EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uSize;
  uniform float uBoost;
  attribute vec4 aSeed; // x: speed, y: phase, z: size, w: hue
  varying float vHue;
  varying float vFade;
  void main() {
    vec3 p = position;
    float y = mod(p.y + uTime * aSeed.x * (1.0 + uBoost * 2.0), uHeight);
    p.y = y - 0.1;
    p.x += sin(uTime * 0.6 + aSeed.y) * 0.18;
    p.z += cos(uTime * 0.5 + aSeed.y * 1.3) * 0.18;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = smoothstep(0.0, 0.4, y) * (1.0 - smoothstep(uHeight * 0.6, uHeight, y));
    vHue = aSeed.w;
    gl_PointSize = uSize * aSeed.z * (0.8 + 0.4 * sin(uTime * 3.0 + aSeed.y)) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const EMBER_FRAG = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  varying float vHue;
  varying float vFade;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a;
    vec3 col = mix(uColorA, uColorB, step(0.7, vHue));
    float v = a * vFade * uIntensity;
    if (v < 0.004) discard;
    gl_FragColor = vec4(col * v * 2.0, v);
  }
`;

interface EmbersProps {
  count: number;
  radiusMin?: number;
  radiusMax?: number;
  height?: number;
  fxRef: RefObject<WarriorFx>;
  size?: number;
  intensity?: number;
  colorA?: string;
  colorB?: string;
  seed?: number;
}

export function Embers({ count, radiusMin = 0.8, radiusMax = 5, height = 4.5, fxRef, size = 60, intensity = 1, colorA = '#2fd6f5', colorB = '#ff8a3d', seed = 7 }: EmbersProps) {
  const geometry = useMemo(() => {
    const r = rand(seed);
    const pos = new Float32Array(count * 3);
    const s = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2;
      const d = radiusMin + Math.sqrt(r()) * (radiusMax - radiusMin);
      pos[i * 3] = Math.cos(a) * d;
      pos[i * 3 + 1] = r() * height;
      pos[i * 3 + 2] = Math.sin(a) * d;
      s[i * 4] = 0.08 + r() * 0.25;
      s[i * 4 + 1] = r() * 20;
      s[i * 4 + 2] = 0.4 + r() * 1.1;
      s[i * 4 + 3] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(s, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), radiusMax + height);
    return g;
  }, [count, radiusMin, radiusMax, height, seed]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EMBER_VERT,
        fragmentShader: EMBER_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uHeight: { value: height },
          uSize: { value: size },
          uBoost: { value: 0 },
          uIntensity: { value: intensity },
          uColorA: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [height, size, intensity, colorA, colorB]
  );
  useFrame((state) => {
    setUniform(material, 'uTime', state.clock.elapsedTime);
    setUniform(material, 'uBoost', fxRef.current?.surge ?? 0);
  });
  return <points geometry={geometry} material={material} renderOrder={5} />;
}

// ─── Aura ───

const AURA_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  varying float vY;
  void main() {
    vUv = uv;
    vY = position.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const AURA_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vN;
  varying vec3 vV;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float fres = pow(1.0 - abs(dot(vN, vV)), 3.0);
    vec2 q = vec2(vUv.x * 12.0, vUv.y * 3.5 - uTime * 1.6);
    float n = noise(q) * 0.6 + noise(q * 2.3 + 4.0) * 0.4;
    float flame = smoothstep(0.45, 1.0, n + (1.0 - vUv.y) * 0.35 - 0.1);
    float fade = smoothstep(0.0, 0.06, vUv.y) * pow(1.0 - vUv.y, 2.6);
    // Only the silhouette edges burn; the middle stays clear.
    float v = fres * (0.35 + flame * 1.2) * fade * uIntensity;
    if (v < 0.003) discard;
    gl_FragColor = vec4(uColor * v * 1.4, v);
  }
`;

export function Aura({ look, fxRef, motes = 70 }: { look: WarriorLook; fxRef: RefObject<WarriorFx>; motes?: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: AURA_VERT,
        fragmentShader: AURA_FRAG,
        uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uIntensity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    []
  );
  const shell = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const f = fxRef.current;
    const surge = f?.surge ?? 0;
    const level = Math.max(look.aura, surge * 0.9);
    setUniform(material, 'uTime', state.clock.elapsedTime);
    setUniform(material, 'uIntensity', level * (0.7 + surge * 1.2));
    (material.uniforms.uColor.value as THREE.Color).set(look.trim);
    if (shell.current) shell.current.visible = level > 0.01;
  });
  return (
    <group>
      <mesh ref={shell} position={[0, 1.0, 0]} material={material} renderOrder={6}>
        <cylinderGeometry args={[0.46, 0.58, 2.3, 40, 1, true]} />
      </mesh>
      {look.aura > 0 && (
        <Embers
          count={motes}
          radiusMin={0.25}
          radiusMax={0.7}
          height={2.4}
          fxRef={fxRef}
          size={40}
          intensity={Math.min(1.4, look.aura * 1.2)}
          colorA={look.trim}
          colorB={look.accent}
          seed={31}
        />
      )}
    </group>
  );
}

// ─── Decay sparks (stage 5) ───

const SPARK_COUNT = 90;

interface SparkSim {
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  points: THREE.Points;
  nextBurst: number;
}

export function DecaySparks({ active }: { active: boolean }) {
  const holder = useRef<THREE.Group>(null);
  const simRef = useRef<SparkSim | null>(null);

  useLayoutEffect(() => {
    const group = holder.current;
    if (!group) return;
    const pos = new Float32Array(SPARK_COUNT * 3).fill(-50);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 4);
    const m = new THREE.PointsMaterial({
      color: new THREE.Color('#ffb070').multiplyScalar(3),
      size: 0.035,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(g, m);
    points.renderOrder = 7;
    group.add(points);
    simRef.current = { pos, vel: new Float32Array(SPARK_COUNT * 3), life: new Float32Array(SPARK_COUNT), points, nextBurst: 0 };
    return () => {
      group.remove(points);
      g.dispose();
      m.dispose();
      simRef.current = null;
    };
  }, []);

  useFrame((frame, delta) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.points.visible = active;
    if (!active) return;
    const dt = Math.min(delta, 1 / 20);
    const t = frame.clock.elapsedTime;
    const { pos, vel, life } = sim;
    if (t > sim.nextBurst) {
      // Burst from a random armor point.
      const bx = (Math.random() - 0.5) * 0.5;
      const by = 0.5 + Math.random() * 1.1;
      const bz = (Math.random() - 0.2) * 0.3;
      let spawned = 0;
      for (let i = 0; i < SPARK_COUNT && spawned < 14; i++) {
        if (life[i] > 0) continue;
        life[i] = 0.4 + Math.random() * 0.5;
        pos[i * 3] = bx;
        pos[i * 3 + 1] = by;
        pos[i * 3 + 2] = bz;
        vel[i * 3] = (Math.random() - 0.5) * 2.4;
        vel[i * 3 + 1] = Math.random() * 1.8;
        vel[i * 3 + 2] = (Math.random() - 0.3) * 2.0;
        spawned++;
      }
      sim.nextBurst = t + 0.25 + Math.random() * 0.9;
    }
    for (let i = 0; i < SPARK_COUNT; i++) {
      if (life[i] <= 0) {
        pos[i * 3 + 1] = -50;
        continue;
      }
      life[i] -= dt;
      vel[i * 3 + 1] -= 6 * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = 0;
        vel[i * 3 + 1] *= -0.3;
      }
    }
    (sim.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return <group ref={holder} />;
}
