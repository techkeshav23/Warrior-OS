// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Audio Reactive Effects
// Reads audio store levels and applies reactive effects:
// taskbar pulse, window border glow, wallpaper intensity
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useEffect, useRef } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';

/**
 * AudioReactive sets CSS custom properties on :root based on
 * real-time audio frequency data. Other components can read
 * these properties to create audio-reactive effects.
 *
 * Properties set:
 * --audio-bass: 0-1
 * --audio-mids: 0-1
 * --audio-highs: 0-1
 * --audio-energy: 0-1
 * --audio-glow: 0-0.3 (for subtle border glow)
 * --audio-pulse: 1-1.15 (for scale transforms)
 */
function AudioReactiveInner() {
  const bassLevel = useAudioStore((s) => s.bassLevel);
  const midsLevel = useAudioStore((s) => s.midsLevel);
  const highsLevel = useAudioStore((s) => s.highsLevel);
  const overallLevel = useAudioStore((s) => s.overallLevel);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    rootRef.current = document.documentElement;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (!isPlaying) {
      // Reset when not playing
      root.style.setProperty('--audio-bass', '0');
      root.style.setProperty('--audio-mids', '0');
      root.style.setProperty('--audio-highs', '0');
      root.style.setProperty('--audio-energy', '0');
      root.style.setProperty('--audio-glow', '0');
      root.style.setProperty('--audio-pulse', '1');
      return;
    }

    root.style.setProperty('--audio-bass', bassLevel.toFixed(3));
    root.style.setProperty('--audio-mids', midsLevel.toFixed(3));
    root.style.setProperty('--audio-highs', highsLevel.toFixed(3));
    root.style.setProperty('--audio-energy', overallLevel.toFixed(3));
    root.style.setProperty('--audio-glow', (bassLevel * 0.3).toFixed(3));
    root.style.setProperty('--audio-pulse', (1 + bassLevel * 0.15).toFixed(3));
  }, [bassLevel, midsLevel, highsLevel, overallLevel, isPlaying]);

  return null;
}

export const AudioReactive = memo(AudioReactiveInner);
