// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Cursor Trail Effect
// Canvas overlay tracking mouse position with fading comet trail
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const MAX_TRAIL_LENGTH = 30;
const TRAIL_LIFETIME = 0.4; // seconds

function CursorTrailInner() {
  const cursorTrail = useSettingsStore((s) => s.cursorTrail);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;

    // Add trail point
    const trail = trailRef.current;
    trail.unshift({ x: e.clientX, y: e.clientY, age: 0 });
    if (trail.length > MAX_TRAIL_LENGTH) {
      trail.length = MAX_TRAIL_LENGTH;
    }
  }, []);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dt = lastTimeRef.current > 0 ? (time - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = time;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const trail = trailRef.current;

    // Age all points
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].age += dt;
      if (trail[i].age > TRAIL_LIFETIME) {
        trail.splice(i, 1);
      }
    }

    // Draw trail
    if (trail.length < 2) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < trail.length; i++) {
      const p = trail[i];
      const prev = trail[i - 1];
      const progress = p.age / TRAIL_LIFETIME;
      const alpha = Math.max(0, 1 - progress) * 0.6;
      const width = Math.max(0.5, (1 - progress) * 3);

      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    // Glow at head
    if (trail.length > 0) {
      const head = trail[0];
      ctx.beginPath();
      ctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    if (!cursorTrail) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animRef.current);
    };
  }, [cursorTrail, handleMouseMove, draw]);

  if (!cursorTrail) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99999 }}
      aria-hidden="true"
    />
  );
}

export const CursorTrail = memo(CursorTrailInner);
