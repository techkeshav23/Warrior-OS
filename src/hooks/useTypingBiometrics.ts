// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useTypingBiometrics Hook
// Global keystroke listener → rolling typing metrics → store.
// Efficient: cheap listeners push timestamps into a ref buffer;
// a 5s interval does the (light) aggregation + store write.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef } from 'react';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { calcBiometricState } from '@/lib/biometric-calculator';
import type { TypingMetrics } from '@/types/biometrics';

const ROLLING_WINDOW_MS = 60_000; // 60s rolling window for WPM
const UPDATE_INTERVAL_MS = 5_000; // aggregate + write every 5s
const CHARS_PER_WORD = 5; // standard WPM definition
const LONG_PAUSE_MS = 1_500; // gap counted as an interruption
const MAX_BUFFER = 4_000; // hard cap on retained keystroke events

interface KeyEvent {
  t: number; // timestamp
  correction: boolean; // Backspace / Delete
  printable: boolean; // counts toward WPM
}

function isEditableTarget(target: EventTarget | null): boolean {
  // We still track typing globally (that is the point), so we do NOT skip
  // inputs — every keystroke anywhere is a signal. This helper is kept for
  // potential future filtering but currently always returns false.
  void target;
  return false;
}

export function useTypingBiometrics(): void {
  const updateMetrics = useBiometricsStore((s) => s.updateMetrics);

  const bufferRef = useRef<KeyEvent[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const lastKeyTimeRef = useRef<number | null>(null);

  useEffect(() => {
    sessionStartRef.current = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // ignore auto-repeat held keys
      if (isEditableTarget(e.target)) return;

      const t = Date.now();
      const key = e.key;
      const correction = key === 'Backspace' || key === 'Delete';
      // Printable = single-char keys (letters, digits, punctuation, space).
      const printable = key.length === 1 || key === 'Enter';

      const buf = bufferRef.current;
      buf.push({ t, correction, printable });
      if (buf.length > MAX_BUFFER) {
        buf.splice(0, buf.length - MAX_BUFFER);
      }
      lastKeyTimeRef.current = t;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: true });

    const interval = setInterval(() => {
      const now = Date.now();
      const cutoff = now - ROLLING_WINDOW_MS;
      const buf = bufferRef.current;

      // Drop events outside the rolling window.
      let firstInWindow = 0;
      while (firstInWindow < buf.length && buf[firstInWindow].t < cutoff) {
        firstInWindow++;
      }
      if (firstInWindow > 0) buf.splice(0, firstInWindow);

      const events = buf;
      if (events.length < 2) {
        // Not enough signal this window — skip to avoid noisy snapshots.
        return;
      }

      // ── WPM (printable chars in window / 5, scaled to per-minute) ──
      const printableCount = events.reduce(
        (n, ev) => (ev.printable ? n + 1 : n),
        0
      );
      const windowSpanMs = now - events[0].t || ROLLING_WINDOW_MS;
      const minutes = Math.max(windowSpanMs / 60_000, 1 / 60);
      const wpm = printableCount / CHARS_PER_WORD / minutes;

      // ── Error rate (corrections per 100 keystrokes) ──
      const corrections = events.reduce(
        (n, ev) => (ev.correction ? n + 1 : n),
        0
      );
      const errorRate = (corrections / events.length) * 100;

      // ── Inter-keystroke intervals ──
      const intervals: number[] = [];
      for (let i = 1; i < events.length; i++) {
        intervals.push(events[i].t - events[i - 1].t);
      }
      const pauseAvg =
        intervals.reduce((a, b) => a + b, 0) / (intervals.length || 1);

      // Std-dev of intervals → rhythm consistency.
      const mean = pauseAvg;
      const variance =
        intervals.reduce((a, b) => a + (b - mean) ** 2, 0) /
        (intervals.length || 1);
      const rhythmScore = Math.sqrt(variance);

      // Long-pause frequency (interruptions per minute).
      const longPauses = intervals.reduce(
        (n, gap) => (gap >= LONG_PAUSE_MS ? n + 1 : n),
        0
      );
      const pauseFrequency = longPauses / minutes;

      const metrics: TypingMetrics = {
        wpm: Math.round(wpm),
        errorRate: Math.round(errorRate),
        pauseAvg: Math.round(pauseAvg),
        rhythmScore: Math.round(rhythmScore),
      };

      const sessionMinutes = (now - sessionStartRef.current) / 60_000;
      const state = calcBiometricState(metrics, sessionMinutes, pauseFrequency);

      updateMetrics(state, metrics);
    }, UPDATE_INTERVAL_MS);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, [updateMetrics]);
}
