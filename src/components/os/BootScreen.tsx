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
import { ParticleAssembly } from '@/components/effects/ParticleAssembly';

interface BootScreenProps {
  onComplete: () => void;
}

type BootPhase = 'void' | 'particle' | 'log' | 'flash' | 'done';

export function BootScreen({ onComplete }: BootScreenProps) {
  const [phase, setPhase] = useState<BootPhase>('void');
  const [logIndex, setLogIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  // ─── Phase 0: Void → Particle Assembly ───
  useEffect(() => {
    const timer = setTimeout(() => setPhase('particle'), 500);
    return () => clearTimeout(timer);
  }, []);

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
      {phase === 'particle' && (
        <ParticleAssembly
          text="WARRIOR"
          from="random"
          className="absolute inset-0 w-full h-full"
          onComplete={() => setPhase('log')}
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
