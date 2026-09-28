// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dream Renderer
// Full-screen canvas scene. Drifting, softly-glowing subject objects
// on an ambient radial gradient. Runs for the scene's duration then
// idles. SSR-safe: all canvas/rAF access lives inside effects.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import type { DreamScene, DreamSceneObject } from '@/types/dream';

interface DreamRendererProps {
  scene: DreamScene;
  /** Global fade 0..1 applied by the orchestrator during transitions. */
  fade?: number;
}

// Convert #rrggbb → "r,g,b" for rgba() strings.
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '0,240,255';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  o: DreamSceneObject,
  rgb: string,
  t: number,
  W: number,
  H: number,
  fade: number
) {
  const px = o.x * W;
  const py = o.y * H;
  const pulse = 0.6 + 0.4 * Math.sin(t * 1.6 + o.phase);
  const alpha = o.opacity * pulse * fade;
  const size = o.size * (0.9 + 0.1 * pulse);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(((o.rotation + o.spin * t) * Math.PI) / 180);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = size * 0.9;
  ctx.shadowColor = `rgba(${rgb},0.9)`;
  ctx.strokeStyle = `rgba(${rgb},0.95)`;
  ctx.fillStyle = `rgba(${rgb},0.28)`;
  ctx.lineWidth = Math.max(1, size * 0.05);

  const s = size;
  switch (o.kind) {
    case 'floating-table':
    case 'kanban-card':
    case 'exam-sheet': {
      ctx.strokeRect(-s / 2, -s / 2, s, s * 0.7);
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s / 6);
      ctx.lineTo(s / 2, -s / 6);
      ctx.stroke();
      break;
    }
    case 'database-cylinder': {
      ctx.beginPath();
      ctx.ellipse(0, -s / 3, s / 2, s / 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(-s / 2, -s / 3, s, s * 0.66);
      ctx.beginPath();
      ctx.ellipse(0, s / 3, s / 2, s / 6, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'sorting-bar':
    case 'gantt-bar': {
      for (let i = -2; i <= 2; i++) {
        const bh = s * (0.4 + 0.3 * Math.abs(Math.sin(o.phase + i)));
        ctx.fillRect(i * s * 0.18 - s * 0.06, s / 2 - bh, s * 0.12, bh);
      }
      break;
    }
    case 'network-packet':
    case 'checkmark-orb':
    case 'clock-orb':
    case 'router-node':
    case 'automaton-state':
    case 'tree-node':
    case 'set-venn':
    case 'star-cluster':
    case 'distant-stars':
    case 'void-particles': {
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
      break;
    }
    case 'nebula-swirl':
    case 'dark-fog': {
      ctx.beginPath();
      ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'logic-gate':
    case 'circuit-trace':
    case 'transition-arrow':
    case 'graph-edge':
    case 'linked-list': {
      ctx.beginPath();
      ctx.moveTo(-s / 2, 0);
      ctx.lineTo(s / 2, 0);
      ctx.moveTo(s / 2 - s * 0.15, -s * 0.12);
      ctx.lineTo(s / 2, 0);
      ctx.lineTo(s / 2 - s * 0.15, s * 0.12);
      ctx.stroke();
      break;
    }
    case 'matrix-grid':
    case 'er-diagram-web':
    case 'process-diagram': {
      for (let i = -1; i <= 1; i++) {
        ctx.strokeRect(i * s * 0.34 - s * 0.15, -s * 0.15, s * 0.3, s * 0.3);
      }
      break;
    }
    default: {
      // text-bearing / glyph objects fall through to text render below
      ctx.beginPath();
      ctx.arc(0, 0, s / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (o.text) {
    ctx.globalAlpha = alpha * 0.9;
    ctx.font = `${Math.max(10, s * 0.35)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = `rgba(${rgb},1)`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(o.text, 0, 0);
  }

  ctx.restore();
}

export function DreamRenderer({ scene, fade = 1 }: DreamRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const fadeRef = useRef(fade);
  const objectsRef = useRef<DreamSceneObject[]>(scene.objects.map((o) => ({ ...o })));

  // Keep the rAF loop's view of `fade` current without reading refs in render.
  useEffect(() => {
    fadeRef.current = fade;
  }, [fade]);

  useEffect(() => {
    objectsRef.current = scene.objects.map((o) => ({ ...o }));
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rgb = hexToRgb(scene.primaryColor);
    const ambRgb = hexToRgb(scene.ambientColor);
    let W = 0;
    let H = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    let last = start;

    const frame = (nowTs: number) => {
      const t = (nowTs - start) / 1000;
      const dt = Math.min(0.05, (nowTs - last) / 1000);
      last = nowTs;
      const f = fadeRef.current;

      // Ambient background: deep radial gradient.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, `rgba(${ambRgb},${0.9 * f})`);
      g.addColorStop(1, `rgba(0,0,0,${0.98 * f})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Faint vignette wash of the accent for cinematic tint.
      ctx.fillStyle = `rgba(${rgb},${0.04 * f})`;
      ctx.fillRect(0, 0, W, H);

      // Advance + draw objects (wrap around edges).
      ctx.globalCompositeOperation = 'lighter';
      for (const o of objectsRef.current) {
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        if (o.x < -0.1) o.x = 1.1;
        if (o.x > 1.1) o.x = -0.1;
        if (o.y < -0.1) o.y = 1.1;
        if (o.y > 1.1) o.y = -0.1;
        drawObject(ctx, o, rgb, t, W, H, f);
      }
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [scene]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
