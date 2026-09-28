// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GlowButton Component
// Neon-bordered button with hover glow and click ripple
// ═══════════════════════════════════════════════════════════

'use client';

import { type ButtonHTMLAttributes, type ReactNode, forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles = {
  primary: 'border-accent-primary/40 text-accent-primary hover:border-accent-primary hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]',
  secondary: 'border-accent-secondary/40 text-accent-secondary hover:border-accent-secondary hover:shadow-[0_0_20px_rgba(123,97,255,0.2)]',
  danger: 'border-accent-danger/40 text-accent-danger hover:border-accent-danger hover:shadow-[0_0_20px_rgba(255,23,68,0.2)]',
  ghost: 'border-transparent text-text-secondary hover:text-text-primary hover:bg-white/5',
} as const;

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
} as const;

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ children, variant = 'primary', size = 'md', loading, icon, className, disabled, onClick, type }, ref) => {
    const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
    const rippleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(rippleTimer.current), []);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || loading) return;

        // Ripple effect
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setRipple({ x, y });
        clearTimeout(rippleTimer.current);
        rippleTimer.current = setTimeout(() => setRipple(null), 600);

        onClick?.(e);
      },
      [disabled, loading, onClick]
    );

    return (
      <motion.button
        ref={ref}
        type={type}
        whileHover={{ scale: disabled ? 1 : 1.02 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={cn(
          'relative overflow-hidden inline-flex items-center justify-center',
          'rounded-[var(--radius-md)] border font-medium',
          'bg-white/5 backdrop-blur-sm',
          'transition-all duration-200',
          'focus-ring',
          variantStyles[variant],
          sizeStyles[size],
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        onClick={handleClick}
      >
        {/* Ripple */}
        {ripple && (
          <span
            className="absolute rounded-full bg-white/20 animate-[ripple_0.6s_ease-out]"
            style={{
              left: ripple.x - 10,
              top: ripple.y - 10,
              width: 20,
              height: 20,
            }}
          />
        )}

        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {!loading && icon}
        {children}
      </motion.button>
    );
  }
);

GlowButton.displayName = 'GlowButton';
