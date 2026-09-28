// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Toggle (legacy API)
// Thin wrapper over the kit's <Switch>; new code should use Switch.
// ═══════════════════════════════════════════════════════════

'use client';

import { Switch } from './Switch';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

/** @deprecated Use `<Switch checked onCheckedChange />`. */
export function Toggle({ checked, onChange, label, size = 'md', disabled = false, className }: ToggleProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      label={label}
      size={size}
      disabled={disabled}
      wrapperClassName={className}
      className={label ? undefined : className}
    />
  );
}
