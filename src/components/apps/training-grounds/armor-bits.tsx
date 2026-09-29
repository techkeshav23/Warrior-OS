// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Training Grounds: small FORGED ARMOR pieces
// A dashed edge for chamfered "add" plates (clip-path hides a real
// border's corners, so the dashes are an inset SVG rect and the four cut
// corners get their own hairlines), and an ember seam for heated plates.
// ═══════════════════════════════════════════════════════════

import { cn } from '@/lib/utils';

const CORNERS = [
  'left-0 top-0 bg-[linear-gradient(to_bottom_right,transparent_calc(50%-0.6px),currentColor_calc(50%-0.6px),currentColor_calc(50%+0.6px),transparent_calc(50%+0.6px))]',
  'right-0 top-0 bg-[linear-gradient(to_bottom_left,transparent_calc(50%-0.6px),currentColor_calc(50%-0.6px),currentColor_calc(50%+0.6px),transparent_calc(50%+0.6px))]',
  'bottom-0 right-0 bg-[linear-gradient(to_top_left,transparent_calc(50%-0.6px),currentColor_calc(50%-0.6px),currentColor_calc(50%+0.6px),transparent_calc(50%+0.6px))]',
  'bottom-0 left-0 bg-[linear-gradient(to_top_right,transparent_calc(50%-0.6px),currentColor_calc(50%-0.6px),currentColor_calc(50%+0.6px),transparent_calc(50%+0.6px))]',
] as const;

/**
 * Dashed outline for a chamfered plate. Put it inside a `relative` element
 * clipped with `chamfer-*` (cut = `cut` px); colour it with a text-* class.
 */
export function DashedEdge({ cut = 8, className }: { cut?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <svg className="absolute inset-0 size-full overflow-visible" fill="none">
        <rect
          x="0.5"
          y="0.5"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="6 4"
          style={{ width: 'calc(100% - 1px)', height: 'calc(100% - 1px)' }}
        />
      </svg>
      {CORNERS.map((c) => (
        <span key={c} className={cn('absolute', c)} style={{ width: cut, height: cut }} />
      ))}
    </span>
  );
}

/** Molten seam along a plate's top edge (inside the clip). */
export function EmberSeam({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-ember-400 to-transparent shadow-[0_0_8px_var(--color-ember-500)]',
        className
      )}
    />
  );
}
