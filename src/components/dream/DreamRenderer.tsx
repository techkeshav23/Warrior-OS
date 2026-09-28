// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Renderer
// Full-screen canvas scene for the dream's 5 seconds. Subject motifs
// drift slowly with a soft glow and particle trails: DBMS → floating
// tables + glowing SQL, OS → spinning process diagrams, CN → packets
// travelling between routers, Algorithms → bars re-arranging (bubble
// sort), idle/void → a dark void with distant twinkling stars and fog.
// Ambient colour = the subject's accent. All canvas + rAF work lives
// in an effect (SSR-safe); no React state changes per frame.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import type { DreamElement, DreamObjectKind, DreamScene } from '@/types/dream';
import { getDreamTheme } from '@/data/dream-themes';

interface DreamRendererProps {
  scene: DreamScene;
}

const TAU = Math.PI * 2;

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '0,240,255';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Per-element runtime state that changes frame to frame. */
interface Runtime {
  el: DreamElement;
  x: number; // normalised
  y: number;
  rgb: string;
  trail: { x: number; y: number }[];
  lastTrail: number;
  bars: number[];
  sortI: number;
  sortJ: number;
  lastSort: number;
}

function initialBars(seed: number): number[] {
  const bars = [0.3, 0.55, 0.8, 0.45, 1, 0.65, 0.2, 0.9];
  // deterministic shuffle
  let s = Math.floor(seed * 1000) + 7;
  for (let i = bars.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [bars[i], bars[j]] = [bars[j], bars[i]];
  }
  return bars;
}

