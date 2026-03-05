// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Fluid Simulation Wallpaper
// GLSL Navier-Stokes-style fluid, mouse creates ink swirls,
// audio-reactive turbulence
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useMemo } from 'react';
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
  
  // Noise functions
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
  
  float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 6; i++) {
      f += w * noise(p);
      p *= 2.03;
      w *= 0.5;
    }
    return f;
  }
  
  // Curl noise for fluid-like flow
  vec2 curl(vec2 p, float t) {
    float eps = 0.01;
    float n = fbm(p + vec2(0.0, eps) + t * 0.1);
    float s = fbm(p - vec2(0.0, eps) + t * 0.1);
    float e = fbm(p + vec2(eps, 0.0) + t * 0.1);
    float w2 = fbm(p - vec2(eps, 0.0) + t * 0.1);
    return vec2(n - s, -(e - w2)) / (2.0 * eps);
  }
  
  void main() {
    vec2 uv = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    
    float time = u_time * 0.1;
    
    // Mouse velocity for disturbance
    vec2 mousePos = (u_mouse - 0.5) * vec2(aspect, 1.0);
    vec2 prevMousePos = (u_prevMouse - 0.5) * vec2(aspect, 1.0);
    vec2 mouseVel = mousePos - prevMousePos;
    float mouseSpeed = length(mouseVel);
    
    // Fluid advection (curl noise)
    vec2 flow = curl(p * 3.0, time);
    flow += curl(p * 6.0 + time * 0.5, time * 1.5) * 0.5;
    
    // Audio turbulence boost
    float turbulence = 1.0 + u_bass * 2.0 + u_energy * 0.5;
    flow *= turbulence;
    
    // Mouse interaction — ink injection
    float mouseDist = distance(p, mousePos);
    float mouseInfluence = smoothstep(0.3, 0.0, mouseDist) * (0.5 + mouseSpeed * 10.0);
    vec2 mouseForce = normalize(p - mousePos + 0.001) * mouseInfluence;
    flow += mouseForce * 0.3;
    
    // Advected coordinates
    vec2 advectedUV = p + flow * 0.05;
    
    // Color layers from warped noise
    float n1 = fbm(advectedUV * 2.0 + time);
    float n2 = fbm(advectedUV * 3.0 - time * 0.7 + vec2(5.2, 1.3));
    float n3 = fbm(advectedUV * 4.0 + vec2(n1, n2) * 0.8);
    
    // Deep color palette — dark fluid
    vec3 col1 = vec3(0.0, 0.15, 0.35);  // Deep navy
    vec3 col2 = vec3(0.2, 0.0, 0.4);    // Purple
    vec3 col3 = vec3(0.0, 0.3, 0.3);    // Teal
    vec3 col4 = vec3(0.35, 0.0, 0.2);   // Wine
    
    vec3 color = mix(col1, col2, n1);
    color = mix(color, col3, n2 * 0.5);
    color += col4 * n3 * 0.3;
    
    // Mouse ink splash
    float inkNoise = fbm(p * 8.0 + time * 2.0);
    vec3 inkColor = vec3(0.0, 0.5, 0.8) * mouseInfluence * inkNoise;
    color += inkColor * 0.4;
    
    // Bright edge highlights
    float edge = abs(n1 - n2) * 2.0;
    color += vec3(0.0, 0.4, 0.7) * edge * 0.1;
    
    // Overall brightness (keep dark)
    color *= 0.35;
    
    // Audio glow
    color *= 1.0 + u_bass * 0.2;
    
    // Vignette
    float vig = 1.0 - dot(vUv - 0.5, vUv - 0.5) * 1.5;
    color *= vig;
    
    gl_FragColor = vec4(max(color, 0.0), 1.0);
  }
`;

function FluidMesh(props: WallpaperProps) {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const prevMouseRef = useRef({ x: 0.5, y: 0.5 });

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_prevMouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_bass: { value: 0 },
      u_energy: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    // Store prev before updating
    prevMouseRef.current.x = mouseRef.current.x;
    prevMouseRef.current.y = mouseRef.current.y;

    // Smooth mouse
    const targetX = (props.mouseX + 1) * 0.5;
    const targetY = (props.mouseY + 1) * 0.5;
    mouseRef.current.x += (targetX - mouseRef.current.x) * 0.08;
    mouseRef.current.y += (targetY - mouseRef.current.y) * 0.08;

    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.u_prevMouse.value.set(prevMouseRef.current.x, prevMouseRef.current.y);
    uniforms.u_bass.value = props.bassLevel;
    uniforms.u_energy.value = props.overallLevel;
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
