// ═══════════════════════════════════════════════════════════
// WARRIOR OS — /warrior-lab
// Test bench for the 3D warrior avatar: every stage variant side by
// side, action triggers, tier / streak / decay previews, the arc
// reactor's speaking state and the GLB model status.
// ═══════════════════════════════════════════════════════════

import type { Metadata } from 'next';
import { WarriorLab } from './WarriorLab';

export const metadata: Metadata = {
  title: 'Warrior Lab',
  description: 'Test bench for the Warrior OS 3D avatar: stage variants, actions, armor tiers, streak aura, decay damage and the arc reactor.',
};

export default function WarriorLabPage() {
  return <WarriorLab />;
}
