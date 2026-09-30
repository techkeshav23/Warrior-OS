// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: holographic platform
// Forged plinth + counter-rotating segmented plasma rings, a faint hex
// grid floor (optionally a blurred mirror floor), a rising light
// curtain, light pillars and a shockwave ring fired by power-ups.
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { WarriorFx } from './pose';
import { assign, setUniform } from './mutate';
import type { WarriorLook } from './types';

const PLASMA = '#2fd6f5';

// ─── Shaders ───

const RING_VERT = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSegments;
  uniform float uDuty;
  uniform float uInner;
  uniform float uOuter;
  uniform float uIntensity;
  uniform float uTicks;
  varying vec2 vPos;
  #define TAU 6.28318530718
  void main() {
    float r = length(vPos);
    float a = atan(vPos.y, vPos.x) / TAU + 0.5;
    float band = (r - uInner) / (uOuter - uInner);
    float edge = smoothstep(0.0, 0.15, band) * smoothstep(1.0, 0.85, band);
    float seg = fract(a * uSegments + uTime * uSpeed);
    float on = step(seg, uDuty);
    // Fine tick marks across the whole ring.
    float tick = uTicks > 0.0 ? step(0.82, fract(a * uTicks)) * step(0.55, band) : 0.0;
    // A brighter sweeping arc.
    float sweep = pow(fract(a - uTime * uSpeed * 0.35), 18.0);
    float v = (on * edge + tick * 0.6 + sweep * 1.5 * edge) * uIntensity;
    if (v < 0.003) discard;
    gl_FragColor = vec4(uColor * v * 1.15, min(v, 1.0));
  }
`;

const GRID_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vPos;
  // Hexagonal grid distance (flat-top hexes).
  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
  }
  vec4 hexCoords(vec2 uv) {
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(gv, uv - gv);
  }
  void main() {
    float r = length(vPos);
    vec4 hc = hexCoords(vPos * 2.6);
    float d = 0.5 - hexDist(hc.xy);
    float line = smoothstep(0.035, 0.0, d);
    // Cells light up in slow waves radiating from the platform.
    float wave = 0.5 + 0.5 * sin(length(hc.zw) * 0.9 - uTime * 1.3);
    float cell = smoothstep(0.92, 1.0, wave) * 0.35;
    float fade = exp(-r * 0.32) * smoothstep(1.3, 1.9, r);
    float v = (line * (0.35 + wave * 0.4) + cell * smoothstep(0.1, 0.0, d - 0.3)) * fade * uIntensity;
    // Square Tron grid far out.
    vec2 g = abs(fract(vPos * 0.5) - 0.5);
    float sq = smoothstep(0.02, 0.0, min(g.x, g.y)) * exp(-r * 0.12) * smoothstep(3.0, 5.0, r) * 0.5;
    v += sq * uIntensity;
    if (v < 0.002) discard;
    gl_FragColor = vec4(uColor * v, v);
  }
`;

const CURTAIN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CURTAIN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 2.6);
    float scan = 0.65 + 0.35 * sin(vUv.y * 90.0 - uTime * 4.0);
    float streaks = 0.6 + 0.4 * sin(vUv.x * 160.0 + sin(vUv.x * 23.0 + uTime) * 2.0);
    float v = fade * scan * streaks * uIntensity;
    gl_FragColor = vec4(uColor * v, v);
  }
`;

const PILLAR_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const PILLAR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPhase;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float core = pow(vFacing, 4.0);
    float fade = pow(1.0 - vUv.y, 1.3) * smoothstep(0.0, 0.03, vUv.y);
    float pulse = 0.7 + 0.3 * sin(uTime * 1.3 + uPhase);
    float travel = pow(fract(vUv.y * 1.5 - uTime * 0.35 + uPhase), 10.0) * 0.8;
    float v = core * (fade * pulse + travel * fade) * uIntensity;
    gl_FragColor = vec4(uColor * v * 2.0, min(v, 1.0));
  }
`;

