// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ScreenEffects Component
// Ambient particle effects and background animations.
// Part of the CRT look: off when CRT is off, and always off in lite mode.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLiteMode } from '@/lib/lite-mode';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
}

export function ScreenEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const crtEffect = useSettingsStore((s) => s.crtEffect);
  const lite = useLiteMode();
  const enabled = crtEffect && !lite;

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles
    const createParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.1,
      size: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.3,
      life: 0,
      maxLife: Math.random() * 300 + 200,
    });

    particlesRef.current = [];
    for (let i = 0; i < 40; i++) {
      const p = createParticle();
      p.life = Math.random() * p.maxLife; // random initial life
      particlesRef.current.push(p);
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        
        const lifeRatio = p.life / p.maxLife;
        const alpha = lifeRatio < 0.1
          ? lifeRatio * 10 * p.opacity
          : lifeRatio > 0.9
            ? (1 - lifeRatio) * 10 * p.opacity
            : p.opacity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.fill();

        // Respawn
        if (p.life >= p.maxLife || p.y < -10 || p.x < -10 || p.x > canvas.width + 10) {
          particles[i] = createParticle();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 1,
        opacity: 0.6,
      }}
    />
  );
}
