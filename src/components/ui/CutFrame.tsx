// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Cut frame
// A dashed (or solid) outline that follows a chamfered plate's
// silhouette, cut corners included. clip-path eats a CSS border
// at the cuts, so the outline is an SVG path sized to the box.
// Place inside a `relative` element; it never takes pointer events.
// ═══════════════════════════════════════════════════════════

'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { chamferPath } from '@/styles/tokens';

export interface CutFrameProps {
  /** Corner cut in px (CUT.xs 4 · sm 6 · md 8 · lg 14). */
  cut?: number;
  dashed?: boolean;
  /** Stroke colour classes (text-*, the path strokes currentColor). */
  className?: string;
}

export function CutFrame({ cut = 8, dashed = true, className }: CutFrameProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 size-full overflow-visible', className)}
    >
      {size && size.w > 2 && size.h > 2 && (
        <path
          d={chamferPath(size.w - 1, size.h - 1, cut)}
          transform="translate(0.5 0.5)"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray={dashed ? '5 4' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