function additive(fragmentShader: string, vertexShader: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

interface RingSpec {
  inner: number;
  outer: number;
  speed: number;
  segments: number;
  duty: number;
  intensity: number;
  ticks: number;
  y: number;
}

const RINGS: RingSpec[] = [
  { inner: 0.55, outer: 0.6, speed: 0.05, segments: 3, duty: 0.8, intensity: 1.2, ticks: 0, y: 0.004 },
  { inner: 0.78, outer: 0.86, speed: -0.035, segments: 24, duty: 0.55, intensity: 1.1, ticks: 120, y: 0.005 },
  { inner: 1.0, outer: 1.03, speed: 0.02, segments: 1, duty: 1.0, intensity: 1.1, ticks: 0, y: 0.006 },
  { inner: 1.1, outer: 1.2, speed: -0.015, segments: 6, duty: 0.7, intensity: 0.9, ticks: 240, y: 0.004 },
  { inner: 1.3, outer: 1.34, speed: 0.03, segments: 40, duty: 0.4, intensity: 1.0, ticks: 0, y: 0.003 },
];

export interface PlatformProps {
  look: WarriorLook;
  fxRef: RefObject<WarriorFx>;
  /** Blurred mirror floor (hero / hall). */
  reflective?: boolean;
  /** Pillars + far grid (skipped on the card). */
  full?: boolean;
  receiveShadow?: boolean;
}

export function Platform({ look, fxRef, reflective = false, full = true, receiveShadow = false }: PlatformProps) {
  const color = useMemo(() => new THREE.Color(PLASMA), []);
  const ringMats = useMemo(
    () =>
      RINGS.map((r) =>
        additive(RING_FRAG, RING_VERT, {
          uColor: { value: color.clone() },
          uTime: { value: 0 },
          uSpeed: { value: r.speed },
          uSegments: { value: r.segments },
          uDuty: { value: r.duty },
          uInner: { value: r.inner },
          uOuter: { value: r.outer },
          uIntensity: { value: r.intensity },
          uTicks: { value: r.ticks },
        })
      ),
    [color]
  );
  const gridMat = useMemo(
    () => additive(GRID_FRAG, RING_VERT, { uColor: { value: new THREE.Color('#1fb8d4') }, uTime: { value: 0 }, uIntensity: { value: 1 } }),
    []
  );
  const curtainMat = useMemo(
    () => additive(CURTAIN_FRAG, CURTAIN_VERT, { uColor: { value: color.clone() }, uTime: { value: 0 }, uIntensity: { value: 0.2 } }),
    [color]
  );
  const pillars = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const far = i % 2 === 0;
        const radius = far ? 7.8 : 5.6;
        return {
          key: i,
          pos: [Math.cos(a) * radius, 0, Math.sin(a) * radius] as [number, number, number],
          height: far ? 7 : 4.5,
          mat: additive(PILLAR_FRAG, PILLAR_VERT, {
            uColor: { value: new THREE.Color(i % 4 === 1 ? '#ff8a3d' : PLASMA) },
            uTime: { value: 0 },
            uIntensity: { value: far ? 0.9 : 1.4 },
            uPhase: { value: i * 1.7 },
          }),
        };
      }),
    []
  );
  const shockMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: PLASMA, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    []
  );
  const edgeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: PLASMA, toneMapped: false }), []);

  const ringGroup = useRef<THREE.Group>(null);
  const shock = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const f = fxRef.current;
    const surge = f?.surge ?? 0;
    const voice = f?.voice ?? 0;
    const dim = 1 - look.damage * 0.35;
    ringMats.forEach((m, i) => {
      setUniform(m, 'uTime', t * (1 + surge * 3));
      setUniform(m, 'uIntensity', RINGS[i].intensity * dim * (1 + surge * 1.4 + voice * 0.3));
    });
    setUniform(gridMat, 'uTime', t);
    setUniform(gridMat, 'uIntensity', dim * (1 + surge * 0.8));
    setUniform(curtainMat, 'uTime', t);
    setUniform(curtainMat, 'uIntensity', (0.16 + surge * 0.9) * dim);
    for (const p of pillars) setUniform(p.mat, 'uTime', t);
    edgeMat.color.set(PLASMA).multiplyScalar((1.5 + surge * 3) * dim);

    // Counter-rotating ring layers.
    const g = ringGroup.current;
    if (g) {
      g.children.forEach((c, i) => {
        c.rotation.z = t * RINGS[i].speed * (i % 2 ? -1 : 1) * 2;
      });
    }

    // Shockwave.
    const s = shock.current;
    if (s && f) {
      const age = f.shockAt >= 0 ? performance.now() / 1000 - f.shockAt : 99;
      if (age < 1.1) {
        const k = age / 1.1;
        s.visible = true;
        s.scale.setScalar(0.6 + k * 5.5);
        assign(shockMat, { opacity: (1 - k) * (1 - k) * 1.5 });
      } else s.visible = false;
    }
  });

  return (
    <group>
      {/* Plinth */}
      <mesh position={[0, -0.06, 0]} receiveShadow={receiveShadow} castShadow={false}>
        <cylinderGeometry args={[1.42, 1.55, 0.12, 12]} />
        <meshPhysicalMaterial color="#0c1115" metalness={0.9} roughness={0.35} clearcoat={0.6} clearcoatRoughness={0.2} flatShading />
      </mesh>
      <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={receiveShadow}>
        <circleGeometry args={[1.42, 12]} />
        <meshPhysicalMaterial color="#070b0e" metalness={0.8} roughness={0.42} clearcoat={0.35} clearcoatRoughness={0.3} />
      </mesh>
      {/* Plinth edge light */}
      <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={edgeMat}>
        <ringGeometry args={[1.4, 1.43, 12, 1]} />
      </mesh>
      <mesh position={[0, -0.125, 0]} rotation={[-Math.PI / 2, 0, 0]} material={edgeMat}>
        <ringGeometry args={[1.54, 1.56, 12, 1]} />
      </mesh>

      {/* Holo rings */}
      <group ref={ringGroup} rotation={[-Math.PI / 2, 0, 0]}>
        {RINGS.map((r, i) => (
          <mesh key={i} position={[0, 0, r.y]} material={ringMats[i]} renderOrder={3}>
            <ringGeometry args={[r.inner, r.outer, 128, 1]} />
          </mesh>
        ))}
      </group>

      {/* Rising light curtain */}
      <mesh position={[0, 0.45, 0]} material={curtainMat} renderOrder={4}>
        <cylinderGeometry args={[1.36, 1.36, 0.9, 64, 1, true]} />
      </mesh>

      {/* Shockwave */}
      <mesh ref={shock} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={shockMat} visible={false}>
        <ringGeometry args={[0.2, 0.24, 96, 1]} />
      </mesh>

      {/* Floor */}
      {reflective ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.125, 0]} receiveShadow={receiveShadow}>
          <planeGeometry args={[40, 40]} />
          <MeshReflectorMaterial
            blur={[400, 120]}
            resolution={512}
            mixBlur={1}
            mixStrength={0.55}
            roughness={0.85}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#03080a"
            metalness={0.6}
            mirror={0.35}
          />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.125, 0]} receiveShadow={receiveShadow}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#050b0e" metalness={0.5} roughness={0.6} />
        </mesh>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} material={gridMat} renderOrder={1}>
        <planeGeometry args={[30, 30, 1, 1]} />
      </mesh>

      {full &&
        pillars.map((p) => (
          <mesh key={p.key} position={[p.pos[0], p.height / 2 - 0.12, p.pos[2]]} material={p.mat} renderOrder={2}>
            <cylinderGeometry args={[0.07, 0.07, p.height, 12, 1, true]} />
          </mesh>
        ))}
      {full &&
        pillars.map((p) => (
          <mesh key={`b${p.key}`} position={[p.pos[0], -0.115, p.pos[2]]} rotation={[-Math.PI / 2, 0, 0]} material={edgeMat}>
            <ringGeometry args={[0.12, 0.15, 6, 1]} />
          </mesh>
        ))}
    </group>
  );
}
