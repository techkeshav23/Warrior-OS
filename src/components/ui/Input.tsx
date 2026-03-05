// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Input Component
// Styled text input with neon focus ring
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  variant?: 'default' | 'ghost';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, variant = 'default', className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-mono text-text-secondary mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-[var(--radius-md)] font-mono text-sm text-text-primary placeholder:text-text-muted',
              'transition-all duration-200 outline-none',
              variant === 'default' && [
                'bg-bg-surface/50 border border-white/10',
                'focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/20',
                'hover:border-white/15',
              ],
              variant === 'ghost' && [
                'bg-transparent border border-transparent',
                'focus:bg-bg-surface/30 focus:border-white/10',
              ],
              icon ? 'pl-10 pr-3' : 'px-3',
              'py-2',
              error && 'border-accent-danger/50 focus:border-accent-danger focus:ring-accent-danger/20',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-[10px] font-mono text-accent-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
