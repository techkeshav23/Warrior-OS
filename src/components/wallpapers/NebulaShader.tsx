// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Nebula Shader Wallpaper
// React Three Fiber + GLSL: a domain-warped fBm nebula in the FORGE HUD
// palette: deep ink, plasma gas and filaments, a whisper of violet, one
// distant ember glow, two depths of star dust. Slow drift, a faint
// pointer lift and a gentle audio swell. Dithered (no banding).
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useRef, useState } from 'react';
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

  // FORGE HUD palette (linear-ish RGB of the brand tokens)
  const vec3 INK      = vec3(0.016, 0.024, 0.043); // ink-950
  const vec3 INK_BLUE = vec3(0.030, 0.052, 0.090); // ink-850, cooled
  const vec3 PLASMA   = vec3(0.184, 0.839, 0.961); // plasma-400
  const vec3 PLASMA_D = vec3(0.043, 0.561, 0.678); // plasma-600
  const vec3 VIOLET   = vec3(0.655, 0.545, 0.980); // viz-3
  const vec3 EMBER    = vec3(1.000, 0.541, 0.239); // ember-400
  const vec3 STAR     = vec3(0.860, 0.910, 0.970); // fg, a touch cooler

  // Simplex noise
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

  // Fractal Brownian Motion: 5 octaves for the gas, 3 for the warp field
  float fbm(vec2 p) {
    float f = 0.0;
    float w = 0.5;
    for (int i = 0; i < 5; i++) {
      f += w * snoise(p);
      p = p * 2.02 + vec2(1.7, 9.2);
      w *= 0.5;
    }
    return f;
  }
  float fbm3(vec2 p) {
    float f = 0.5 * snoise(p);
    p = p * 2.03 + vec2(3.1, 4.7);
    f += 0.25 * snoise(p);
    p = p * 2.01 + vec2(8.3, 2.8);
    f += 0.125 * snoise(p);
    return f;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Sparse star dust, one candidate per cell
  float stars(vec2 p, float density) {
    vec2 g = p * density;
    vec2 id = floor(g);
    float h = hash(id);
    if (h < 0.955) return 0.0;
    vec2 off = vec2(hash(id + 17.3), hash(id + 41.9)) - 0.5;
    float d = length(fract(g) - 0.5 - off * 0.7);
    float twinkle = 0.7 + 0.3 * sin(u_time * (0.4 + h * 1.6) + h * 60.0);
    return smoothstep(0.075, 0.0, d) * twinkle * ((h - 0.955) / 0.045);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    vec2 p = vec2(uv.x * aspect, uv.y);
    vec2 par = (u_mouse - 0.5) * 0.035;

    float t = u_time * 0.035;

    // Domain-warped gas
    vec2 q = vec2(fbm3(p * 0.9 + par + vec2(t, 0.0)), fbm3(p * 0.9 - par + vec2(5.2, 1.3) - t * 0.7));
    float gas = fbm(p * 1.15 + q * 1.3 + vec2(t * 0.5, -t * 0.35));
    float wisp = fbm3(p * 2.3 - q * 1.2 + vec2(11.7, 3.3) - t * 0.25);

    // Composition: the gas gathers in a soft diagonal band (lower left →
    // upper right) and thins out toward the corners, like a galactic arm.
    float arm = uv.y - (0.18 + uv.x * 0.62 + sin(uv.x * 3.1 + 0.6) * 0.06);
    float band = exp(-arm * arm * 9.0);

    float density = smoothstep(-0.3, 0.75, gas) * mix(0.22, 1.0, band);
    float filament = smoothstep(0.2, 0.8, wisp) * density;

    // Deep ink, cooler where the gas is
    vec3 col = mix(INK, INK_BLUE, smoothstep(0.0, 0.9, density));
    col += PLASMA_D * density * density * 0.2;
    // Soft luminous arm under the gas, plasma cooling to violet
    col += mix(PLASMA_D, VIOLET, smoothstep(0.1, 0.9, uv.x)) * band * (0.025 + density * 0.045);
    col += PLASMA * filament * filament * 0.16;
    col += VIOLET * smoothstep(0.05, 0.7, q.y) * density * 0.07;

    // A distant forge: restrained ember light low on the right
    float forge = exp(-3.2 * length((p - vec2(aspect * 0.84, 0.08)) * vec2(0.75, 1.5)));
    col += EMBER * forge * (0.045 + 0.035 * density);

    // Pointer: the faintest plasma lift where the cursor rests
    float md = distance(p, vec2(u_mouse.x * aspect, u_mouse.y));
    col += PLASMA * 0.018 * smoothstep(0.45, 0.0, md);

    // Audio: a gentle swell, never a flash
    col *= 1.0 + u_bass * 0.22 + u_energy * 0.06;

    // Two depths of stars, dimmed inside the brightest gas
    float s = stars(p + par * 0.4, 70.0) * 0.7 + stars(p * 1.7 + par, 110.0) * 0.4;
    col += STAR * s * (1.0 - filament * 0.6);

    // Vignette
    float vig = smoothstep(1.3, 0.3, length((uv - 0.5) * vec2(aspect * 0.85, 1.0)));
    col *= mix(0.5, 1.0, vig);

    // Dither: no banding in the dark gradients
    col += (hash(gl_FragCoord.xy + fract(u_time * 0.37) * 91.0) - 0.5) / 255.0;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

// ─── Shader Mesh ───
function NebulaMesh(props: WallpaperProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const propsRef = useRef(props);
  propsRef.current = props;

  // useState initializer runs exactly once → stable identity for shader uniforms.
  // useFrame mutates inner `.value` properties; the outer object is never replaced.
  // This is the canonical R3F pattern and works with React Compiler.
  const [uniforms] = useState(() => ({
    u_time: { value: 0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_bass: { value: 0 },
    u_energy: { value: 0 },
  }));

  useFrame(({ clock, size }) => {
    const { mouseX, mouseY, bassLevel, overallLevel } = propsRef.current;

    mouseRef.current.x += (((mouseX + 1) * 0.5) - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (((mouseY + 1) * 0.5) - mouseRef.current.y) * 0.05;

    // Canonical R3F pattern: useFrame mutates uniform `.value` each frame.
    /* eslint-disable react-hooks/immutability */
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.u_resolution.value.set(size.width, size.height);
    uniforms.u_bass.value = bassLevel;
    uniforms.u_energy.value = overallLevel;
    /* eslint-enable react-hooks/immutability */
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
