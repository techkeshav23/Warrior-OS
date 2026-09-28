// ═══════════════════════════════════════════════════════════
// WARRIOR OS — BootScreen Component
// Cinematic boot sequence: particle assembly → system log → transition
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GlitchText } from '@/components/ui/GlitchText';
import { BOOT_MESSAGES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface BootScreenProps {
  onComplete: () => void;
}

type BootPhase = 'void' | 'particle' | 'log' | 'flash' | 'done';

export function BootScreen({ onComplete }: BootScreenProps) {
  const [phase, setPhase] = useState<BootPhase>('void');
  const [logIndex, setLogIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  // ─── Phase 0: Void → Particle Assembly ───
  useEffect(() => {
    const timer = setTimeout(() => setPhase('particle'), 500);
    return () => clearTimeout(timer);
  }, []);

  // ─── Particle Canvas Animation ───
  useEffect(() => {
    if (phase !== 'particle') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const text = 'WARRIOR';
    const fontSize = Math.min(canvas.width / 6, 120);
    ctx.font = `bold ${fontSize}px "Orbitron", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Get text pixel data
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create particles from text pixels
    const particles: Array<{
      targetX: number;
      targetY: number;
      x: number;
      y: number;
      size: number;
      speed: number;
      alpha: number;
    }> = [];

    const step = 4;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const index = (y * canvas.width + x) * 4;
        if (imageData.data[index + 3] > 128) {
          particles.push({
            targetX: x,
            targetY: y,
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 1,
            speed: Math.random() * 0.02 + 0.02,
            alpha: 0,
          });
        }
      }
    }

    let frame = 0;
    const maxFrames = 120; // ~2 seconds at 60fps

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      frame++;
      const t = Math.min(frame / maxFrames, 1);

      particles.forEach((p) => {
        p.x += (p.targetX - p.x) * p.speed * (1 + t * 3);
        p.y += (p.targetY - p.y) * p.speed * (1 + t * 3);
        p.alpha = Math.min(t * 2, 1);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha})`;
        ctx.fill();
      });

      // Glow effect when assembled
      if (t > 0.7) {
        const glowAlpha = (t - 0.7) / 0.3;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 20 * glowAlpha;
        ctx.fillStyle = `rgba(0, 240, 255, ${glowAlpha * 0.3})`;
        ctx.font = `bold ${Math.min(canvas.width / 6, 120)}px "Orbitron", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
      }

      if (frame < maxFrames + 30) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setPhase('log');
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [phase]);

  // ─── System Log Phase ───
  useEffect(() => {
    if (phase !== 'log') return;
    let flashTimer: ReturnType<typeof setTimeout>;

    const interval = setInterval(() => {
      setLogIndex((prev) => {
        const next = prev + 1;
        setProgress(Math.round((next / BOOT_MESSAGES.length) * 100));
        if (next >= BOOT_MESSAGES.length) {
          clearInterval(interval);
          flashTimer = setTimeout(() => setPhase('flash'), 400);
        }
        return next;
      });
    }, 120);

    return () => {
      clearInterval(interval);
      clearTimeout(flashTimer);
    };
  }, [phase]);

  // ─── Flash Transition ───
  useEffect(() => {
    if (phase !== 'flash') return;
    const timer = setTimeout(() => {
      setPhase('done');
      onCompleteRef.current();
    }, 600);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <motion.div
      className="fixed inset-0 bg-void flex items-center justify-center overflow-hidden"
      style={{ zIndex: 'var(--z-boot)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none" />

      {/* ─── Void Phase ─── */}
      <AnimatePresence>
        {phase === 'void' && (
          <motion.div
            key="void"
            className="absolute inset-0 bg-black"
            exit={{ opacity: 0 }}
          >
            {/* Single cyan pixel */}
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-primary"
              initial={{ width: 2, height: 2, opacity: 0 }}
              animate={{
                width: [2, 4, 2, 4],
                height: [2, 4, 2, 4],
                opacity: [0, 1, 0.5, 1],
              }}
              transition={{ duration: 0.5, times: [0, 0.3, 0.6, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Particle Assembly Phase ─── */}
      {(phase === 'particle' || phase === 'void') && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      )}

      {/* ─── System Log Phase ─── */}
      <AnimatePresence>
        {phase === 'log' && (
          <motion.div
            key="log"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl px-8"
          >
            {/* Logo */}
            <div className="text-center mb-8">
              <GlitchText
                text="WARRIOR OS"
                className="text-3xl font-display font-bold text-accent-primary text-glow"
                intensity="low"
              />
              <p className="text-text-muted text-xs font-mono mt-1">
                v4.0 — THE LIVING WORLD
              </p>
            </div>

            {/* System Log */}
            <div className="glass rounded-[var(--radius-md)] p-4 mb-4 h-64 overflow-hidden">
              <div className="font-mono text-xs space-y-0.5">
                {BOOT_MESSAGES.slice(0, logIndex).map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-text-muted">[{msg.time}]</span>
                    <span className="text-text-secondary flex-1">
                      {msg.message}
                    </span>
                    <span
                      className={cn(
                        'font-bold',
                        msg.status === 'OK' && 'text-accent-success',
                        msg.status === 'READY' && 'text-accent-primary text-glow'
                      )}
                    >
                      {msg.status}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Progress Bar */}
            <ProgressBar
              value={progress}
              label="INITIALIZING SYSTEMS"
              showValue
              size="sm"
              glow
              className="mb-2"
            />

            {/* Status Text */}
            <div className="text-center">
              <span className="text-xs font-mono text-text-muted">
                {progress < 100 ? 'Loading components...' : 'System ready.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── White Flash Transition ─── */}
      <AnimatePresence>
        {phase === 'flash' && (
          <motion.div
            key="flash"
            className="absolute inset-0 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.6, times: [0, 0.3, 1] }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
