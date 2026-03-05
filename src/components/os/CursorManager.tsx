// ═══════════════════════════════════════════════════════════
// WARRIOR OS — CursorManager Component
// Custom cursor with trail effect
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function CursorManager() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { stiffness: 500, damping: 28 });
  const springY = useSpring(cursorY, { stiffness: 500, damping: 28 });

  useEffect(() => {
    // Hide native cursor when custom cursor is active
    document.body.style.cursor = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      setIsVisible(true);

      // Check if hovering over a clickable element
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], input, select, textarea, [tabindex]');
      setIsPointer(!!clickable);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [cursorX, cursorY]);

  return (
    <>
      {/* Custom cursor dot */}
      <motion.div
        className="fixed pointer-events-none"
        style={{
          x: springX,
          y: springY,
          zIndex: 9999,
          opacity: isVisible ? 1 : 0,
        }}
      >
        {/* Outer ring */}
        <motion.div
          animate={{
            width: isPointer ? 40 : 24,
            height: isPointer ? 40 : 24,
            borderColor: isPointer ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)',
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="rounded-full border"
          style={{
            transform: 'translate(-50%, -50%)',
            background: isPointer ? 'rgba(0, 240, 255, 0.05)' : 'transparent',
          }}
        />
        {/* Inner dot */}
        <div
          className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full bg-accent-primary"
          style={{
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 6px var(--accent-primary)',
          }}
        />
      </motion.div>
    </>
  );
}
