// ═══════════════════════════════════════════════════════════
// WARRIOR OS — useTypingBiometrics Hook
// Global keydown/keyup listeners → rolling typing metrics → store.
//
// Privacy: keystrokes inside password / payment / one-time-code and
// other sensitive fields are ignored completely. For everything else
// only a timestamp and a coarse class (printable / correction) is kept
// in memory for 60 s — never which key, never any text.
//
// Efficiency: listeners are passive and only push into a queue; a
// requestAnimationFrame flush batches them into the rolling buffer,
// and the store is written once every 5 seconds.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect } from 'react';
import { useBiometricsStore } from '@/stores/useBiometricsStore';
import { useDecayStore } from '@/stores/useDecayStore';
import {
  calcBiometricState,
  computeTypingMetrics,
  TYPING_WINDOW_MS,
  type KeystrokeSample,
} from '@/lib/biometric-calculator';
import { evaluateBiometricAchievements } from '@/components/biometrics/achievements';

/** Store write cadence. */
export const BIOMETRIC_UPDATE_MS = 5_000;
/** Only publish a reading if the user typed within this long. */
const ACTIVE_TYPING_MS = 10_000;
/** A typing gap this long starts a new tracker session (fatigue clock). */
const SESSION_RESET_MS = 20 * 60_000;
/** Hard cap on retained samples (well above 60 s of fast typing). */
const MAX_BUFFER = 2_000;
/** Recent printable keystroke times kept for the music rhythm bus. */
const MAX_RECENT_TIMES = 32;

// ─── Timing-only keystroke bus (read by the typing-rhythm generator) ───

type KeystrokeListener = (t: number) => void;

const keystrokeListeners = new Set<KeystrokeListener>();
const recentKeystrokeTimes: number[] = [];
let lastKeystrokeAt: number | null = null;
let activeTrackers = 0;

/** Subscribe to keystroke *timestamps* (epoch ms). Returns an unsubscribe. */
export function onTypingKeystroke(listener: KeystrokeListener): () => void {
  keystrokeListeners.add(listener);
  return () => {
    keystrokeListeners.delete(listener);
  };
}

/** Timestamps (epoch ms) of the most recent printable keystrokes. */
export function getRecentKeystrokeTimes(): readonly number[] {
  return recentKeystrokeTimes;
}

/** Epoch ms of the last tracked keystroke, or null. */
export function getLastKeystrokeAt(): number | null {
  return lastKeystrokeAt;
}

/** True while at least one enabled TypingTracker is listening. */
export function isTypingTrackerActive(): boolean {
  return activeTrackers > 0;
}

// ─── Sensitive-field filter ───

const SENSITIVE_AUTOCOMPLETE = /(password|cc-|one-time-code|otp)/i;
const SENSITIVE_LABEL =
  /(pass(word|phrase|code)?|pwd|secret|token|otp|\bpin\b|cvv|cvc|card.?number|ssn|iban|api.?key)/i;

/** True if the keystroke target must never be measured. */
export function isSensitiveTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  if (target.closest('[data-private],[data-sensitive],[data-biometrics="off"]')) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    const type = (target.type || '').toLowerCase();
    if (type === 'password' || type === 'hidden') return true;
    if (SENSITIVE_AUTOCOMPLETE.test(target.autocomplete || '')) return true;
    const label = [
      target.name,
      target.id,
      target.getAttribute('aria-label') ?? '',
      target.placeholder,
    ].join(' ');
    if (SENSITIVE_LABEL.test(label)) return true;
  }
  return false;
}

type KeyClass = 'printable' | 'correction' | null;

/** Classify a key without retaining it. Modifier chords / nav keys → null. */
function classify(e: KeyboardEvent): KeyClass {
  if (e.isComposing) return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const key = e.key;
  if (key === 'Backspace' || key === 'Delete') return 'correction';
  if (key === 'Enter' || (typeof key === 'string' && key.length === 1)) return 'printable';
  return null;
}

