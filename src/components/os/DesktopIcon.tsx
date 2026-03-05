// ═══════════════════════════════════════════════════════════
// WARRIOR OS — DesktopIcon Component
// Individual desktop icon with 3D hover tilt
// ═══════════════════════════════════════════════════════════

'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { AppDefinition } from '@/types';
import { cn } from '@/lib/utils';

interface DesktopIconProps {
  app: AppDefinition;
  onDoubleClick: () => void;
  index?: number;
}

export function DesktopIcon({ app, onDoubleClick, index = 0 }: DesktopIconProps) {
  const iconRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isSelected, setIsSelected] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      x: (y - 0.5) * -15,
      y: (x - 0.5) * 15,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={iconRef}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsSelected(true)}
      onDoubleClick={onDoubleClick}
      onBlur={() => setIsSelected(false)}
      tabIndex={0}
      className="outline-none"
    >
      <motion.div
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          'flex flex-col items-center gap-1.5 p-2 rounded-[var(--radius-md)] cursor-pointer',
          'transition-colors duration-150',
          isSelected
            ? 'bg-accent-primary/10 ring-1 ring-accent-primary/30'
            : 'hover:bg-white/5'
        )}
        style={{ transformStyle: 'preserve-3d', perspective: 600 }}
      >
        {/* Icon container */}
        <div
          className={cn(
            'w-12 h-12 rounded-[var(--radius-md)] flex items-center justify-center',
            'bg-bg-elevated/80 border border-white/5',
            'group-hover:border-accent-primary/20'
          )}
          style={{
            boxShadow: isSelected
              ? '0 0 12px var(--accent-primary)30'
              : '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <span className="text-lg">{app.icon}</span>
        </div>

        {/* Label */}
        <span
          className={cn(
            'text-[10px] font-mono text-center leading-tight max-w-[72px] truncate',
            isSelected ? 'text-accent-primary' : 'text-text-secondary'
          )}
          style={{
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          }}
        >
          {app.name}
        </span>
      </motion.div>
    </motion.div>
  );
}
