// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Flashcards App
// The 'flashcards' app entry: Training Grounds opened on flashcard review
// ═══════════════════════════════════════════════════════════

'use client';

import { memo } from 'react';
import { TrainingGroundsApp } from './TrainingGroundsApp';

function FlashcardsAppInner() {
  return <TrainingGroundsApp initialTab="flashcards" />;
}

export const FlashcardsApp = memo(FlashcardsAppInner);
