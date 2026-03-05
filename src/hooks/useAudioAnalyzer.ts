// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useAudioAnalyzer Hook
// Connects audio element, runs rAF loop reading frequency data,
// updates useAudioStore with bass/mids/highs in real-time
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import {
  connectMediaElement,
  getFrequencyBands,
} from '@/lib/audio-engine';

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

  // Connect media element to analyser
  useEffect(() => {
    if (!mediaElement) return;

    disconnectRef.current = connectMediaElement(mediaElement);

    return () => {
      disconnectRef.current?.();
      disconnectRef.current = null;
    };
  }, [mediaElement]);

  // Animation loop for frequency data
  const updateFrequency = useCallback(() => {
    const { bass, mids, highs } = getFrequencyBands();
    setFrequencyData(bass, mids, highs);
    animRef.current = requestAnimationFrame(updateFrequency);
  }, [setFrequencyData]);

  useEffect(() => {
    if (isPlaying && mediaElement) {
      animRef.current = requestAnimationFrame(updateFrequency);
    }

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, mediaElement, updateFrequency]);
}
