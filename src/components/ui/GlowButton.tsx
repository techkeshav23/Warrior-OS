// ═══════════════════════════════════════════════════════════
// WARRIOR OS — GlowButton (legacy API)
// Thin wrapper over the kit's <Button>; new code should use Button.
// ═══════════════════════════════════════════════════════════

'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Button } from './Button';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

/** @deprecated Use `<Button variant=… leadingIcon=… />`. */
export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(function GlowButton(
  { children, variant = 'primary', size = 'md', loading, icon, type = 'button', ...props },
  ref
) {
  return (
    <Button ref={ref} variant={variant} size={size} loading={loading} leadingIcon={icon} type={type} {...props}>
      {children}
    </Button>
  );
});
