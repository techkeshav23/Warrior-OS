// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useAudioAnalyzer Hook
// Connects audio element, runs rAF loop reading frequency data,
// updates useAudioStore with bass/mids/highs in real-time
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import {
  connectMediaElement,
  getFrequencyBands,
} from '@/lib/audio-engine';

const THROTTLE_MS = 33; // ~30fps — reduces Zustand store updates

/**
 * Connects a media element to the Web Audio API analyser
 * and continuously updates the audio store with frequency data.
 */
export function useAudioAnalyzer(
  mediaElement: HTMLMediaElement | null
) {
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const setFrequencyData = useAudioStore((s) => s.setFrequencyData);
  const animRef = useRef<number>(0);
  const disconnectRef = useRef<(() => void) | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!mediaElement) return;

    disconnectRef.current = connectMediaElement(mediaElement);

    return () => {
      disconnectRef.current?.();
      disconnectRef.current = null;
    };
  }, [mediaElement]);

  useEffect(() => {
    if (!isPlaying || !mediaElement) return;

    const updateFrequency = (time: number) => {
      if (time - lastUpdateRef.current >= THROTTLE_MS) {
        const { bass, mids, highs } = getFrequencyBands();
        setFrequencyData(bass, mids, highs);
        lastUpdateRef.current = time;
      }
      animRef.current = requestAnimationFrame(updateFrequency);
    };

    animRef.current = requestAnimationFrame(updateFrequency);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, mediaElement, setFrequencyData]);
}
