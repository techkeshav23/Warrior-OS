// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Icon slot helper (FORGE HUD kit)
// Every kit component that takes an icon accepts either a lucide
// component (sized + stroked by the kit: 16px, strokeWidth 1.75) or a
// ready-made element when the caller needs full control.
//   <Button leadingIcon={Plus}>New</Button>
//   <Button leadingIcon={<Plus className="size-4 text-ember-400" />}>New</Button>
// ═══════════════════════════════════════════════════════════

import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';

/** A lucide icon component, or any ReactNode rendered as-is. */
export type IconLike = ComponentType<LucideProps> | ReactNode;

const FORWARD_REF = Symbol.for('react.forward_ref');
const MEMO = Symbol.for('react.memo');

function isComponent(value: unknown): value is ComponentType<LucideProps> {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null) return false;
  const tag = (value as { $$typeof?: symbol }).$$typeof;
  return tag === FORWARD_REF || tag === MEMO;
}

/**
 * Render an icon slot. Components get the kit's size/stroke defaults and
 * aria-hidden; elements and text pass through untouched.
 */
export function renderIcon(
  icon: IconLike | undefined,
  size = 16,
  className?: string,
  strokeWidth = 1.75
): ReactNode {
  if (icon == null || typeof icon === 'boolean') return null;
  if (isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number') return icon;
  if (isComponent(icon)) {
    return createElement(icon, { size, strokeWidth, className, 'aria-hidden': true });
  }
  return icon as ReactNode;
}
