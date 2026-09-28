// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Algo Lab Playback Hook
// Plays a precomputed frame list with requestAnimationFrame:
// play, pause, step, seek, speed, reset. Visualizers only render
// the current frame.
// ═══════════════════════════════════════════════════════════

'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface PlaybackOptions {
  /** Frames advanced per second while playing. */
  stepsPerSecond: number;
  /** Start playing automatically whenever a new frame list arrives. */
  autoPlay?: boolean;
  /** Called once when playback (or stepping) reaches the last frame. */
  onComplete?: () => void;
}

export interface PlaybackControls {
  index: number;
  total: number;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stepForward: () => void;
  stepBack: () => void;
  reset: () => void;
  toEnd: () => void;
  seek: (index: number) => void;
}

export interface Playback<T> extends PlaybackControls {
  frame: T | undefined;
}

/** Long gaps (tab in background, debugger) never jump more than this. */
const MAX_TICK_MS = 250;

export function usePlayback<T>(frames: readonly T[], options: PlaybackOptions): Playback<T> {
  const { stepsPerSecond, autoPlay = false, onComplete } = options;
  const [source, setSource] = useState(frames);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  // A new frame list restarts playback from its first frame.
  if (source !== frames) {
    setSource(frames);
    setIndex(0);
    setPlaying(autoPlay && frames.length > 1);
  }

  const total = frames.length;
  const last = Math.max(0, total - 1);
  const current = Math.min(index, last);

  const positionRef = useRef(current);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    positionRef.current = current;
    completeRef.current = onComplete;
  });

  useEffect(() => {
    if (!playing || last === 0) return;
    let raf = 0;
    let previous: number | null = null;
    let carry = 0;

    const tick = (now: number) => {
      if (previous === null) previous = now;
      const elapsed = Math.min(now - previous, MAX_TICK_MS);
      previous = now;
      carry += (elapsed * stepsPerSecond) / 1000;
      const steps = Math.floor(carry);
      if (steps > 0) {
        carry -= steps;
        const next = Math.min(positionRef.current + steps, last);
        positionRef.current = next;
        setIndex(next);
        if (next >= last) {
          setPlaying(false);
          completeRef.current?.();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, stepsPerSecond, last, frames]);

  const play = () => {
    if (total <= 1) return;
    if (current >= last) setIndex(0);
    setPlaying(true);
  };

  const pause = () => setPlaying(false);

  const toggle = () => {
    if (playing) pause();
    else play();
  };

  const stepForward = () => {
    setPlaying(false);
    if (current >= last) return;
    const next = current + 1;
    setIndex(next);
    if (next === last) onComplete?.();
  };

  const stepBack = () => {
    setPlaying(false);
    setIndex(Math.max(0, current - 1));
  };

  const reset = () => {
    setPlaying(false);
    setIndex(0);
  };

  const toEnd = () => {
    setPlaying(false);
    setIndex(last);
  };

  const seek = (target: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(last, Math.round(target))));
  };

  return {
    frame: frames[current],
    index: current,
    total,
    playing: playing && last > 0,
    atStart: current === 0,
    atEnd: current >= last,
    play,
    pause,
    toggle,
    stepForward,
    stepBack,
    reset,
    toEnd,
    seek,
  };
}

/**
 * Keyboard shortcuts for a focused visualizer: Space play/pause,
 * ←/→ step, Home reset, End jump to the last frame. Text inputs,
 * selects and sliders keep their own keys.
 */
export function handlePlaybackKeys(event: KeyboardEvent<HTMLElement>, controls: PlaybackControls): void {
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target && target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const onButton = target !== null && target.closest('button') !== null;

  switch (event.key) {
    case ' ':
      if (onButton) return; // let the focused button activate natively
      controls.toggle();
      break;
    case 'ArrowRight':
      controls.stepForward();
      break;
    case 'ArrowLeft':
      controls.stepBack();
      break;
    case 'Home':
      controls.reset();
      break;
    case 'End':
      controls.toEnd();
      break;
    default:
      return;
  }
  event.preventDefault();
}
