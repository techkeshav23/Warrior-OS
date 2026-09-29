// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dialog + ConfirmDialog (FORGE HUD kit)
// Modal sheet in a portal on <body>: dimmed backdrop, focus trapped
// inside, Escape / backdrop click close it, focus returns to whatever
// opened it. Title + description are wired to aria-labelledby/-describedby.
//   <Dialog open={open} onClose={close} title="Rename deck"
//     footer={<><Button onClick={close}>Cancel</Button><Button variant="primary">Save</Button></>}>…</Dialog>
//   <ConfirmDialog open={…} onClose={…} onConfirm={del} tone="danger"
//     title="Delete deck?" description="Its 48 cards go too. This can't be undone." confirmLabel="Delete" />
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert, X, Flame, CircleHelp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { renderIcon, type IconLike } from './icon';
import { Button } from './Button';
import { IconButton } from './Button';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const SIZE: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[min(90vw,1100px)] max-h-[90vh]',
};

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable="true"]';

const EASE = [0.16, 1, 0.3, 1] as const;

const noopSubscribe = () => () => {};
/** true on the client after hydration (portals need document.body). */
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  /** Icon tile left of the title. */
  icon?: IconLike;
  iconTone?: 'accent' | 'ember' | 'danger' | 'neutral';
  children?: ReactNode;
  /** Action row, right-aligned (put the primary action last). */
  footer?: ReactNode;
  size?: DialogSize;
  showClose?: boolean;
  /** Close when clicking the backdrop (default true). */
  closeOnBackdrop?: boolean;
  /** Element to focus on open (default: first focusable in the body, else the panel). */
  initialFocus?: RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
}

const ICON_TONE = {
  accent: 'text-accent border-accent/30 bg-accent/10',
  ember: 'text-ember-400 border-ember-500/30 bg-ember-500/10',
  danger: 'text-danger border-danger/30 bg-danger/10',
  neutral: 'text-fg-muted border-line-strong bg-ink-800',
} as const;

/** Accessible modal dialog. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  iconTone = 'accent',
  children,
  footer,
  size = 'md',
  showClose = true,
  closeOnBackdrop = true,
  initialFocus,
  className,
  bodyClassName,
}: DialogProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Remember the opener, move focus in; give focus back on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        initialFocus?.current ??
        panel.querySelector<HTMLElement>('[data-dialog-body] ' + FOCUSABLE.split(',').join(',[data-dialog-body] ')) ??
        panel.querySelector<HTMLElement>('[data-dialog-footer] button') ??
        panel;
      target.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      const back = restoreRef.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open, initialFocus]);

  // Escape closes; Tab cycles inside the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 'var(--z-modal, 950)' }}>
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px]"
            onClick={closeOnBackdrop ? () => onCloseRef.current() : undefined}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.26, ease: EASE }}
            className={cn(
              'glass-popover relative flex w-full flex-col overflow-hidden rounded-sheet shadow-e3 outline-none',
              SIZE[size],
              className
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-accent/50 to-transparent" />
            {(title || showClose) && (
              <div className="flex items-start gap-3 px-5 pb-1 pt-5">
                {icon != null && (
                  <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-card border', ICON_TONE[iconTone])}>
                    {renderIcon(icon, 18)}
                  </span>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  {title && (
                    <h2 id={titleId} className="text-base font-semibold text-fg">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-ui text-fg-muted">
                      {description}
                    </p>
                  )}
                </div>
                {showClose && <IconButton icon={X} aria-label="Close" size="sm" onClick={() => onCloseRef.current()} className="-mr-1.5 -mt-1" />}
              </div>
            )}
            {children != null && (
              <div data-dialog-body className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4 text-ui text-fg-muted', bodyClassName)}>
                {children}
              </div>
            )}
            {footer != null && (
              <div data-dialog-footer className={cn('flex items-center justify-end gap-2 border-t border-line bg-ink-950/30 px-5 py-3', children == null && 'mt-4')}>
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ─── ConfirmDialog ────────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = destructive · ember = forge action · accent = neutral confirm */
  tone?: 'danger' | 'ember' | 'accent';
  icon?: IconLike;
  loading?: boolean;
  children?: ReactNode;
}

/** Two-button confirmation. Focus starts on Cancel for destructive tones. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon,
  loading = false,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const defaultIcon = tone === 'danger' ? TriangleAlert : tone === 'ember' ? Flame : CircleHelp;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon ?? defaultIcon}
      iconTone={tone}
      size="sm"
      showClose={false}
      initialFocus={tone === 'danger' ? cancelRef : undefined}
      footer={
        <>
          <Button ref={cancelRef} variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'accent' ? 'primary' : tone} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
