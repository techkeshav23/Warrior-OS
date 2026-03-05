// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useSound Hook
// Play sound effects with Howler.js, respects settings
// ═══════════════════════════════════════════════════════════

'use client';

import { useCallback, useRef, useEffect } from 'react';
import { Howl } from 'howler';
import { useSettingsStore } from '@/stores/useSettingsStore';

const soundCache = new Map<string, Howl>();

/**
 * Preload and play sounds with global volume/mute control
 */
export function useSound() {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const volumeRef = useRef(soundVolume);
  const enabledRef = useRef(soundEnabled);

  useEffect(() => {
    volumeRef.current = soundVolume;
    enabledRef.current = soundEnabled;
  }, [soundVolume, soundEnabled]);

  const play = useCallback((src: string, volume?: number) => {
    if (!enabledRef.current) return;

    let sound = soundCache.get(src);
    if (!sound) {
      sound = new Howl({
        src: [src],
        volume: volume ?? volumeRef.current,
        preload: true,
      });
      soundCache.set(src, sound);
    } else {
      sound.volume(volume ?? volumeRef.current);
    }
    sound.play();
  }, []);

  const stop = useCallback((src: string) => {
    const sound = soundCache.get(src);
    if (sound) sound.stop();
  }, []);

  const preload = useCallback((srcs: string[]) => {
    srcs.forEach((src) => {
      if (!soundCache.has(src)) {
        soundCache.set(
          src,
          new Howl({ src: [src], preload: true, volume: 0 })
        );
      }
    });
  }, []);

  return { play, stop, preload };
}
