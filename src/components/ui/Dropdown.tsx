// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Dropdown Component
// Animated dropdown menu
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  divider?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  align = 'left',
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1">
        {trigger}
        <ChevronDown
          className={cn(
            'w-3 h-3 text-text-muted transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full mt-1 min-w-[160px] z-50',
              'rounded-[var(--radius-md)] overflow-hidden py-1',
              align === 'left' ? 'left-0' : 'right-0'
            )}
            style={{
              background: 'rgba(12, 12, 20, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
            }}
          >
            {items.map((item) =>
              item.divider ? (
                <div key={item.id} className="my-1 border-t border-white/5" />
              ) : (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5',
                    'text-xs font-mono transition-colors',
                    item.danger
                      ? 'text-accent-danger hover:bg-accent-danger/10'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