/** One bubble-sort comparison per step; reshuffle when sorted. */
function stepSort(rt: Runtime) {
  const b = rt.bars;
  if (rt.sortI >= b.length - 1) {
    rt.bars = initialBars(rt.lastSort % 997);
    rt.sortI = 0;
    rt.sortJ = 0;
    return;
  }
  if (b[rt.sortJ] > b[rt.sortJ + 1]) [b[rt.sortJ], b[rt.sortJ + 1]] = [b[rt.sortJ + 1], b[rt.sortJ]];
  rt.sortJ += 1;
  if (rt.sortJ >= b.length - 1 - rt.sortI) {
    rt.sortJ = 0;
    rt.sortI += 1;
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, rgb: string, a: number) {
  ctx.font = `${Math.max(9, Math.round(px))}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(${rgb},${a})`;
  ctx.fillText(text, x, y);
}

/** Draw one motif centred on the origin. */
function drawKind(ctx: CanvasRenderingContext2D, kind: DreamObjectKind, s: number, t: number, rt: Runtime, a: number) {
  const rgb = rt.rgb;
  const stroke = `rgba(${rgb},${0.95 * a})`;
  const fill = `rgba(${rgb},${0.22 * a})`;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = Math.max(1, s * 0.035);

  switch (kind) {
    case 'floating-table': {
      const w = s * 1.2;
      const h = s * 0.8;
      ctx.fillRect(-w / 2, -h / 2, w, h * 0.22);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      for (let r = 1; r < 4; r++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + (h * r) / 4 + h * 0.02);
        ctx.lineTo(w / 2, -h / 2 + (h * r) / 4 + h * 0.02);
        ctx.stroke();
      }
      for (let c = 1; c < 3; c++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + (w * c) / 3, -h / 2);
        ctx.lineTo(-w / 2 + (w * c) / 3, h / 2);
        ctx.stroke();
      }
      label(ctx, 'id', -w / 3, -h / 2 + h * 0.11, s * 0.13, rgb, a);
      label(ctx, 'name', 0, -h / 2 + h * 0.11, s * 0.13, rgb, a);
      label(ctx, 'score', w / 3, -h / 2 + h * 0.11, s * 0.13, rgb, a);
      break;
    }
    case 'database-cylinder': {
      const w = s * 0.7;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.35, w / 2, s * 0.12, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      for (const y of [0, s * 0.35]) {
        ctx.beginPath();
        ctx.ellipse(0, y, w / 2, s * 0.12, 0, 0, Math.PI);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-w / 2, -s * 0.35);
      ctx.lineTo(-w / 2, s * 0.35);
      ctx.moveTo(w / 2, -s * 0.35);
      ctx.lineTo(w / 2, s * 0.35);
      ctx.stroke();
      break;
    }
    case 'er-diagram-web': {
      const nodes: [number, number][] = [
        [-s * 0.5, -s * 0.25],
        [s * 0.5, -s * 0.25],
        [0, s * 0.35],
      ];
      ctx.beginPath();
      ctx.moveTo(nodes[0][0], nodes[0][1]);
      ctx.lineTo(nodes[1][0], nodes[1][1]);
      ctx.lineTo(nodes[2][0], nodes[2][1]);
      ctx.closePath();
      ctx.stroke();
      for (const [x, y] of nodes) {
        ctx.fillRect(x - s * 0.18, y - s * 0.1, s * 0.36, s * 0.2);
        ctx.strokeRect(x - s * 0.18, y - s * 0.1, s * 0.36, s * 0.2);
      }
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.37);
      ctx.lineTo(s * 0.1, -s * 0.25);
      ctx.lineTo(0, -s * 0.13);
      ctx.lineTo(-s * 0.1, -s * 0.25);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'process-diagram': {
      const R = s * 0.45;
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * TAU - Math.PI / 2;
        const x = Math.cos(ang) * R;
        const y = Math.sin(ang) * R;
        const nx = Math.cos(ang + TAU / 5) * R;
        const ny = Math.sin(ang + TAU / 5) * R;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        const active = Math.floor(t * 1.5) % 5 === i;
        ctx.fillStyle = active ? `rgba(${rgb},${0.7 * a})` : fill;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.14, 0, TAU);
        ctx.fill();
        ctx.stroke();
        label(ctx, `P${i + 1}`, x, y, s * 0.12, active ? '5,5,10' : rgb, a);
      }
      break;
    }
    case 'gantt-bar': {
      const lengths = [0.5, 0.8, 0.35, 0.65];
      lengths.forEach((l, i) => {
        const off = ((t * 0.15 + i * 0.2) % 1) * s * 0.3;
        ctx.fillStyle = `rgba(${rgb},${(0.25 + i * 0.12) * a})`;
        ctx.fillRect(-s * 0.6 + off, -s * 0.4 + i * s * 0.22, s * l, s * 0.15);
        ctx.strokeRect(-s * 0.6 + off, -s * 0.4 + i * s * 0.22, s * l, s * 0.15);
      });
      break;
    }
    case 'network-packet': {
      // Two routers with a packet travelling between them.
      const L = s * 0.9;
      ctx.beginPath();
      ctx.moveTo(-L / 2, 0);
      ctx.lineTo(L / 2, 0);
      ctx.stroke();
      for (const x of [-L / 2, L / 2]) {
        ctx.beginPath();
        ctx.arc(x, 0, s * 0.1, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      const p = (t * 0.7 + rt.el.phase) % 1;
      const px = -L / 2 + p * L;
      for (let k = 6; k >= 0; k--) {
        ctx.fillStyle = `rgba(${rgb},${(0.9 - k * 0.13) * a})`;
        ctx.beginPath();
        ctx.arc(px - k * s * 0.05, 0, s * 0.045 * (1 - k * 0.1), 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'router-node': {
      ctx.fillRect(-s * 0.35, -s * 0.15, s * 0.7, s * 0.3);
      ctx.strokeRect(-s * 0.35, -s * 0.15, s * 0.7, s * 0.3);
      for (const x of [-s * 0.2, s * 0.2]) {
        ctx.beginPath();
        ctx.moveTo(x, -s * 0.15);
        ctx.lineTo(x + s * 0.05, -s * 0.45);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = Math.sin(t * 6 + i * 1.7) > 0 ? `rgba(${rgb},${a})` : `rgba(${rgb},${0.2 * a})`;
        ctx.fillRect(-s * 0.25 + i * s * 0.14, -s * 0.03, s * 0.06, s * 0.06);
      }
      break;
    }
    case 'automaton-state': {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.24, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 0.38, s * 0.14, Math.PI * 0.8, Math.PI * 2.2);
      ctx.stroke();
      label(ctx, 'q1', 0, 0, s * 0.18, rgb, a);
      break;
    }
    case 'transition-arrow':
    case 'graph-edge': {
      const pts: [number, number][] = [
        [-s * 0.5, s * 0.2],
        [-s * 0.1, -s * 0.35],
        [s * 0.45, -s * 0.05],
        [s * 0.1, s * 0.4],
      ];
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.lineTo(pts[0][0], pts[0][1]);
      ctx.moveTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[3][0], pts[3][1]);
      ctx.stroke();
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.07, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'sorting-bar': {
      const n = rt.bars.length;
      const bw = (s * 1.1) / n;
      for (let i = 0; i < n; i++) {
        const h = rt.bars[i] * s * 0.9;
        const hot = i === rt.sortJ || i === rt.sortJ + 1;
        ctx.fillStyle = hot ? `rgba(255,255,255,${0.85 * a})` : `rgba(${rgb},${(0.35 + rt.bars[i] * 0.5) * a})`;
        ctx.fillRect(-s * 0.55 + i * bw + bw * 0.1, s * 0.45 - h, bw * 0.8, h);
      }
      break;
    }
    case 'tree-node': {
      const nodes: [number, number][] = [
        [0, -s * 0.4],
        [-s * 0.32, -s * 0.05],
        [s * 0.32, -s * 0.05],
        [-s * 0.5, s * 0.35],
        [-s * 0.15, s * 0.35],
        [s * 0.5, s * 0.35],
      ];
      const edges: [number, number][] = [
        [0, 1],
        [0, 2],
        [1, 3],
        [1, 4],
        [2, 5],
      ];
      ctx.beginPath();
      for (const [p, c] of edges) {
        ctx.moveTo(nodes[p][0], nodes[p][1]);
        ctx.lineTo(nodes[c][0], nodes[c][1]);
      }
      ctx.stroke();
      nodes.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.08, 0, TAU);
        ctx.fill();
        ctx.stroke();
      });
      break;
    }
    case 'linked-list': {
      for (let i = 0; i < 3; i++) {
        const x = -s * 0.6 + i * s * 0.45;
        ctx.fillRect(x, -s * 0.12, s * 0.28, s * 0.24);
        ctx.strokeRect(x, -s * 0.12, s * 0.28, s * 0.24);
        if (i < 2) {
          ctx.beginPath();
          ctx.moveTo(x + s * 0.28, 0);
          ctx.lineTo(x + s * 0.43, 0);
          ctx.lineTo(x + s * 0.38, -s * 0.05);
          ctx.moveTo(x + s * 0.43, 0);
          ctx.lineTo(x + s * 0.38, s * 0.05);
          ctx.stroke();
        }
      }
      break;
    }
    case 'logic-gate': {
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.3);
      ctx.lineTo(0, -s * 0.3);
      ctx.arc(0, 0, s * 0.3, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.15);
      ctx.lineTo(-s * 0.3, -s * 0.15);
      ctx.moveTo(-s * 0.55, s * 0.15);
      ctx.lineTo(-s * 0.3, s * 0.15);
      ctx.moveTo(s * 0.3, 0);
      ctx.lineTo(s * 0.55, 0);
      ctx.stroke();
      break;
    }
    case 'circuit-trace': {
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.3);
      ctx.lineTo(-s * 0.1, -s * 0.3);
      ctx.lineTo(-s * 0.1, s * 0.2);
      ctx.lineTo(s * 0.5, s * 0.2);
      ctx.moveTo(-s * 0.1, 0);
      ctx.lineTo(s * 0.3, 0);
      ctx.lineTo(s * 0.3, -s * 0.35);
      ctx.stroke();
      for (const [x, y] of [
        [-s * 0.5, -s * 0.3],
        [s * 0.5, s * 0.2],
        [s * 0.3, -s * 0.35],
      ] as [number, number][]) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.05, 0, TAU);
        ctx.fillStyle = `rgba(${rgb},${a})`;
        ctx.fill();
      }
      break;
    }
    case 'set-venn': {
      for (const [x, y] of [
        [-s * 0.15, -s * 0.08],
        [s * 0.15, -s * 0.08],
        [0, s * 0.17],
      ] as [number, number][]) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.28, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      break;
    }
    case 'matrix-grid': {
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 0.4);
      ctx.lineTo(-s * 0.48, -s * 0.4);
      ctx.lineTo(-s * 0.48, s * 0.4);
      ctx.lineTo(-s * 0.4, s * 0.4);
      ctx.moveTo(s * 0.4, -s * 0.4);
      ctx.lineTo(s * 0.48, -s * 0.4);
      ctx.lineTo(s * 0.48, s * 0.4);
      ctx.lineTo(s * 0.4, s * 0.4);
      ctx.stroke();
      const vals = ['2', '0', '1', '1', '3', '0', '4', '1', '2'];
      vals.forEach((v, i) => label(ctx, v, -s * 0.25 + (i % 3) * s * 0.25, -s * 0.25 + Math.floor(i / 3) * s * 0.25, s * 0.16, rgb, a));
      break;
    }
    case 'integral-symbol':
      label(ctx, '∫ f(x) dx', 0, 0, s * 0.3, rgb, a);
      break;
    case 'code-block': {
      ctx.fillRect(-s * 0.55, -s * 0.35, s * 1.1, s * 0.7);
      ctx.strokeRect(-s * 0.55, -s * 0.35, s * 1.1, s * 0.7);
      const widths = [0.7, 0.45, 0.85, 0.3];
      widths.forEach((w, i) => {
        ctx.fillStyle = `rgba(${rgb},${0.6 * a})`;
        ctx.fillRect(-s * 0.45 + (i % 2) * s * 0.08, -s * 0.25 + i * s * 0.15, s * w * 0.8, s * 0.06);
      });
      break;
    }
    case 'terminal-line':
      label(ctx, `$ run${Math.sin(t * 4) > 0 ? ' ▌' : ''}`, 0, 0, s * 0.22, rgb, a);
      break;
    case 'brace-glyph':
      label(ctx, '{ }', 0, 0, s * 0.5, rgb, a);
      break;
    case 'binary-stream':
      label(ctx, ((Math.floor(t * 3) % 2 === 0) ? '0110 1001' : '1001 0110'), 0, 0, s * 0.2, rgb, a);
      break;
    case 'kanban-card': {
      ctx.fillRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.6);
      ctx.strokeRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.6);
      ctx.fillStyle = `rgba(${rgb},${0.7 * a})`;
      ctx.fillRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.12);
      label(ctx, 'DONE', 0, s * 0.08, s * 0.16, rgb, a);
      break;
    }
    case 'rocket': {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.22, -s * 0.2, s * 0.15, s * 0.25);
      ctx.lineTo(-s * 0.15, s * 0.25);
      ctx.quadraticCurveTo(-s * 0.22, -s * 0.2, 0, -s * 0.5);
      ctx.fill();
      ctx.stroke();
      const flame = s * (0.25 + 0.1 * Math.sin(t * 20));
      ctx.fillStyle = `rgba(255,171,0,${0.8 * a})`;
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, s * 0.25);
      ctx.lineTo(0, s * 0.25 + flame);
      ctx.lineTo(s * 0.1, s * 0.25);
      ctx.fill();
      break;
    }
    case 'checkmark-orb': {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, 0);
      ctx.lineTo(-s * 0.03, s * 0.13);
      ctx.lineTo(s * 0.18, -s * 0.12);
      ctx.lineWidth = Math.max(1.5, s * 0.06);
      ctx.stroke();
      break;
    }
    case 'exam-sheet': {
      ctx.fillRect(-s * 0.32, -s * 0.42, s * 0.64, s * 0.84);
      ctx.strokeRect(-s * 0.32, -s * 0.42, s * 0.64, s * 0.84);
      for (let i = 0; i < 4; i++) {
        const y = -s * 0.28 + i * s * 0.18;
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, y);
        ctx.lineTo(s * 0.12, y);
        ctx.stroke();
        label(ctx, i % 3 === 2 ? '✗' : '✓', s * 0.22, y, s * 0.12, rgb, a);
      }
      break;
    }
    case 'clock-orb': {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.35, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t * 2) * s * 0.25, Math.sin(t * 2) * s * 0.25);
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t * 0.3) * s * 0.16, Math.sin(t * 0.3) * s * 0.16);
      ctx.stroke();
      break;
    }
    case 'star-cluster': {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + rt.el.phase;
        const r = s * (0.15 + (i % 3) * 0.12);
        ctx.fillStyle = `rgba(${rgb},${(0.5 + 0.5 * Math.sin(t * 3 + i)) * a})`;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, s * 0.035, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case 'nebula-swirl':
    case 'dark-fog': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
      g.addColorStop(0, `rgba(${rgb},${(kind === 'dark-fog' ? 0.12 : 0.3) * a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, TAU);
      ctx.fill();
      break;
    }
    case 'distant-stars':
    case 'void-particles': {
      ctx.fillStyle = `rgba(200,210,255,${(0.4 + 0.4 * Math.sin(t * 2 + rt.el.phase)) * a})`;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, s * 0.04), 0, TAU);
      ctx.fill();
      break;
    }
    case 'sql-query-text':
      label(ctx, 'SELECT *', 0, 0, s * 0.25, rgb, a);
      break;
  }
}

export function DreamRenderer({ scene }: DreamRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const voidish = scene.themeKey === 'void' || scene.themeKey === 'idle';
    const bgRgb = hexToRgb(scene.bgColor);
    const accentRgb = hexToRgb(scene.primaryColor);
    const runtimes: Runtime[] = scene.elements.map((el) => ({
      el,
      x: el.position.x,
      y: el.position.y,
      rgb: hexToRgb(getDreamTheme(el.subjectTheme).color),
      trail: [],
      lastTrail: 0,
      bars: initialBars(el.phase),
      sortI: 0,
      sortJ: 0,
      lastSort: 0,
    }));

    let W = 0;
    let H = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    let last = start;
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Slow push-in over the dream for a cinematic feel.
      const zoom = 1 + Math.min(1, t / (scene.duration / 1000)) * 0.06;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      bg.addColorStop(0, `rgb(${bgRgb})`);
      bg.addColorStop(1, '#000000');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      if (!voidish) {
        // Ambient wash of the subject's accent.
        const wash = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.6);
        wash.addColorStop(0, `rgba(${accentRgb},0.10)`);
        wash.addColorStop(1, `rgba(${accentRgb},0)`);
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H / 2);
      ctx.globalCompositeOperation = 'lighter';

      for (const rt of runtimes) {
        const el = rt.el;
        rt.x += el.velocity.x * dt;
        rt.y += el.velocity.y * dt;
        if (rt.x < -0.15) rt.x = 1.15;
        if (rt.x > 1.15) rt.x = -0.15;
        if (rt.y < -0.15) rt.y = 1.15;
        if (rt.y > 1.15) rt.y = -0.15;
        const px = rt.x * W;
        const py = rt.y * H;

        if (el.type === 'particle') {
          const tw = el.animation === 'twinkle' ? 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + el.phase)) : 1;
          ctx.fillStyle = voidish ? `rgba(190,200,255,${el.opacity * tw})` : `rgba(${rt.rgb},${el.opacity * tw})`;
          ctx.beginPath();
          ctx.arc(px, py, el.size, 0, TAU);
          ctx.fill();
          continue;
        }

        const pulse = el.animation === 'pulse' ? 0.85 + 0.15 * Math.sin(t * 2.4 + el.phase) : 1;
        const alpha = el.opacity * (0.75 + 0.25 * Math.sin(t * 1.3 + el.phase));
        const size = el.size * pulse;

        // Particle trail behind moving objects.
        if (el.trail) {
          if (now - rt.lastTrail > 70) {
            rt.lastTrail = now;
            rt.trail.push({ x: px, y: py });
            if (rt.trail.length > 16) rt.trail.shift();
          }
          rt.trail.forEach((p, i) => {
            const k = (i + 1) / rt.trail.length;
            ctx.fillStyle = `rgba(${rt.rgb},${0.28 * k * alpha})`;
            ctx.beginPath();
            ctx.arc(p.x + (rt.trail.length - i) * 1.6, p.y + (rt.trail.length - i) * 0.8, 1 + k * 2.2, 0, TAU);
            ctx.fill();
          });
        }

        ctx.save();
        ctx.translate(px, py);
        const spinRate = el.animation === 'spin' ? Math.max(20, Math.abs(el.spin) * 3) : el.spin;
        ctx.rotate(((el.rotation + spinRate * t) * Math.PI) / 180);
        ctx.shadowColor = `rgba(${rt.rgb},0.9)`;
        ctx.shadowBlur = Math.min(28, size * 0.35);
        if (el.type === 'text') {
          label(ctx, el.content, 0, 0, size, rt.rgb, alpha);
        } else {
          if (el.animation === 'sort' && now - rt.lastSort > 260) {
            rt.lastSort = now;
            stepSort(rt);
          }
          drawKind(ctx, el.content as DreamObjectKind, size, t, rt, alpha);
        }
        ctx.restore();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';

      // Vignette (deeper for the void dream).
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${scene.themeKey === 'void' ? 0.92 : 0.65})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [scene]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
