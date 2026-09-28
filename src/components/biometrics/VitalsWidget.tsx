// ═══════════════════════════════════════════════════════════
// WARRIOR OS — VitalsWidget
// Draggable glass panel showing 4 color-coded vital bars.
// Values update every ~5s via the biometrics store; bars animate
// smoothly and pulse-glow when a value jumps > 20%.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import type { BiometricChannel } from '@/types/biometrics';

interface VitalConfig {
  key: BiometricChannel;
  label: string;
  icon: string;
  bar: string; // bar fill color
  glow: string; // glow shadow color
  text: string; // label / value text color
}

const VITALS: VitalConfig[] = [
  {
    key: 'energy',
    label: 'Energy',
    icon: '⚡',
    bar: 'bg-accent-primary',
    glow: 'rgba(0,240,255,0.7)',
    text: 'text-accent-primary',
  },
  {
    key: 'focus',
    label: 'Focus',
    icon: '🎯',
    bar: 'bg-accent-success',
    glow: 'rgba(0,230,118,0.7)',
    text: 'text-accent-success',
  },
  {
    key: 'fatigue',
    label: 'Fatigue',
    icon: '💤',
    bar: 'bg-accent-warning',
    glow: 'rgba(255,171,0,0.7)',
    text: 'text-accent-warning',
  },
  {
    key: 'stress',
    label: 'Stress',
    icon: '😤',
    bar: 'bg-accent-danger',
    glow: 'rgba(255,23,68,0.7)',
    text: 'text-accent-danger',
  },
];

function VitalBar({ config, value }: { config: VitalConfig; value: number }) {
  const prevRef = useRef(value);
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (Math.abs(value - prevRef.current) > 20) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 900);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span aria-hidden>{config.icon}</span>
          <span>{config.label}</span>
        </span>
        <span className={cn('font-mono font-semibold', config.text)}>
          {Math.round(value)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn('h-full rounded-full', config.bar)}
          initial={false}
          animate={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            boxShadow: pulsing
              ? `0 0 12px 2px ${config.glow}`
              : `0 0 0px 0px ${config.glow}`,
          }}
          transition={{
            width: { type: 'spring', stiffness: 120, damping: 20 },
            boxShadow: { duration: 0.45 },
          }}
        />
      </div>
    </div>
  );
}

function VitalsWidgetInner({ className }: { className?: string }) {
  const current = useBiometricsStore((s) => s.current);
  const lastUpdated = useBiometricsStore((s) => s.lastUpdated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // avoid SSR hydration mismatch on live values

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      className={cn(
        'glass glass-border pointer-events-auto absolute z-20 w-56 select-none rounded-xl p-3 shadow-lg',
        className
      )}
      style={{ top: 80, right: 24 }}
      whileDrag={{ scale: 1.02 }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Activity size={13} className="text-accent-primary" />
          Vitals
        </span>
        <GripVertical size={14} className="cursor-grab text-text-muted active:cursor-grabbing" />
      </div>

      <div className="flex flex-col gap-2.5">
        {VITALS.map((v) => (
          <VitalBar key={v.key} config={v} value={current[v.key]} />
        ))}
      </div>

      <AnimatePresence>
        {lastUpdated === null && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-center text-[10px] text-text-muted"
          >
            Start typing to read your state…
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const VitalsWidget = memo(VitalsWidgetInner);
