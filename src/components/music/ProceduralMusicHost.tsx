// ═══════════════════════════════════════════════════════════
// WARRIOR OS — ProceduralMusicHost
// Global, render-nothing owner of the procedural music engine. Mount
// once in the desktop phase: music then keeps playing when the Music
// Player window is minimised or closed, MoodShift reacts to events
// from anywhere in the OS, and AutoMood follows the clock and your
// typing. When the desktop unmounts (lock / log out) the engine,
// every synth and the Transport are disposed.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { retainMusicEngine } from '@/lib/procedural-music/engine';
import { MoodShift } from './MoodShift';
import { AutoMood } from './AutoMood';

export function ProceduralMusicHost() {
  useEffect(() => retainMusicEngine(), []);
  return (
    <>
      <MoodShift />
      <AutoMood />
    </>
  );
}
