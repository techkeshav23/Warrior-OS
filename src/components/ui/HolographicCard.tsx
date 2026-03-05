// ═══════════════════════════════════════════════════════════
// WARRIOR OS — HolographicCard Component
// 3D perspective tilt card with holographic sheen
// ═══════════════════════════════════════════════════════════

'use client';

import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HolographicCardProps {
  children: ReactNode;
  className?: string;
  intensity?: number; // tilt multiplier (default 10)
  glare?: boolean;
}

export function HolographicCard({
  children,
  className,
  intensity = 10,
  glare = true,
}: HolographicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setTilt({
      x: (y - 0.5) * -intensity,
      y: (x - 0.5) * intensity,
    });
    setGlarePos({
      x: x * 100,
      y: y * 100,
    });
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-lg)]',
        'bg-bg-elevated border border-white/5',
        className
      )}
      style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
    >
      {children}

      {/* Holographic glare */}
      {glare && isHovering && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: 0.15,
            background: `radial-gradient(
              circle at ${glarePos.x}% ${glarePos.y}%,
              rgba(255, 255, 255, 0.4) 0%,
              transparent 60%
            )`,
          }}
        />
      )}

      {/* Rainbow spectrum edge */}
      {isHovering && (
        <div
          className="absolute inset-0 pointer-events-none rounded-[var(--radius-lg)]"
          style={{
            opacity: 0.3,
            background: `linear-gradient(
              ${135 + tilt.y * 5}deg,
              rgba(0, 240, 255, 0.3),
              rgba(123, 97, 255, 0.3),
              rgba(255, 61, 113, 0.3),
              rgba(0, 240, 255, 0.3)
            )`,
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: 1,
          }}
        />
      )}
    </motion.div>
  );
}
