// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Aurora Shader Wallpaper
// GLSL: three slow aurora curtains (a bright plasma-mint hem, rays that
// cool to violet as they rise) over an ink night sky with sparse stars
// and a dark horizon ridge rimmed with aurora light. Gentle pointer
// parallax, a soft audio swell. Dithered (no banding).
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
  uniform vec2 u_resolution;
  uniform float u_bass;

  varying vec2 vUv;

  // FORGE HUD palette
  const vec3 SKY_TOP  = vec3(0.016, 0.024, 0.043); // ink-950
  const vec3 SKY_LOW  = vec3(0.028, 0.047, 0.080); // ink-850, cooled toward the horizon
  const vec3 LAND     = vec3(0.010, 0.014, 0.024);
  const vec3 PLASMA   = vec3(0.184, 0.839, 0.961); // plasma-400
  const vec3 MINT     = vec3(0.239, 0.863, 0.592); // success / mint
  const vec3 VIOLET   = vec3(0.655, 0.545, 0.980); // viz-3
  const vec3 STAR     = vec3(0.860, 0.910, 0.970);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float f = 0.0;
    f += 0.5 * noise(p); p *= 2.01;
    f += 0.25 * noise(p); p *= 2.02;
    f += 0.125 * noise(p); p *= 2.03;
    f += 0.0625 * noise(p);
    return f;
  }

  // Sparse stars, one candidate per cell
  float stars(vec2 p, float density, float t) {
    vec2 g = p * density;
    vec2 id = floor(g);
    float h = hash(id);
    if (h < 0.96) return 0.0;
    vec2 off = vec2(hash(id + 13.1), hash(id + 29.7)) - 0.5;
    float d = length(fract(g) - 0.5 - off * 0.7);
    float twinkle = 0.65 + 0.35 * sin(t * (0.5 + h * 2.0) + h * 50.0);
    return smoothstep(0.08, 0.0, d) * twinkle * ((h - 0.96) / 0.04);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    float x = uv.x * aspect;
    float t = u_time * 0.05;
    vec2 par = (u_mouse - 0.5) * vec2(0.04, 0.025);

    // Night sky: ink, a little cooler toward the horizon
    vec3 col = mix(SKY_LOW, SKY_TOP, smoothstep(0.1, 0.85, uv.y));
    float s = stars(vec2(x, uv.y) + par * 0.3, 60.0, u_time) * 0.6
            + stars(vec2(x, uv.y) * 1.6 + par * 0.6, 95.0, u_time) * 0.35;
    col += STAR * s * smoothstep(0.2, 0.55, uv.y);

    // Curtains: a bright lower hem, rays fading upward, plasma → violet
    float glow = 0.0;
    vec3 light = vec3(0.0);
    for (float i = 0.0; i < 3.0; i++) {
      float drift = t * (1.0 + i * 0.35);
      float hem = 0.44 + i * 0.07 + par.y
        + sin((x + par.x) * (1.1 + i * 0.3) + drift * 1.7 + i * 2.1) * 0.055
        + (fbm(vec2((x + par.x) * 0.9 + drift * 0.6, i * 3.7)) - 0.5) * 0.2;
      float d = uv.y - hem;
      // Vertical rays: noise along x only, sharpened, drifting sideways
      float rays = fbm(vec2((x + par.x) * 9.0 + drift * 1.4 + i * 7.0, drift * 0.3));
      rays = smoothstep(0.25, 0.85, rays);
      float fold = 0.55 + 0.45 * sin((x + par.x) * (2.3 + i) - drift * 2.0 + i * 1.3);
      float curtain = smoothstep(-0.015, 0.012, d) * exp(-max(d, 0.0) * (3.6 + i * 1.2)) * (0.15 + 1.1 * rays) * fold;
      float edge = exp(-abs(d) * 70.0) * 0.4 * (0.4 + 0.6 * rays) * fold;
      // Light scattered below the hem, so the curtain has no hard floor
      float scatter = exp(-max(-d, 0.0) * 14.0) * step(d, 0.0) * 0.22 * fold;
      float strength = (0.24 - i * 0.055) * (1.0 + u_bass * 0.35);
      vec3 base = mix(MINT, PLASMA, 0.7 + 0.3 * sin(x * 0.7 + i));
      vec3 hue = mix(base, VIOLET, smoothstep(0.02, 0.26, d));
      light += hue * (curtain + edge) * strength + base * scatter * strength;
      glow += (curtain + edge + scatter) * strength;
    }
    col += light;

    // Horizon ridge with a thin rim of aurora light
    float ridge = 0.13 + (fbm(vec2(x * 1.8 + 3.0, 7.0)) - 0.5) * 0.09 + sin(x * 1.3 + 0.8) * 0.012;
    float land = smoothstep(ridge + 0.0025, ridge - 0.0025, uv.y);
    col = mix(col, LAND + light * 0.04, land);
    col += PLASMA * exp(-abs(uv.y - ridge) * 240.0) * (0.02 + glow * 0.12);

    // Vignette
    float vig = smoothstep(1.35, 0.3, length((uv - vec2(0.5, 0.55)) * vec2(aspect * 0.8, 1.0)));
    col *= mix(0.55, 1.0, vig);

    // Dither: no banding in the dark gradients
    col += (hash(gl_FragCoord.xy + fract(u_time * 0.37) * 91.0) - 0.5) / 255.0;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;

function AuroraMesh(props: WallpaperProps) {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const propsRef = useRef(props);
  propsRef.current = props;

  // useState initializer pattern — stable identity, R3F-friendly mutation in useFrame.
  const [uniforms] = useState(() => ({
    u_time: { value: 0 },
    u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_bass: { value: 0 },
  }));

  useFrame(({ clock, size }) => {
    const { mouseX, mouseY, bassLevel } = propsRef.current;

    mouseRef.current.x += (((mouseX + 1) * 0.5) - mouseRef.current.x) * 0.05;
    mouseRef.current.y += (((mouseY + 1) * 0.5) - mouseRef.current.y) * 0.05;

    // Canonical R3F pattern: useFrame mutates uniform `.value` each frame.
    // React Compiler flags the useState-stored container as immutable, but
    // shaderMaterial expects in-place mutation — the entire R3F ecosystem
    // relies on this idiom. Disable is intentional and scoped.
    /* eslint-disable react-hooks/immutability */
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.u_resolution.value.set(size.width, size.height);
    uniforms.u_bass.value = bassLevel;
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

function AuroraShaderInner(props: WallpaperProps) {
  return (
    <div className="absolute inset-0">
      <Canvas
        gl={{ antialias: false, alpha: false }}
        camera={{ position: [0, 0, 1] }}
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 1.5]}
      >
        <AuroraMesh {...props} />
      </Canvas>
    </div>
  );
}

export const AuroraShader = memo(AuroraShaderInner);