/**
 * Mount once (via <TypingTracker />). When `enabled` is false nothing is
 * attached and no data is collected.
 */
export function useTypingBiometrics(enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    activeTrackers++;
    const buffer: KeystrokeSample[] = [];
    let queue: KeystrokeSample[] = [];
    const awaitingKeyUp: KeystrokeSample[] = [];
    let rafId = 0;
    let sessionStart: number | null = null;

    const flush = () => {
      rafId = 0;
      if (queue.length === 0) return;
      const batch = queue;
      queue = [];
      for (const sample of batch) {
        buffer.push(sample);
        if (sample.printable) {
          recentKeystrokeTimes.push(sample.t);
          if (recentKeystrokeTimes.length > MAX_RECENT_TIMES) {
            recentKeystrokeTimes.splice(0, recentKeystrokeTimes.length - MAX_RECENT_TIMES);
          }
        }
        keystrokeListeners.forEach((listener) => {
          try {
            listener(sample.t);
          } catch {
            /* a listener failing must not break tracking */
          }
        });
      }
      // Prune to the rolling window + hard cap.
      const cutoff = Date.now() - TYPING_WINDOW_MS;
      let drop = 0;
      while (drop < buffer.length && buffer[drop].t < cutoff) drop++;
      if (drop > 0) buffer.splice(0, drop);
      if (buffer.length > MAX_BUFFER) buffer.splice(0, buffer.length - MAX_BUFFER);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isSensitiveTarget(e.target)) return;
      const cls = classify(e);
      if (cls === null) return;

      const t = Date.now();
      if (sessionStart === null || (lastKeystrokeAt !== null && t - lastKeystrokeAt > SESSION_RESET_MS)) {
        sessionStart = t;
      }
      lastKeystrokeAt = t;

      const sample: KeystrokeSample = {
        t,
        correction: cls === 'correction',
        printable: cls === 'printable',
        dwell: null,
      };
      queue.push(sample);
      awaitingKeyUp.push(sample);
      if (awaitingKeyUp.length > 12) awaitingKeyUp.shift();
      if (rafId === 0) rafId = window.requestAnimationFrame(flush);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isSensitiveTarget(e.target)) return;
      if (classify(e) === null) return;
      // Pair with the oldest pending keydown (FIFO) — no key identity needed.
      const sample = awaitingKeyUp.shift();
      if (!sample) return;
      const dwell = Date.now() - sample.t;
      if (dwell >= 0 && dwell < 2_000) sample.dwell = dwell;
    };

    const listenerOpts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener('keydown', onKeyDown, listenerOpts);
    window.addEventListener('keyup', onKeyUp, listenerOpts);

    const interval = window.setInterval(() => {
      flush();
      const now = Date.now();
      if (lastKeystrokeAt === null || now - lastKeystrokeAt > ACTIVE_TYPING_MS) return;

      const result = computeTypingMetrics(buffer, now);
      if (!result) return;

      // Fatigue clock: continuous study time from the decay engine when it
      // is running (breaks reset it); otherwise this tracker's own session.
      const decay = useDecayStore.getState();
      const ownSession = sessionStart === null ? 0 : (now - sessionStart) / 60_000;
      const sessionMinutes =
        decay.enabled && decay.continuousStudyMinutes > 0
          ? decay.continuousStudyMinutes
          : ownSession;

      const state = calcBiometricState(result.metrics, sessionMinutes, result.pauseFrequency);
      useBiometricsStore.getState().updateMetrics(state, result.metrics);
      evaluateBiometricAchievements(now);
    }, BIOMETRIC_UPDATE_MS);

    return () => {
      window.removeEventListener('keydown', onKeyDown, listenerOpts);
      window.removeEventListener('keyup', onKeyUp, listenerOpts);
      window.clearInterval(interval);
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      buffer.length = 0;
      queue = [];
      awaitingKeyUp.length = 0;
      activeTrackers = Math.max(0, activeTrackers - 1);
      if (activeTrackers === 0) recentKeystrokeTimes.length = 0;
    };
  }, [enabled]);
}
