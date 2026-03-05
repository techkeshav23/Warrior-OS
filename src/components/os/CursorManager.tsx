// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CursorManager Component
// Custom cursor with trail effect
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function CursorManager() {
  const cursorTrail = useSettingsStore((s) => s.cursorTrail);
  const [isVisible, setIsVisible] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { stiffness: 500, damping: 28 });
  const springY = useSpring(cursorY, { stiffness: 500, damping: 28 });

  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      setIsVisible(true);

      // Check if hovering over a clickable element
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], input, select, textarea, [tabindex]');
      setIsPointer(!!clickable);

      // Trail tracking
      if (cursorTrail) {
        trailRef.current.push({ x: e.clientX, y: e.clientY });
        if (trailRef.current.length > 20) {
          trailRef.current.shift();
        }
      }
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [cursorX, cursorY, cursorTrail]);

  // Trail rendering
  useEffect(() => {
    if (!cursorTrail || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const trail = trailRef.current;

      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const alpha = (i / trail.length) * 0.3;
          const width = (i / trail.length) * 2;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // Fade trail
      if (trail.length > 0) {
        trailRef.current = trail.slice(-15);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [cursorTrail]);

  return (
    <>
      {/* Trail Canvas */}
      {cursorTrail && (
        <canvas
          ref={canvasRef}
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 9998 }}
        />
      )}

      {/* Custom cursor dot */}
      <motion.div
        className="fixed pointer-events-none"
        style={{
          x: springX,
          y: springY,
          zIndex: 9999,
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Outer ring */}
        <motion.div
          animate={{
            width: isPointer ? 40 : 24,
            height: isPointer ? 40 : 24,
            borderColor: isPointer ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="rounded-full border"
          style={{
            transform: 'translate(-50%, -50%)',
            background: isPointer ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
          }}
        />
        {/* Inner dot */}
        <div
          className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-accent-primary"
          style={{
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 6px var(--accent-primary)',
          }}
        />
      </motion.div>
    </>
  );
}
