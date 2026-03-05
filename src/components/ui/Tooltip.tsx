// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Tooltip Component
// Minimal tooltip using CSS positioning
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: ReactNode;
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

const POSITION_MAP = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const MOTION_MAP = {
  top: { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 } },
  bottom: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 } },
  left: { initial: { opacity: 0, x: 4 }, animate: { opacity: 1, x: 0 } },
  right: { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 } },
};

export function Tooltip({
  children,
  content,
  side = 'top',
  delay = 400,
  className,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const [timeout, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleEnter = () => {
    const id = setTimeout(() => setShow(true), delay);
    setTimeoutId(id);
  };

  const handleLeave = () => {
    if (timeout) clearTimeout(timeout);
    setShow(false);
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            {...MOTION_MAP[side]}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute whitespace-nowrap z-[9999]',
              'px-2 py-1 rounded-[var(--radius-sm)]',
              'text-[10px] font-mono text-text-primary',
              'pointer-events-none',
              POSITION_MAP[side],
              className
            )}
            style={{
              background: 'rgba(20, 20, 30, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
