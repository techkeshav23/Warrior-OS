// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Procedural Music Generation Store
// Tracks generation state, current mood, typing BPM, and the
// most recently generated notes (for the visual staff indicator)
// ═══════════════════════════════════════════════════════════

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export type MusicMood = 'morning' | 'study' | 'coding' | 'night';

export interface GeneratedNote {
  id: string;
  note: string;      // e.g. "C4"
  degree: number;    // scale degree 0-4 (for staff placement)
  velocity: number;  // 0-1
  at: number;        // Date.now() when triggered
}

interface MusicGenStore {
  // Transient runtime state (not persisted)
  isGenerating: boolean;
  currentMood: MusicMood;
  typingBPM: number;             // derived from typing biometrics, 60-140
  volume: number;                // 0-1
  seed: number;                  // pattern seed; changing it re-rolls patterns
  recentNotes: GeneratedNote[];  // last few notes for visualization

  // Persisted preferences
  autoMood: boolean;             // auto-select mood by time-of-day + typing

  // Actions
  setGenerating: (generating: boolean) => void;
  setMood: (mood: MusicMood) => void;
  updateTypingRhythm: (bpm: number) => void;
  setVolume: (volume: number) => void;
  randomizeSeed: () => void;
  pushNote: (note: GeneratedNote) => void;
  clearNotes: () => void;
  setAutoMood: (enabled: boolean) => void;
  toggleAutoMood: () => void;
}

const MAX_RECENT_NOTES = 24;

export const useMusicGenStore = create<MusicGenStore>()(
  persist(
    immer((set) => ({
      isGenerating: false,
      currentMood: 'morning',
      typingBPM: 90,
      volume: 0.6,
      seed: Math.floor(Math.random() * 1_000_000),
      recentNotes: [],
      autoMood: true,

      setGenerating: (generating) => set((s) => { s.isGenerating = generating; }),

      setMood: (mood) => set((s) => { s.currentMood = mood; }),

      updateTypingRhythm: (bpm) => set((s) => {
        // Clamp to a musical, non-jarring range
        s.typingBPM = Math.max(60, Math.min(140, Math.round(bpm)));
      }),

      setVolume: (volume) => set((s) => {
        s.volume = Math.max(0, Math.min(1, volume));
      }),

      randomizeSeed: () => set((s) => {
        s.seed = Math.floor(Math.random() * 1_000_000);
      }),

      pushNote: (note) => set((s) => {
        s.recentNotes.push(note);
        if (s.recentNotes.length > MAX_RECENT_NOTES) {
          s.recentNotes.splice(0, s.recentNotes.length - MAX_RECENT_NOTES);
        }
      }),

      clearNotes: () => set((s) => { s.recentNotes = []; }),

      setAutoMood: (enabled) => set((s) => { s.autoMood = enabled; }),

      toggleAutoMood: () => set((s) => { s.autoMood = !s.autoMood; }),
    })),
    {
      name: 'warrior-os-musicgen',
      // Only persist user preferences; runtime/transient state stays in memory
      partialize: (state) => ({
        volume: state.volume,
        autoMood: state.autoMood,
        currentMood: state.currentMood,
      }),
    }
  )
);
