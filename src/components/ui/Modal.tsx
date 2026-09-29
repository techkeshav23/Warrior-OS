// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Modal (legacy API)
// Thin wrapper over the kit's <Dialog> (portal, focus trap, Escape,
// focus return). New code should use Dialog / ConfirmDialog.
// ═══════════════════════════════════════════════════════════

'use client';

import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
  className?: string;
}

/** @deprecated Use `<Dialog open onClose title />`. */
export function Modal({ isOpen, onClose, title, children, size = 'md', showClose = true, className }: ModalProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} title={title} size={size} showClose={showClose} className={className} bodyClassName="text-fg">
      {children}
    </Dialog>
  );
}
