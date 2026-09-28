// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Confirm Button
// Two-step destructive button: first click arms it, second
// click within 3 s confirms. Shared by Forge and Resume Builder.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ConfirmButtonProps {
  onConfirm: () => void;
  children: ReactNode;
  /** Content while armed. */
  armedChildren?: ReactNode;
  /** Full class list while idle. */
  className: string;
  /** Full class list while armed. */
  armedClassName: string;
  label: string;
}

export function ConfirmButton({
  onConfirm,
  children,
  armedChildren = 'Confirm?',
  className,
  armedClassName,
  label,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const handleClick = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (armed) {
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setArmed(false);
    }, 3000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={armed ? `Confirm: ${label}` : label}
      title={armed ? 'Click again to confirm' : label}
      className={armed ? armedClassName : className}
    >
      {armed ? armedChildren : children}
    </button>
  );
}
