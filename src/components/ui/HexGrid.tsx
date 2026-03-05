// ═══════════════════════════════════════════════════════════
// WARRIOR OS — HexGrid Component
// Animated hexagonal grid background pattern
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HexGridProps {
  rows?: number;
  cols?: number;
  size?: number;
  gap?: number;
  color?: string;
  animated?: boolean;
  className?: string;
}

export function HexGrid({
  rows = 8,
  cols = 12,
  size = 30,
  gap = 4,
  color = 'var(--accent-primary)',
  animated = true,
  className,
}: HexGridProps) {
  const hexagons = useMemo(() => {
    const items: { x: number; y: number; delay: number }[] = [];
    const hexW = size * 2 + gap;
    const hexH = size * Math.sqrt(3) + gap;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * hexW + (row % 2 === 1 ? hexW / 2 : 0);
        const y = row * hexH * 0.75;
        const delay = (row + col) * 0.03;
        items.push({ x, y, delay });
      }
    }
    return items;
  }, [rows, cols, size, gap]);

  const hexPath = useMemo(() => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
  }, [size]);

  return (
    <div className={cn('overflow-hidden', className)}>
      <svg
        width="100%"
        height="100%"
        className="opacity-20"
      >
        {hexagons.map((hex, i) => (
          <motion.polygon
            key={i}
            points={hexPath}
            transform={`translate(${hex.x + size}, ${hex.y + size})`}
            fill="none"
            stroke={color}
            strokeWidth={0.5}
            initial={animated ? { opacity: 0, scale: 0.8 } : undefined}
            animate={animated ? { opacity: [0.2, 0.5, 0.2], scale: 1 } : { opacity: 0.3 }}
            transition={
              animated
                ? {
                    opacity: { duration: 3, repeat: Infinity, delay: hex.delay },
                    scale: { duration: 0.5, delay: hex.delay },
                  }
                : undefined
            }
          />
        ))}
      </svg>
    </div>
  );
}
