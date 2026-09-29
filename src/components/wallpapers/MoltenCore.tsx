// ═══════════════════════════════════════════════════════════
// WARRIOR OS — "Molten Core" wallpaper (id: molten)
// WebGL: plates of cracked, dark forged rock over a river of magma. Lava
// crawls through the cracks (domain-warped noise advected along them),
// its heat bleeds onto the plate edges, and the whole core breathes with
// a slow ember pulse; the pointer is a faint heat source. Raw WebGL (one
// full-screen triangle, no three.js). Renders below device resolution
// and drops further if frames run long.
// Fallback (no hardware WebGL, or the shader fails): a 2D canvas that
// bakes the same cracked-rock picture once and only pulses its glow.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { EMBER, INK, STEEL } from '@/styles/tokens';
import { hasWebGL } from './webgl-support';
import {
  glowSprite,
  makeLayer,
  prefersReducedMotion,
  rgb,
  seeded,
  useCanvasScene,
  type CanvasScene,
} from './canvas-scene';

/** Token hex → GLSL vec3 literal. */
function vec3(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3));
  return `vec3(${c.join(', ')})`;
}

const VERT = /* glsl */ `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_bass;

const vec3 INK   = ${vec3(INK[950])};
const vec3 ROCK0 = ${vec3(STEEL[950])};
const vec3 ROCK1 = ${vec3(STEEL[800])};
const vec3 ROCK2 = ${vec3(STEEL[600])};
const vec3 E800  = ${vec3(EMBER[800])};
const vec3 E700  = ${vec3(EMBER[700])};
const vec3 E600  = ${vec3(EMBER[600])};
const vec3 E500  = ${vec3(EMBER[500])};
const vec3 E400  = ${vec3(EMBER[400])};
const vec3 E200  = ${vec3(EMBER[200])};
const vec3 E100  = ${vec3(EMBER[100])};

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { f += a * noise(p); p = p * 2.07 + 1.7; a *= 0.5; }
  return f;
}
// x: distance to nearest cell point, y: distance to the cell border (F2 - F1)
vec2 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash2(n + g) * 0.85 + 0.075;
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(sqrt(d1), sqrt(d2) - sqrt(d1));
}
vec3 heatRamp(float h) {
  vec3 c = mix(E800, E700, smoothstep(0.0, 0.2, h));
  c = mix(c, E600, smoothstep(0.2, 0.4, h));
  c = mix(c, E500, smoothstep(0.4, 0.58, h));
  c = mix(c, E400, smoothstep(0.58, 0.74, h));
  c = mix(c, E200, smoothstep(0.74, 0.9, h));
  return mix(c, E100, smoothstep(0.9, 1.05, h));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  p += u_mouse * 0.035;              // gentle parallax
  float t = u_time;

  // Irregular plates: warp the lattice with low-frequency noise.
  vec2 q = p * 3.1;
  vec2 warp = vec2(fbm(q * 0.55 + 3.1), fbm(q * 0.55 + 9.7)) - 0.5;
  vec2 wq = q + warp * 1.35;
  vec2 v = voronoi(wq);
  vec2 v2 = voronoi(wq * 2.35 + 4.2);

  // Crack widths vary along their length; fine hairline cracks only in places.
  float wobble = fbm(wq * 1.7);
  float width = mix(0.035, 0.16, wobble * wobble * 1.6);
  float crack = 1.0 - smoothstep(0.0, width, v.y);
  float fineMask = smoothstep(0.45, 0.7, fbm(q * 0.9 + 12.0));
  float fine = (1.0 - smoothstep(0.0, 0.05, v2.y)) * fineMask * 0.8;

  // Magma: noise advected along the cracks, slow bright pulses.
  vec2 flowUv = wq * 1.6 + vec2(t * 0.05, -t * 0.09);
  float flow = fbm(flowUv + fbm(flowUv * 1.3 - t * 0.04) * 1.2);
  float pulse = 0.82 + 0.18 * sin(t * 0.7 + wobble * 6.28) + u_bass * 0.25;
  float glowSpot = smoothstep(0.9, 0.0, length(p - vec2(-0.25, -0.35)));   // the core, lower left
  float glowSpot2 = smoothstep(0.7, 0.0, length(p - vec2(0.55, 0.3))) * 0.6;
  vec2 m = u_mouse * vec2(aspect, 1.0) * 0.5;
  float mouseHeat = smoothstep(0.45, 0.0, length(p - m)) * 0.35;
  float heatField = 0.35 + glowSpot * 0.55 + glowSpot2 * 0.35 + mouseHeat;

  float lavaHeat = clamp((0.12 + flow * flow * 1.9) * heatField * pulse, 0.0, 1.25);

  // Rock: lit plates with a bumpy, forged surface; darker toward the cracks.
  float bump = fbm(wq * 3.0 + 20.0);
  float bumpX = fbm((wq + vec2(0.04, 0.0)) * 3.0 + 20.0);
  float bumpY = fbm((wq + vec2(0.0, 0.04)) * 3.0 + 20.0);
  vec3 nrm = normalize(vec3(bump - bumpX, bump - bumpY, 0.12));
  float light = clamp(dot(nrm, normalize(vec3(-0.5, 0.6, 0.6))), 0.0, 1.0);
  float plateShade = smoothstep(0.0, 0.5, v.y) * (0.7 + 0.3 * hash(floor(wq + 0.5)));
  vec3 rock = mix(ROCK0, ROCK1, bump * 0.9 * plateShade);
  rock += ROCK2 * pow(light, 5.0) * 0.18 * plateShade;

  // Heat bleeding onto plate edges (under-glow).
  float bleed = exp(-v.y * 11.0) * lavaHeat;
  rock = mix(rock, rock * 0.4 + E700 * 0.7, clamp(bleed * 0.55, 0.0, 1.0));
  rock += E600 * exp(-v.y * 4.5) * lavaHeat * 0.18;
  rock += E500 * pow(light, 3.0) * exp(-v.y * 6.0) * lavaHeat * 0.35; // rims catch the glow

  vec3 lava = heatRamp(lavaHeat * (0.55 + 0.6 * crack));
  vec3 col = mix(rock, lava, crack);
  col = mix(col, heatRamp(lavaHeat * 0.75), fine * (1.0 - crack));

  // Heat haze glow over the whole core.
  col += E700 * glowSpot * 0.10 * pulse;
  col += E600 * mouseHeat * 0.12;

  // Vignette into ink, dither against banding.
  float vig = smoothstep(1.25, 0.2, length((uv - 0.5) * vec2(aspect * 0.85, 1.0)));
  col = mix(INK, col, mix(0.3, 1.0, vig));
  col += (hash(frag + fract(t) * 37.0) - 0.5) / 255.0;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

// ─── WebGL renderer ───

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function MoltenShader({ props, onFail }: { props: WallpaperProps; onFail: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });
  const failRef = useRef(onFail);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!gl) {
      failRef.current();
      return;
    }
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) {
      failRef.current();
      return;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      failRef.current();
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uBass = gl.getUniformLocation(prog, 'u_bass');

    const reduce = prefersReducedMotion();
    // Render scale (of CSS px). Soft magma hides the upscale; it steps
    // down if the GPU can't keep ~40 fps.
    let scale = Math.min(window.devicePixelRatio || 1, 1) * 0.8;
    let raf = 0;
    let last = 0;
    let t = reduce ? 40 : 8;
    let slow = 0;
    const mouse = { x: 0, y: 0 };

    const resize = () => {
      canvas.width = Math.max(1, Math.round(window.innerWidth * scale));
      canvas.height = Math.max(1, Math.round(window.innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (reduce || !raf) draw(0);
    };
    const draw = (dt: number) => {
      const p = propsRef.current;
      const k = reduce ? 1 : 1 - Math.exp(-dt * 3);
      mouse.x += ((Number.isFinite(p.mouseX) ? p.mouseX : 0) - mouse.x) * k;
      mouse.y += ((Number.isFinite(p.mouseY) ? p.mouseY : 0) - mouse.y) * k;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouse.x, -mouse.y);
      gl.uniform1f(uBass, p.bassLevel || 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      const raw = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      const dt = Math.min(raw, 1 / 20);
      // Adaptive resolution: sustained long frames → render smaller.
      slow = raw > 0.026 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45 && scale > 0.45) {
        scale *= 0.8;
        slow = 0;
        resize();
      }
      t += dt;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduce || raf || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      failRef.current();
    };

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

// ─── 2D fallback: baked cracked rock, pulsing glow ───

function createMoltenFallback(): CanvasScene {
  let w = 1;
  let h = 1;
  let rock: HTMLCanvasElement | null = null;
  let glow: HTMLCanvasElement | null = null;
  let heat: HTMLCanvasElement | null = null;

  return {
    resize(nw, nh) {
      w = nw;
      h = nh;
      // Voronoi on a coarse grid (1 cell = 4 CSS px), then upscaled.
      const gw = Math.ceil(w / 4);
      const gh = Math.ceil(h / 4);
      const rand = seeded(1337);
      const cell = 70; // grid px per plate
      const seeds: number[] = [];
      for (let y = -cell; y < gh + cell; y += cell)
        for (let x = -cell; x < gw + cell; x += cell) seeds.push(x + rand() * cell, y + rand() * cell);
      const rockImg = new ImageData(gw, gh);
      const glowImg = new ImageData(gw, gh);
      const cols = Math.ceil((gw + 2 * cell) / cell);
      const [r0, g0, b0] = rgb(STEEL[950]).split(',').map(Number);
      const [r1, g1, b1] = rgb(STEEL[800]).split(',').map(Number);
      const lava = [EMBER[800], EMBER[700], EMBER[600], EMBER[500], EMBER[400], EMBER[200]].map((hx) =>
        rgb(hx).split(',').map(Number),
      );
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          // Warp the lattice so plates are irregular and cracks wander.
          const sx = x + 9 * Math.sin(y * 0.045 + 1.3) + 5 * Math.sin(y * 0.11 + x * 0.03);
          const sy = y + 9 * Math.sin(x * 0.05) + 5 * Math.sin(x * 0.13 - y * 0.04);
          const cx = Math.floor((sx + cell) / cell);
          const cy = Math.floor((sy + cell) / cell);
          let d1 = 1e9;
          let d2 = 1e9;
          for (let j = cy - 1; j <= cy + 1; j++) {
            for (let i = cx - 1; i <= cx + 1; i++) {
              if (i < 0 || j < 0 || i >= cols) continue;
              const k = (j * cols + i) * 2;
              if (k >= seeds.length) continue;
              const dx = seeds[k] - sx;
              const dy = seeds[k + 1] - sy;
              const d = dx * dx + dy * dy;
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) d2 = d;
            }
          }
          const edge = Math.sqrt(d2) - Math.sqrt(d1); // grid px to the crack
          const o = (y * gw + x) * 4;
          const shade = Math.min(1, edge / 14) * (0.55 + 0.45 * Math.sin(x * 0.05 + y * 0.07) ** 2);
          rockImg.data[o] = r0 + (r1 - r0) * shade;
          rockImg.data[o + 1] = g0 + (g1 - g0) * shade;
          rockImg.data[o + 2] = b0 + (b1 - b0) * shade;
          rockImg.data[o + 3] = 255;
          // Lava in the crack, heat fading onto the edges; hotter near the lower-left core.
          const core = Math.max(0, 1 - Math.hypot(x / gw - 0.35, y / gh - 0.75) * 1.4);
          const hIdx = Math.max(0, Math.min(1, 0.35 + core * 0.7));
          const wv = 0.5 + 0.5 * Math.sin(x * 0.021 + y * 0.017) * Math.sin(x * 0.013 - y * 0.029);
          const crack = Math.max(0, 1 - edge / (0.7 + wv * 2.8));
          const bleed = Math.exp(-edge / (1.5 + wv * 2.5)) * 0.5;
          const a = Math.min(1, crack + bleed) * (0.55 + core * 0.45);
          const c = lava[Math.min(lava.length - 1, Math.floor(hIdx * crack * (lava.length - 0.01) + bleed))];
          glowImg.data[o] = c[0];
          glowImg.data[o + 1] = c[1];
          glowImg.data[o + 2] = c[2];
          glowImg.data[o + 3] = a * 255;
        }
      }
      const put = (img: ImageData) => {
        const c = document.createElement('canvas');
        c.width = gw;
        c.height = gh;
        c.getContext('2d')!.putImageData(img, 0, 0);
        return c;
      };
      const rockSmall = put(rockImg);
      const glowSmall = put(glowImg);
      const r = makeLayer(w, h, 1);
      r.ctx.imageSmoothingQuality = 'high';
      r.ctx.drawImage(rockSmall, 0, 0, w, h);
      rock = r.canvas;
      const g = makeLayer(w, h, 1);
      g.ctx.imageSmoothingQuality = 'high';
      // Soft heat halo under the sharp cracks.
      g.ctx.filter = 'blur(10px)';
      g.ctx.globalAlpha = 0.9;
      g.ctx.drawImage(glowSmall, 0, 0, w, h);
      g.ctx.filter = 'none';
      g.ctx.globalAlpha = 1;
      g.ctx.globalCompositeOperation = 'lighter';
      g.ctx.drawImage(glowSmall, 0, 0, w, h);
      g.ctx.globalCompositeOperation = 'source-over';
      glow = g.canvas;
      heat = glowSprite(256, rgb(EMBER[600]), 0.7);
    },
    frame(ctx, t, _dt, input) {
      if (!rock || !glow) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK[950];
      ctx.fillRect(0, 0, w, h);
      const ox = input.mx * 8;
      const oy = input.my * 6;
      ctx.drawImage(rock, ox - 10, oy - 8, w + 20, h + 16);
      const pulse = 0.78 + 0.16 * Math.sin(t * 0.7) + 0.06 * Math.sin(t * 1.9) + input.bass * 0.2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pulse;
      ctx.drawImage(glow, ox - 10, oy - 8, w + 20, h + 16);
      if (heat) {
        ctx.globalAlpha = 0.28 * pulse;
        ctx.drawImage(heat, w * 0.35 - w * 0.5, h * 0.75 - h * 0.5, w, h);
      }
      ctx.globalCompositeOperation = 'source-over';
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(${rgb(INK[950])}, 0.7)`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    },
  };
}

function MoltenFallback(props: WallpaperProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasScene(ref, props, createMoltenFallback, { maxDpr: 1 });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function MoltenCoreInner(props: WallpaperProps) {
  const [webgl, setWebgl] = useState(() => hasWebGL());
  return webgl ? <MoltenShader props={props} onFail={() => setWebgl(false)} /> : <MoltenFallback {...props} />;
}

export const MoltenCore = memo(MoltenCoreInner);
