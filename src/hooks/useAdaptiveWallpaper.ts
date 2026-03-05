// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useAdaptiveWallpaper Hook
// Auto-switches wallpaper based on time of day
// morning=starfield, afternoon=nebula, evening=aurora,
// night=void, latenight=matrix
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useClock } from '@/hooks/useClock';

const TIME_WALLPAPER_MAP: Record<string, string> = {
  earlyMorning: 'starfield',  // 5-8
  morning: 'nebula',          // 8-12
  afternoon: 'fluid',         // 12-17
  evening: 'aurora',          // 17-21
  night: 'void',              // 21-0
  lateNight: 'matrix',        // 0-5
};

function getTimeBracket(hours: number): string {
  if (hours >= 5 && hours < 8) return 'earlyMorning';
  if (hours >= 8 && hours < 12) return 'morning';
  if (hours >= 12 && hours < 17) return 'afternoon';
  if (hours >= 17 && hours < 21) return 'evening';
  if (hours >= 21) return 'night';
  return 'lateNight'; // 0-5
}

/**
 * Automatically switches wallpaper when time bracket changes.
 * Only active when adaptiveWallpaper setting is enabled.
 */
export function useAdaptiveWallpaper() {
  const adaptiveEnabled = useSettingsStore((s) => s.adaptiveWallpaper);
  const setWallpaper = useSettingsStore((s) => s.setWallpaper);
  const { hours } = useClock();
  const prevBracketRef = useRef<string>('');

  useEffect(() => {
    if (!adaptiveEnabled) return;

    const bracket = getTimeBracket(hours);

    // Only switch if bracket actually changed
    if (bracket !== prevBracketRef.current) {
      prevBracketRef.current = bracket;
      const wallpaperId = TIME_WALLPAPER_MAP[bracket];
      if (wallpaperId) {
        setWallpaper(wallpaperId);
      }
    }
  }, [hours, adaptiveEnabled, setWallpaper]);
}
