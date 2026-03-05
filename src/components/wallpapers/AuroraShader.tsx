// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Aurora Shader Wallpaper
// GLSL sine waves with noise, green/purple bands, star layer
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
  uniform vec2 u_resolution;
  uniform float u_bass;
  
  varying vec2 vUv;
  
  // Hash for pseudo-random stars
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  // Simple noise
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
  
  // Star field layer
  float stars(vec2 uv, float t) {
    float s = 0.0;
    for (float i = 0.0; i < 3.0; i++) {
      vec2 p = uv * (100.0 + i * 50.0);
      float h = hash(floor(p));
      if (h > 0.97) {
        float twinkle = sin(t * (h * 3.0 + 1.0) + h * 6.28) * 0.5 + 0.5;
        float d = length(fract(p) - 0.5);
        s += smoothstep(0.05, 0.0, d) * twinkle * (1.0 - i * 0.2);
      }
    }
    return s;
  }
  
  void main() {
    vec2 uv = vUv;
    float aspect = u_resolution.x / u_resolution.y;
    float time = u_time * 0.15;
    
    // Star layer (background)
    vec3 color = vec3(0.01, 0.01, 0.03);
    float starField = stars(uv * vec2(aspect, 1.0), u_time);
    color += starField * vec3(0.6, 0.7, 1.0) * 0.5;
    
    // Aurora bands — multiple sine waves with noise displacement
    float auroraY = uv.y;
    
    // Parallax with mouse
    float mx = u_mouse.x * 0.05;
    float my = u_mouse.y * 0.03;
    
    for (float i = 0.0; i < 4.0; i++) {
      float offset = i * 0.12;
      float speed = 0.3 + i * 0.1;
      float freq = 2.0 + i * 0.5;
      
      // Sine wave with noise displacement
      float wave = sin((uv.x * aspect + mx) * freq + time * speed + fbm(vec2(uv.x * 3.0 + time * 0.2, i)) * 2.0) * 0.08;
      wave += fbm(vec2(uv.x * 2.0 + time * 0.1, i + time * 0.05)) * 0.06;
      
      // Band position
      float bandY = 0.55 + offset + wave + my;
      float bandDist = abs(auroraY - bandY);
      
      // Soft band width with noise
      float bandWidth = 0.02 + fbm(vec2(uv.x * 4.0 + time * 0.3, i)) * 0.03;
      float band = smoothstep(bandWidth * 2.0, 0.0, bandDist);
      
      // Audio reactivity
      band *= 1.0 + u_bass * 0.5;
      
      // Color: green → cyan → purple transition
      vec3 auroraColor;
      if (i < 1.5) {
        auroraColor = mix(vec3(0.0, 0.8, 0.3), vec3(0.0, 0.6, 0.8), fract(uv.x + time * 0.1));
      } else {
        auroraColor = mix(vec3(0.0, 0.5, 0.7), vec3(0.4, 0.1, 0.6), fract(uv.x + time * 0.15));
      }
      
      // Fade with height variation
      float fade = fbm(vec2(uv.x * 5.0 + time * 0.2, auroraY * 3.0)) * 0.5 + 0.5;
      color += auroraColor * band * fade * (0.3 - i * 0.05);
    }
    
    // Vertical fade — aurora mostly in upper 60%
    color *= smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.5, uv.y);
    
    // Subtle bottom reflection
    if (uv.y < 0.15) {
      float reflectY = 0.15 - uv.y;
      vec3 reflected = color * 0.1 * smoothstep(0.15, 0.0, reflectY);
      color += reflected;
    }
    
    // Vignette
    float vig = 1.0 - smoothstep(0.5, 1.3, length((vUv - 0.5) * 1.8));
    color *= vig;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

function AuroraMesh(props: WallpaperProps) {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  mouseRef.current.x += (((props.mouseX + 1) * 0.5) - mouseRef.current.x) * 0.05;
  mouseRef.current.y += (((props.mouseY + 1) * 0.5) - mouseRef.current.y) * 0.05;

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_bass: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    uniforms.u_time.value = clock.getElapsedTime();
    uniforms.u_mouse.value.set(mouseRef.current.x, mouseRef.current.y);
    uniforms.u_bass.value = props.bassLevel;
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
