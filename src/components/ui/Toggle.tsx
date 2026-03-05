// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Toggle Component
// Animated switch with glow state
// ═══════════════════════════════════════════════════════════

'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  size = 'md',
  disabled = false,
  className,
}: ToggleProps) {
  const dims = size === 'sm'
    ? { track: 'w-8 h-4', thumb: 'w-3 h-3', on: 17, off: 2 }
    : { track: 'w-10 h-5', thumb: 'w-3.5 h-3.5', on: 22, off: 3 };

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 select-none',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        className
      )}
    >
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative rounded-full transition-colors duration-200',
          dims.track,
          checked ? 'bg-accent-primary/30' : 'bg-white/10'
        )}
        style={{
          boxShadow: checked ? '0 0 10px color-mix(in srgb, var(--accent-primary) 25%, transparent)' : 'none',
          border: `1px solid ${checked ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
        }}
      >
        <motion.div
          className={cn(
            'absolute top-1/2 rounded-full',
            dims.thumb,
            checked ? 'bg-accent-primary' : 'bg-text-muted'
          )}
          animate={{ x: checked ? dims.on : dims.off, y: '-50%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            boxShadow: checked ? '0 0 6px var(--accent-primary)' : 'none',
          }}
        />
      </button>
      {label && (
        <span className="text-xs font-mono text-text-secondary">{label}</span>
      )}
    </label>
  );
}
