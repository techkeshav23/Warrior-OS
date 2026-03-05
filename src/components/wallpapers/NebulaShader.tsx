// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Nebula Shader Wallpaper
// React Three Fiber + GLSL: fractal noise nebula
// Time-animated, mouse-reactive ripple, color shifts
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WallpaperProps } from '@/types/wallpaper';

// ─── GLSL Shaders ───
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
  uniform vec2 u_resolution;
  uniform float u_bass;
  uniform float u_energy;
  
  varying vec2 vUv;
  
  // Simplex-like noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
  
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
  
  // Fractal Brownian Motion
  float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
      f += w * snoise(p);
      p *= 2.0;
      w *= 0.5;
    }
    return f;
  }
  
  void main() {
    vec2 uv = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;
    
    float time = u_time * 0.08;
    
    // Multiple layers of FBM noise
    float n1 = fbm(uv * 2.5 + time * 0.7);
    float n2 = fbm(uv * 3.5 - time * 0.5 + vec2(5.2, 1.3));
    float n3 = fbm(uv * 4.0 + time * 0.3 + vec2(n1, n2) * 0.5);
    
    // Mouse ripple
    float dist = distance(uv, vec2(u_mouse.x * aspect, u_mouse.y));
    float ripple = 0.04 / (dist + 0.05);
    
    // Color palette — cyan to purple nebula
    vec3 col1 = vec3(0.0, 0.4, 0.8);   // Deep blue
    vec3 col2 = vec3(0.3, 0.0, 0.7);   // Purple
    vec3 col3 = vec3(0.0, 0.7, 0.6);   // Teal
    vec3 col4 = vec3(0.5, 0.0, 0.4);   // Magenta
    
    vec3 color = mix(col1, col2, n1 * 0.5 + 0.5);
    color = mix(color, col3, n2 * 0.3 + 0.3);
    color += col4 * n3 * 0.15;
    
    // Add ripple glow
    color += vec3(0.0, 0.5, 1.0) * ripple * 0.15;
    
    // Audio reactivity — boost brightness with bass
    float audioBoost = 1.0 + u_bass * 0.3 + u_energy * 0.1;
    color *= audioBoost;
    
    // Keep dark overall
    color *= 0.25;
    
    // Subtle vignette
    float vig = 1.0 - smoothstep(0.4, 1.2, length(vUv - 0.5) * 1.5);
    color *= vig;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─── Shader Mesh ───
function NebulaMesh(props: WallpaperProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const propsRef = useRef(props);
  propsRef.current = props;

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_bass: { value: 0 },
      u_energy: { value: 0 },
    }),
    []
  );

  useFrame(({ clock, size }) => {
    const { mouseX, mouseY, bassLevel, overallLevel } = propsRef.current;

    // Smooth mouse interpolation (runs at frame rate)
    mouseRef.current.x += (((mouseX + 1) * 0.5) - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (((mouseY + 1) * 0.5) - mouseRef.current.y) * 0.05;

    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.u_resolution.value.set(size.width, size.height);
    uniforms.u_bass.value = bassLevel;
    uniforms.u_energy.value = overallLevel;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

function NebulaShaderInner(props: WallpaperProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{ antialias: false, alpha: false }}
        camera={{ position: [0, 0, 1] }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 1.5]}
      >
        <NebulaMesh {...props} />
      </Canvas>
    </div>
  );
}

export const NebulaShader = memo(NebulaShaderInner);
