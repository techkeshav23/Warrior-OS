// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Flashcards App
// The 'flashcards' app entry: GATE Arena opened on the formula cards
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { GateArenaApp } from './GateArenaApp';

function FlashcardsAppInner() {
  return <GateArenaApp initialTab="formulas" />;
}

export const FlashcardsApp = memo(FlashcardsAppInner);
