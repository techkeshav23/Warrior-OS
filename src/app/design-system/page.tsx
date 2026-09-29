// ═══════════════════════════════════════════════════════════
// WARRIOR OS — /design-system
// FORGED ARMOR, the Warrior OS design system: materials, tokens, type,
// every kit component in its states, the app-icon set and a composed
// sample window. The live reference for everyone building apps.
// ═══════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import { DesignSystem } from './DesignSystem';

export const metadata: Metadata = {
  title: 'FORGED ARMOR — Design System',
  description:
    'FORGED ARMOR, the Warrior OS design system: chamfered steel plates, bevels and rivets, engraved labels and ember heat — materials, tokens, components and app icons.',
};

export default function DesignSystemPage() {
  return <DesignSystem />;
}
