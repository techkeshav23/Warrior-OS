// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Deck Vault: dialog shell + confirm dialog
// In-window overlays (they cover the Decks panel, not the desktop).
// Esc closes, Ctrl+Enter submits, a click on the backdrop closes.
// ═══════════════════════════════════════════════════════════

'use client';

import { useId, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BTN_DANGER, BTN_GHOST } from './deck-ui';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

interface DialogShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  /** Runs on submit: the footer's submit button, Enter in a text field, or Ctrl+Enter. */
  onSubmit?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  size?: keyof typeof SIZES;
  tone?: 'default' | 'danger';
}

export function DialogShell({
  title,
  subtitle,
  icon,
  onClose,
  onSubmit,
  footer,
  children,
  size = 'md',
  tone = 'default',
}: DialogShellProps) {
  const titleId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      // Keep the OS-wide Escape handlers (palette, start menu) out of it.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onClose();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Focusable, so a click on plain text inside keeps Esc / Ctrl+Enter working.
        tabIndex={-1}
        onSubmit={submit}
        onKeyDown={onKeyDown}
        initial={{ y: 18, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative flex max-h-full w-full flex-col overflow-hidden rounded-xl border bg-[#0b0f17]/95 shadow-2xl shadow-black/60 outline-none',
          SIZES[size],
          tone === 'danger' ? 'border-red-400/30' : 'border-white/15'
        )}
      >
        {/* Scan line along the top edge */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
            tone === 'danger' ? 'via-red-400/70' : 'via-cyan-400/70'
          )}
        />
        <header className="flex items-start gap-2.5 border-b border-white/10 px-4 py-3">
          {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className={cn('text-sm font-bold tracking-wide', tone === 'danger' ? 'text-red-200' : 'text-cyan-300')}
            >
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-white/45">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
            {footer}
          </footer>
        )}
      </motion.form>
    </motion.div>
  );
}

// ─── Confirm ───

export interface ConfirmRequest {
  title: string;
  message: ReactNode;
  /** Label of the destructive button, e.g. "Delete deck". */
  confirmLabel: string;
  onConfirm: () => void;
}

interface ConfirmDialogProps extends ConfirmRequest {
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const confirm = () => {
    onConfirm();
    onClose();
  };
  return (
    <DialogShell
      title={title}
      tone="danger"
      size="sm"
      icon={<TriangleAlert className="h-4 w-4 text-red-300" />}
      onClose={onClose}
      onSubmit={confirm}
      footer={
        <>
          {/* Cancel has focus, so a stray Enter never destroys anything. */}
          <button type="button" autoFocus onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button type="submit" className={BTN_DANGER}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-white/70">{message}</div>
    </DialogShell>
  );
}
