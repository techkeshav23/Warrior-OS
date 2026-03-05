// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ContextMenu Component
// Right-click context menu with animations
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function ContextMenu({ items, position, onSelect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [position, onClose]);

  // Adjust position to stay within viewport
  const adjustedPos = position
    ? {
        x: Math.min(position.x, window.innerWidth - 200),
        y: Math.min(position.y, window.innerHeight - items.length * 32 - 20),
      }
    : null;

  return (
    <AnimatePresence>
      {adjustedPos && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed min-w-[180px] py-1 rounded-[var(--radius-md)] overflow-hidden"
          style={{
            left: adjustedPos.x,
            top: adjustedPos.y,
            zIndex: 'var(--z-context-menu)',
            background: 'rgba(12, 12, 20, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          {items.map((item) =>
            item.divider ? (
              <div key={item.id} className="my-1 border-t border-white/5" />
            ) : (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    onSelect(item.id);
                    onClose();
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-1.5',
                  'text-xs font-mono transition-colors text-left',
                  item.disabled
                    ? 'text-text-muted cursor-not-allowed opacity-40'
                    : item.danger
                      ? 'text-accent-danger hover:bg-accent-danger/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                )}
              >
                {item.icon && <span className="w-4 flex-shrink-0">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <span className="text-[9px] text-text-muted ml-4">{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
