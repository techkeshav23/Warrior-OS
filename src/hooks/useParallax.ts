// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useParallax Hook
// Returns smooth x/y offset values based on mouse position
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ParallaxValues {
  x: number;  // -1 to 1
  y: number;  // -1 to 1
  rotateX: number; // degrees
  rotateY: number; // degrees
}

export function useParallax(intensity: number = 1): ParallaxValues {
  const [values, setValues] = useState<ParallaxValues>({
    x: 0,
    y: 0,
    rotateX: 0,
    rotateY: 0,
  });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const x = ((e.clientX - centerX) / centerX) * intensity;
      const y = ((e.clientY - centerY) / centerY) * intensity;

      setValues({
        x,
        y,
        rotateX: -y * 5 * intensity,
        rotateY: x * 5 * intensity,
      });
    },
    [intensity]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  return values;
}
