// ═══════════════════════════════════════════════════════════
// WARRIOR OS — /design-system
// FORGE HUD, the Warrior OS design system: tokens, type, layout,
// every kit component in its states, the app-icon set and a composed
// sample window. The live reference for everyone building apps.
// ═══════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import { DesignSystem } from './DesignSystem';

export const metadata: Metadata = {
  title: 'FORGE HUD — Design System',
  description:
    'FORGE HUD, the Warrior OS design system: deep-ink surfaces, plasma accent, ember energy — tokens, components and app icons.',
};

export default function DesignSystemPage() {
  return <DesignSystem />;
}
