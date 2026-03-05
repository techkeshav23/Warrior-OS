// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Neural Network Wallpaper
// Canvas: hundreds of nodes with connections, pulse animations
// Cascade effect on app open
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useCallback } from 'react';
import type { WallpaperProps } from '@/types/wallpaper';

const NODE_COUNT = 200;
const CONNECTION_DIST = 120;
const MOUSE_RADIUS = 150;

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

function createNodes(width: number, height: number): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      brightness: Math.random() * 0.5 + 0.2,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 1.5 + 0.5,
      connected: false,
    });
  }
  return nodes;
}

function NeuralNetworkInner({ mouseX, mouseY, bassLevel, overallLevel }: WallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Convert -1..1 to pixel coords
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    mouseRef.current.x = ((mouseX + 1) / 2) * canvas.width;
    mouseRef.current.y = ((mouseY + 1) / 2) * canvas.height;
  }, [mouseX, mouseY]);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = time * 0.001;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const nodes = nodesRef.current;

    // Clear
    ctx.fillStyle = 'rgba(2, 3, 12, 0.15)';
    ctx.fillRect(0, 0, w, h);

    // Update nodes
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // Move
      node.x += node.vx;
      node.y += node.vy;

      // Bounce off edges
      if (node.x < 0 || node.x > w) node.vx *= -1;
      if (node.y < 0 || node.y > h) node.vy *= -1;
      node.x = Math.max(0, Math.min(w, node.x));
      node.y = Math.max(0, Math.min(h, node.y));

      // Audio: increase movement with bass
      const bassVelocity = 1 + bassLevel * 1.5;
      node.x += node.vx * bassVelocity * 0.3;
      node.y += node.vy * bassVelocity * 0.3;

      // Mouse proximity
      const dx = node.x - mx;
      const dy = node.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      node.connected = dist < MOUSE_RADIUS;

      // Gentle push away from mouse
      if (dist < MOUSE_RADIUS && dist > 0) {
        const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.02;
        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }

      // Dampen velocity
      node.vx *= 0.998;
      node.vy *= 0.998;

      // Pulse
      const pulse = Math.sin(t * node.pulseSpeed + node.pulsePhase) * 0.3 + 0.7;
      const alpha = node.brightness * pulse * (1 + overallLevel * 0.5);

      // Draw node
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size * (1 + bassLevel * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = node.connected
        ? `rgba(0, 220, 255, ${alpha})`
        : `rgba(60, 120, 200, ${alpha * 0.6})`;
      ctx.fill();

      // Glow for connected nodes
      if (node.connected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 180, 255, ${alpha * 0.08})`;
        ctx.fill();
      }
    }

    // Draw connections
    ctx.lineWidth = 0.5;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist / CONNECTION_DIST) * 0.15;
          const isHot = a.connected || b.connected;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = isHot
            ? `rgba(0, 220, 255, ${alpha * 2})`
            : `rgba(40, 80, 160, ${alpha})`;
          ctx.stroke();

          // Pulse along connection (rare)
          if (isHot && Math.random() < 0.003) {
            const px = a.x + (b.x - a.x) * Math.random();
            const py = a.y + (b.y - a.y) * Math.random();
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 220, 0.6)';
            ctx.fill();
          }
        }
      }
    }

    // Random pulse (neuron firing)
    if (Math.random() < 0.01) {
      const idx = Math.floor(Math.random() * nodes.length);
      const n = nodes[idx];
      ctx.beginPath();
      ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 200, 0.15)';
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [bassLevel, overallLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      nodesRef.current = createNodes(canvas.width, canvas.height);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#02030c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}

export const NeuralNetwork = memo(NeuralNetworkInner);
