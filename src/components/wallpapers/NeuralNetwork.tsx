// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Neural Network Wallpaper
// Canvas: a drifting constellation of nodes joined by hairline edges
// (the line token's steel blue). Near the pointer the network lights
// up in plasma; signals travel along hot edges, and now and then a rare
// ember synapse fires. Node count follows the screen area. DPR-aware
// (≤ 1.5×). Audio: bass quickens the drift and swells the nodes.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';
import { EMBER, INK, PLASMA } from '@/styles/tokens';

/** Nodes per 10 000 CSS px² (≈ 150 on 1600 × 1000), clamped below. */
const NODE_DENSITY = 0.94;
const MIN_NODES = 70;
const MAX_NODES = 170;
const CONNECTION_DIST = 124;
const MOUSE_RADIUS = 170;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  brightness: number;
  pulsePhase: number;
  pulseSpeed: number;
  connected: boolean; // near mouse
}

interface Signal {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  t: number;
  ember: boolean;
}

function rgbTriplet(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const INK_RGB = rgbTriplet(INK[950]);
const STEEL_RGB = '148, 170, 205'; // the line token's hue
const PLASMA_RGB = rgbTriplet(PLASMA[400]);
const PLASMA_HI_RGB = rgbTriplet(PLASMA[300]);
const EMBER_RGB = rgbTriplet(EMBER[400]);

function createNodes(width: number, height: number): Node[] {
  const count = Math.max(MIN_NODES, Math.min(MAX_NODES, Math.round((width * height * NODE_DENSITY) / 10000)));
  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      size: Math.random() * 1.4 + 0.8,
      brightness: Math.random() * 0.45 + 0.25,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 1.2 + 0.4,
      connected: false,
    });
  }
  return nodes;
}

function NeuralNetworkInner({ mouseX, mouseY, bassLevel, overallLevel }: WallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const bassRef = useRef(0);
  const overallRef = useRef(0);

  // Sync latest audio levels into refs for the animation loop to consume.
  useEffect(() => {
    bassRef.current = bassLevel;
    overallRef.current = overallLevel;
  }, [bassLevel, overallLevel]);

  // Convert -1..1 to CSS-pixel coords
  useEffect(() => {
    mouseRef.current.x = ((mouseX + 1) / 2) * window.innerWidth;
    mouseRef.current.y = ((mouseY + 1) / 2) * window.innerHeight;
  }, [mouseX, mouseY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodesRef.current = createNodes(w, h);
      ctx.fillStyle = INK[950];
      ctx.fillRect(0, 0, w, h);
    };
    resize();
    window.addEventListener('resize', resize);

    const signals: Signal[] = [];

    const draw = (time: number) => {
      const t = time * 0.001;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const nodes = nodesRef.current;
      const bass = bassRef.current;

      ctx.fillStyle = `rgba(${INK_RGB}, 0.22)`;
      ctx.fillRect(0, 0, w, h);

      // ── Move nodes ──
      const bassVelocity = 1 + bass * 1.5;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.x += node.vx * bassVelocity;
        node.y += node.vy * bassVelocity;
        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
        node.x = Math.max(0, Math.min(w, node.x));
        node.y = Math.max(0, Math.min(h, node.y));

        const dx = node.x - mx;
        const dy = node.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        node.connected = dist < MOUSE_RADIUS;
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = ((MOUSE_RADIUS - dist) / MOUSE_RADIUS) * 0.012;
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
        // Settle back to a calm drift.
        node.vx *= 0.995;
        node.vy *= 0.995;
      }

      // ── Edges ──
      ctx.lineWidth = 0.6;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          if (Math.abs(dx) > CONNECTION_DIST || Math.abs(dy) > CONNECTION_DIST) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= CONNECTION_DIST) continue;

          const strength = 1 - dist / CONNECTION_DIST;
          const hot = a.connected || b.connected;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = hot
            ? `rgba(${PLASMA_RGB}, ${strength * 0.32})`
            : `rgba(${STEEL_RGB}, ${strength * 0.12})`;
          ctx.stroke();

          // Launch a signal along a hot edge now and then.
          if (hot && signals.length < 14 && Math.random() < 0.004) {
            signals.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: 0, ember: Math.random() < 0.12 });
          }
        }
      }

      // Ambient: a rare signal anywhere in the network.
      if (signals.length < 14 && Math.random() < 0.02 && nodes.length > 1) {
        const a = nodes[Math.floor(Math.random() * nodes.length)];
        let best: Node | null = null;
        let bestD = CONNECTION_DIST;
        for (const b of nodes) {
          if (b === a) continue;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestD) {
            bestD = d;
            best = b;
          }
        }
        if (best) signals.push({ ax: a.x, ay: a.y, bx: best.x, by: best.y, t: 0, ember: Math.random() < 0.08 });
      }

      // ── Nodes ──
      const swell = 1 + bass * 0.45;
      const energy = 1 + overallRef.current * 0.4;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pulse = Math.sin(t * node.pulseSpeed + node.pulsePhase) * 0.25 + 0.75;
        const alpha = Math.min(1, node.brightness * pulse * energy);
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * swell, 0, Math.PI * 2);
        ctx.fillStyle = node.connected
          ? `rgba(${PLASMA_HI_RGB}, ${alpha})`
          : `rgba(${STEEL_RGB}, ${alpha * 0.55})`;
        ctx.fill();
        if (node.connected) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.size * 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${PLASMA_RGB}, ${alpha * 0.07})`;
          ctx.fill();
        }
      }

      // ── Signals ──
      for (let i = signals.length - 1; i >= 0; i--) {
        const s = signals[i];
        s.t += 0.018;
        if (s.t >= 1) {
          signals.splice(i, 1);
          continue;
        }
        const px = s.ax + (s.bx - s.ax) * s.t;
        const py = s.ay + (s.by - s.ay) * s.t;
        const fade = Math.sin(s.t * Math.PI);
        const rgb = s.ember ? EMBER_RGB : PLASMA_HI_RGB;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${0.12 * fade})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px, py, 1.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${0.75 * fade})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

export const NeuralNetwork = memo(NeuralNetworkInner);
