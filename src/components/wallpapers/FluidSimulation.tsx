// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Fluid Simulation Wallpaper
// GLSL curl-noise fluid in the FORGE HUD palette: blue and violet ink
// currents over ink-950, plasma light where the currents meet, a thin
// plasma trail behind the pointer, audio-reactive turbulence. The flow
// field uses a 3-octave noise (it only needs low frequencies), which
// roughly halves the per-pixel cost. Dithered (no banding).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WallpaperProps } from '@/types/wallpaper';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float u_time;
  uniform vec2 u_mouse;
  uniform vec2 u_prevMouse;
  uniform vec2 u_resolution;
  uniform float u_bass;
  uniform float u_energy;

  varying vec2 vUv;

  // FORGE HUD palette
  const vec3 INK       = vec3(0.016, 0.024, 0.043); // ink-950
  const vec3 INK_BLUE  = vec3(0.030, 0.068, 0.120);
  const vec3 INK_VIOLET= vec3(0.075, 0.058, 0.170);
  const vec3 DEEP_TEAL = vec3(0.016, 0.170, 0.210);
  const vec3 PLASMA    = vec3(0.184, 0.839, 0.961); // plasma-400
  const vec3 PLASMA_HI = vec3(0.486, 0.906, 0.984); // plasma-300
  const vec3 VIOLET    = vec3(0.655, 0.545, 0.980); // viz-3

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  // 5 octaves for the ink, 3 for the (low-frequency) flow field
  float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
      f += w * noise(p);
      p *= 2.03;
      w *= 0.5;
    }
    return f;
  }
  float fbm3(vec2 p) {
    float f = 0.5 * noise(p);
    p *= 2.03;
    f += 0.25 * noise(p);
    p *= 2.03;
    f += 0.125 * noise(p);
    return f;
  }

  // Curl noise for fluid-like flow
  vec2 curl(vec2 p, float t) {
    float eps = 0.02;
    float n = fbm3(p + vec2(0.0, eps) + t * 0.1);
    float s = fbm3(p - vec2(0.0, eps) + t * 0.1);
    float e = fbm3(p + vec2(eps, 0.0) + t * 0.1);
    float w2 = fbm3(p - vec2(eps, 0.0) + t * 0.1);
    return vec2(n - s, -(e - w2)) / (2.0 * eps);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    float time = u_time * 0.07;

    // Mouse velocity for disturbance
    vec2 mousePos = (u_mouse - 0.5) * vec2(aspect, 1.0);
    vec2 prevMousePos = (u_prevMouse - 0.5) * vec2(aspect, 1.0);
    float mouseSpeed = length(mousePos - prevMousePos);

    // Fluid advection (curl noise)
    vec2 flow = curl(p * 2.6, time);
    flow += curl(p * 5.0 + time * 0.5, time * 1.4) * 0.45;

    // Audio turbulence
    flow *= 1.0 + u_bass * 1.5 + u_energy * 0.4;

    // Mouse interaction: ink pushed away from the pointer
    float mouseDist = distance(p, mousePos);
    float mouseInfluence = smoothstep(0.32, 0.0, mouseDist) * (0.4 + mouseSpeed * 10.0);
    flow += normalize(p - mousePos + 0.001) * mouseInfluence * 0.3;

    vec2 q = p + flow * 0.05;

    // Warped ink layers
    float n1 = fbm(q * 1.8 + time);
    float n2 = fbm(q * 2.8 - time * 0.7 + vec2(5.2, 1.3));
    float n3 = fbm3(q * 4.0 + vec2(n1, n2) * 0.8);

    vec3 color = mix(INK, INK_BLUE, smoothstep(0.25, 0.6, n1));
    color = mix(color, INK_VIOLET, smoothstep(0.5, 0.8, n1) * 0.9);
    color = mix(color, DEEP_TEAL, smoothstep(0.42, 0.78, n2) * 0.75);
    color += VIOLET * smoothstep(0.5, 0.8, n3) * 0.05;

    // Plasma light where the currents meet
    float seam = 1.0 - smoothstep(0.0, 0.06, abs(n1 - n2));
    color += PLASMA * seam * smoothstep(0.3, 0.7, n3) * 0.1;

    // Pointer: a thin plasma ink trail
    color += PLASMA_HI * mouseInfluence * fbm3(p * 7.0 + time * 2.0) * 0.07;

    // Settle into ink at the edges
    float vig = smoothstep(1.2, 0.25, length((uv - 0.5) * vec2(aspect * 0.8, 1.0)));
    color = mix(INK, color, mix(0.35, 1.0, vig));

    color *= 1.0 + u_bass * 0.15;

    // Dither: no banding in the dark gradients
    color += (hash(gl_FragCoord.xy + fract(u_time * 0.37) * 91.0) - 0.5) / 255.0;

    gl_FragColor = vec4(max(color, 0.0), 1.0);
  }
`;

function FluidMesh(props: WallpaperProps) {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });
  const propsRef = useRef(props);
  propsRef.current = props;

  // useState initializer pattern — stable identity, R3F-friendly mutation in useFrame.
  const [uniforms] = useState(() => ({
    u_time: { value: 0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_bass: { value: 0 },
    u_energy: { value: 0 },
  }));

  useFrame(({ clock, size }) => {
    const { mouseX, mouseY, bassLevel, overallLevel } = propsRef.current;

    prevMouseRef.current.x = mouseRef.current.x;
    prevMouseRef.current.y = mouseRef.current.y;

    const targetX = (mouseX + 1) * 0.5;
    const targetY = (mouseY + 1) * 0.5;
    mouseRef.current.x += (targetX - mouseRef.current.x) * 0.08;
    mouseRef.current.y += (targetY - mouseRef.current.y) * 0.08;

    // Canonical R3F pattern: useFrame mutates uniform `.value` each frame.
    /* eslint-disable react-hooks/immutability */
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.u_prevMouse.value.set(prevMouseRef.current.x, prevMouseRef.current.y);
    uniforms.u_resolution.value.set(size.width, size.height);
    uniforms.u_bass.value = bassLevel;
    uniforms.u_energy.value = overallLevel;
    /* eslint-enable react-hooks/immutability */
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function FluidSimulationInner(props: WallpaperProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{ antialias: false, alpha: false }}
        camera={{ position: [0, 0, 1] }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 1.5]}
      >
        <FluidMesh {...props} />
      </Canvas>
    </div>
  );
}

export const FluidSimulation = memo(FluidSimulationInner);
