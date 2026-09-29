// ═══════════════════════════════════════════════════════════
// WARRIOR OS — HolographicCard Component
// 3D perspective tilt card with holographic sheen (FORGE HUD: subtle
// tilt, hairline edge, plasma→ember rim light on hover — use sparingly,
// e.g. achievement / profile hero cards).
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
  intensity = 6,
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
        'armor-panel chamfer-md relative overflow-hidden',
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
            opacity: 0.1,
            background: `radial-gradient(
              circle at ${glarePos.x}% ${glarePos.y}%,
              rgba(255, 255, 255, 0.35) 0%,
              transparent 55%
            )`,
          }}
        />
      )}

      {/* Rainbow spectrum edge */}
      {isHovering && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: 0.55,
            background: `linear-gradient(
              ${135 + tilt.y * 5}deg,
              color-mix(in srgb, var(--accent, #2fd6f5) 45%, transparent),
              transparent 40%,
              transparent 60%,
              color-mix(in srgb, var(--color-ember-400, #ff8a3d) 45%, transparent)
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
